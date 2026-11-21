/**
 * Offline QR Code encoder for UTF-8 byte mode, QR versions 1–4, level L.
 * Standards-based ISO/IEC 18004 patterns, RS correction and format bits.
 * Limits: 17, 32, 53, 78 input bytes by version (no structured append).
 */
const CAPACITY = [
  null,
  { data: 19, ecc: 7 },
  { data: 34, ecc: 10 },
  { data: 55, ecc: 15 },
  { data: 80, ecc: 20 },
];

function multiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function eccBytes(data, degree) {
  const divisor = new Uint8Array(degree);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = multiply(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = multiply(root, 0x02);
  }
  const result = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let i = 0; i < degree; i++) result[i] ^= multiply(divisor[i], factor);
  }
  return result;
}

function encodeData(bytes, version) {
  const dataCapacity = CAPACITY[version].data;
  const bits = [];
  function append(value, length) {
    for (let i = length - 1; i >= 0; i--) bits.push(((value >>> i) & 1) !== 0);
  }
  append(0x4, 4); // Byte mode
  append(bytes.length, 8); // Versions <= 9
  for (const byte of bytes) append(byte, 8);
  const limit = dataCapacity * 8;
  const terminator = Math.min(4, limit - bits.length);
  for (let i = 0; i < terminator; i++) bits.push(false);
  while (bits.length % 8 !== 0) bits.push(false);
  const data = new Uint8Array(dataCapacity);
  for (let i = 0; i < bits.length; i++) if (bits[i]) data[i >>> 3] |= 1 << (7 - (i & 7));
  for (let i = bits.length >>> 3; i < dataCapacity; i++) data[i] = i % 2 === (bits.length >>> 3) % 2 ? 0xec : 0x11;
  const ecc = eccBytes(data, CAPACITY[version].ecc);
  const complete = new Uint8Array(data.length + ecc.length);
  complete.set(data); complete.set(ecc, data.length);
  return complete;
}

function matrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({length:size},()=>Array(size).fill(false));
  const fixed = Array.from({length:size},()=>Array(size).fill(false));
  const set = (x,y,dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = Boolean(dark);
    fixed[y][x] = true;
  };
  // Finder patterns with mandatory one-module separators.
  for (const [cx,cy] of [[3,3],[size-4,3],[3,size-4]]) {
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
      const distance = Math.max(Math.abs(dx),Math.abs(dy));
      set(cx+dx,cy+dy,distance !== 2 && distance !== 4);
    }
  }
  for (let i=8;i<size-8;i++) {
    set(i,6,i%2===0);
    set(6,i,i%2===0);
  }
  if (version>=2) {
    const center=size-7;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)
      set(center+dx,center+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  }
  // Reserve spaces for the two copies of the format information.
  for(let i=0;i<=8;i++){set(8,i,false);set(i,8,false);}
  for(let i=0;i<8;i++){set(size-1-i,8,false);set(8,size-1-i,false);}
  set(8,size-8,true); // Fixed dark module.
  return {size,modules,fixed,set};
}

function formatBits(grid,mask) {
  const {size,set}=grid;
  const data=(1<<3)|mask; // ECL L has format value 1.
  let rem=data;
  for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
  const bits=((data<<10)|rem)^0x5412;
  const bit=i=>((bits>>>i)&1)!==0;
  for(let i=0;i<=5;i++)set(8,i,bit(i));
  set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));
  for(let i=9;i<15;i++)set(14-i,8,bit(i));
  for(let i=0;i<8;i++)set(size-1-i,8,bit(i));
  for(let i=8;i<15;i++)set(8,size-15+i,bit(i));
  set(8,size-8,true);
}
function maskAt(mask,x,y) {
  switch(mask){
    case 0:return (x+y)%2===0;
    case 1:return y%2===0;
    case 2:return x%3===0;
    case 3:return (x+y)%3===0;
    case 4:return (Math.floor(y/2)+Math.floor(x/3))%2===0;
    case 5:return (x*y)%2+(x*y)%3===0;
    case 6:return ((x*y)%2+(x*y)%3)%2===0;
    case 7:return ((x+y)%2+(x*y)%3)%2===0;
    default:throw new Error('Invalid QR mask.');
  }
}
function placeData(grid,codewords) {
  const {modules,fixed,size}=grid;
  let index=0;
  for(let right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vertical=0;vertical<size;vertical++){
      const y=(((right+1)&2)===0)?size-1-vertical:vertical;
      for(let offset=0;offset<2;offset++){
        const x=right-offset;
        if(fixed[y][x])continue;
        const value=index<codewords.length*8 ? ((codewords[index>>>3]>>>(7-(index&7)))&1)!==0:false;
        modules[y][x]=value;
        index++;
      }
    }
  }
  if(index<codewords.length*8)throw new Error('QR data does not fit.');
}
function applyMask(grid,mask) {
  const {modules,fixed,size}=grid;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)
    if(!fixed[y][x]&&maskAt(mask,x,y))modules[y][x]=!modules[y][x];
}
function penalty(modules) {
  const n=modules.length;
  let score=0,dark=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(modules[y][x])dark++;
    if(y<n-1&&x<n-1&&modules[y][x]===modules[y][x+1]&&
       modules[y][x]===modules[y+1][x]&&modules[y][x]===modules[y+1][x+1])score+=3;
  }
  function linePenalty(sequence) {
    let runColor=sequence[0],runLength=1;
    for(let i=1;i<=sequence.length;i++){
      if(i<sequence.length&&sequence[i]===runColor)runLength++;
      else {
        if(runLength>=5)score+=3+runLength-5;
        runColor=sequence[i];runLength=1;
      }
    }
    // Finder-like 1:1:3:1:1 dark pattern surrounded by four light modules.
    const patternA='00001011101',patternB='10111010000';
    const bitstring=sequence.map(x=>x?'1':'0').join('');
    for(let i=0;i+11<=bitstring.length;i++){
      const part=bitstring.slice(i,i+11);
      if(part===patternA||part===patternB)score+=40;
    }
  }
  for(let i=0;i<n;i++){
    linePenalty(modules[i]);
    linePenalty(modules.map(row=>row[i]));
  }
  score+=Math.floor(Math.abs(dark*20-n*n*10)/(n*n))*10;
  return score;
}
function cloneModules(modules){return modules.map(row=>row.slice());}

/**
 * Encode arbitrary text as UTF-8 QR version 1–4 at error correction L (7%).
 * Handles up to 78 UTF-8 bytes; version chosen automatically.
 * @returns {{modules:boolean[][],size:number,version:number,mask:number,bytes:number,level:'L'}}
 */
export function encodeQr(input) {
  if(typeof input!=='string'||!input.length)throw new TypeError('Enter nonempty text.');
  const bytes=new TextEncoder().encode(input);
  const version=[1,2,3,4].find(v=>bytes.length+2<=CAPACITY[v].data); // mode + length + terminator fit
  if(!version)throw new RangeError('Text exceeds the version 4-L capacity (78 UTF-8 bytes).');
  const codewords=encodeData(bytes,version);
  const grid=matrix(version);
  placeData(grid,codewords);
  const original=cloneModules(grid.modules);
  let best=null;
  for(let mask=0;mask<8;mask++){
    grid.modules=cloneModules(original);
    applyMask(grid,mask);
    formatBits(grid,mask);
    const score=penalty(grid.modules);
    if(!best||score<best.score)best={score,mask,modules:cloneModules(grid.modules)};
  }
  return {modules:best.modules,size:grid.size,version,mask:best.mask,bytes:bytes.length,level:'L'};
}

/** Create a standalone SVG with an enforced four-module quiet zone. */
export function toSvg(qr,{scale=10,quiet=4,dark='#111827',light='#ffffff'}={}){
  if(!Number.isInteger(scale)||scale<2||scale>40)throw new RangeError('Scale must be 2–40.');
  if(!Number.isInteger(quiet)||quiet<4||quiet>16)throw new RangeError('Quiet zone must be 4–16.');
  if(!/^#[0-9a-fA-F]{6}$/.test(dark)||!/^#[0-9a-fA-F]{6}$/.test(light))
    throw new Error('Colors must be #RRGGBB.');
  const width=(qr.size+quiet*2)*scale;
  const blocks=[];
  for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)
    if(qr.modules[y][x])blocks.push('M'+((x+quiet)*scale)+' '+((y+quiet)*scale)+'h'+scale+'v'+scale+'h-'+scale+'z');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+width+
    '" width="'+width+'" height="'+width+'" role="img" aria-label="QR code">'+
    '<rect width="'+width+'" height="'+width+'" fill="'+light+'"/>'+
    '<path d="'+blocks.join('')+'" fill="'+dark+'"/></svg>';
}
