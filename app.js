import { encodeQr, toSvg } from './src/qr.js';
import { buildQrPayload } from './src/payloads.js';
const $=id=>document.getElementById(id);
let encoded=null, currentSvg='';
let revision=0; // Invalidate pending image exports when content or styling changes.
const contentType = $('content-type');
function payload() {
  switch (contentType.value) {
    case 'text': return buildQrPayload('text', {text:$('payload').value});
    case 'wifi': return buildQrPayload('wifi', {
      ssid:$('wifi-ssid').value,
      password:$('wifi-password').value,
      security:$('wifi-security').value,
      hidden:$('wifi-hidden').checked,
    });
    case 'email': return buildQrPayload('email', {
      recipient:$('email-to').value,
      subject:$('email-subject').value,
      body:$('email-body').value,
    });
    default: throw new RangeError('Invalid content type.');
  }
}
function selectContentType() {
  $('free-form').hidden = contentType.value !== 'text';
  $('wifi-form').hidden = contentType.value !== 'wifi';
  $('email-form').hidden = contentType.value !== 'email';
  $('wifi-password-wrap').hidden = $('wifi-security').value === 'nopass';
  discard();
  refreshBytes();
  info('Content type changed. Generate a new QR when ready.');
}

function info(message,error=false){$('message').textContent=message;$('message').className=error?'message error':'message';}
function refreshBytes(){
  try {
    const count = new TextEncoder().encode(payload()).length;
    $('bytes').textContent=count+' / 78 bytes';
    $('bytes').className=count>78?'over-limit':'';
  } catch {
    $('bytes').textContent='— / 78 bytes';
    $('bytes').className='';
  }
}
function discard(){
  revision++;
  encoded=null;currentSvg='';$('svg').disabled=$('png').disabled=true;
  // A stale preview may expose a prior Wi-Fi password even with export disabled.
  $('stage').replaceChildren();
  $('version').textContent=$('dimensions').textContent='—';
}
function generate(){
  try{
    encoded=encodeQr(payload());
    currentSvg=toSvg(encoded,{
      scale:Number($('scale').value),dark:$('dark').value,light:$('light').value,
    });
    $('stage').innerHTML=currentSvg;
    revision++;
    $('version').textContent=encoded.version;
    $('level').textContent=encoded.level+' (~7%)';
    $('dimensions').textContent=encoded.size+' × '+encoded.size+' modules';
    $('svg').disabled=$('png').disabled=false;
    info('QR encoded locally from '+encoded.bytes+' UTF-8 bytes.');
  }catch(error){
    discard();$('stage').replaceChildren();
    const detail=document.createElement('p');detail.textContent=error.message;
    $('stage').append(detail);info(error.message,true);
  }
}
function save(data,name,type){
  const blob=new Blob([data],{type});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('generate').addEventListener('click',generate);
function changedInput() {
  refreshBytes();
  discard();
  info('Content changed. Generate the updated QR code.');
}
contentType.addEventListener('change', selectContentType);
for(const id of ['payload','wifi-ssid','wifi-password','wifi-hidden','wifi-security',
  'email-to','email-subject','email-body']) {
  $(id).addEventListener('input', changedInput);
}
$('wifi-security').addEventListener('change', () => {
  $('wifi-password-wrap').hidden = $('wifi-security').value === 'nopass';
  changedInput();
});
for(const id of ['dark','light','scale']){
  $(id).addEventListener('change',()=>{if(encoded)generate();});
}
$('svg').addEventListener('click',()=>{if(currentSvg)save(currentSvg,'qr-studio.svg','image/svg+xml;charset=utf-8');});
$('png').addEventListener('click',()=>{
  if(!currentSvg || !encoded)return;
  // Snapshot the exact QR being exported. Do not consult mutable global state
  // inside asynchronous Image / canvas callbacks.
  const capturedSvg=currentSvg;
  const capturedRevision=revision;
  const pixels=(encoded.size+8)*Number($('scale').value);
  const blob=new Blob([capturedSvg],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);
  const image=new Image();
  image.onload=()=>{
    URL.revokeObjectURL(url);
    if(capturedRevision!==revision)return;
    try{
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=pixels;
      const context=canvas.getContext('2d');
      if(!context)throw new Error('Canvas rendering is unavailable.');
      context.imageSmoothingEnabled=false;
      context.drawImage(image,0,0,pixels,pixels);
      canvas.toBlob(png=>{
        if(capturedRevision!==revision)return;
        if(!png){info('PNG rendering failed.',true);return;}
        save(png,'qr-studio.png','image/png');
      },'image/png');
    }catch(error){
      info('PNG export failed: '+(error?.message||'Cannot render image.'),true);
    }
  };
  image.onerror=()=>{
    URL.revokeObjectURL(url);
    if(capturedRevision===revision)info('The browser could not render this SVG.',true);
  };
  image.src=url;
});
$('payload').value='https://github.com/MeiRR17';
selectContentType();
generate();
