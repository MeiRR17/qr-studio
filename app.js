import { encodeQr, toSvg } from './src/qr.js';
import { buildQrPayload } from './src/payloads.js';
import { qrContrastAdvisory } from './src/contrast.js';
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
    case 'phone': return buildQrPayload('phone', {
      number:$('phone-number').value,
    });
    case 'sms': return buildQrPayload('sms', {
      number:$('sms-number').value,
      body:$('sms-body').value,
    });
    case 'geo': return buildQrPayload('geo', {
      latitude:$('geo-latitude').value,
      longitude:$('geo-longitude').value,
    });
    case 'contact': return buildQrPayload('contact', {
      name:$('contact-name').value,
      phone:$('contact-phone').value,
      email:$('contact-email').value,
    });
    default: throw new RangeError('Invalid content type.');
  }
}
function selectContentType() {
  $('free-form').hidden = contentType.value !== 'text';
  $('wifi-form').hidden = contentType.value !== 'wifi';
  $('email-form').hidden = contentType.value !== 'email';
  $('phone-form').hidden = contentType.value !== 'phone';
  $('sms-form').hidden = contentType.value !== 'sms';
  $('geo-form').hidden = contentType.value !== 'geo';
  $('contact-form').hidden = contentType.value !== 'contact';
  $('wifi-password-wrap').hidden = $('wifi-security').value === 'nopass';
  discard();
  refreshBytes();
  info('Content type changed. Generate a new QR when ready.');
}

function info(message,error=false){$('message').textContent=message;$('message').className=error?'message error':'message';}
function updateContrast() {
  const assessment=qrContrastAdvisory($('dark').value,$('light').value);
  const message=$('contrast-advisory');
  message.textContent=assessment.ratio.toFixed(2)+':1 — '+assessment.message;
  message.className=assessment.recommended?'contrast-good':'contrast-warning';
  $('reset-colors').hidden=assessment.recommended;
}

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
    lastRenderedStyle=[$('dark').value,$('light').value,$('scale').value].join('|');
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
// Explicit privacy cleanup: clear fields across ALL content types, not just
// the currently visible form. Invalidate asynchronous PNG jobs before any UI
// updates, then erase the previously rendered SVG and encoded matrix.
$('clear-content').addEventListener('click', () => {
  discard();
  for (const id of [
    'payload', 'wifi-ssid', 'wifi-password',
    'email-to', 'email-subject', 'email-body',
    'phone-number', 'sms-number', 'sms-body',
    'geo-latitude', 'geo-longitude',
    'contact-name', 'contact-phone', 'contact-email',
  ]) $(id).value = '';
  $('wifi-hidden').checked = false;
  $('wifi-security').value = 'WPA';
  contentType.value = 'text';
  $('free-form').hidden = false;
  for (const id of ['wifi-form','email-form','phone-form','sms-form','geo-form','contact-form']) {
    $(id).hidden = true;
  }
  $('wifi-password-wrap').hidden = false;
  lastRenderedStyle = '';
  refreshBytes();
  info('All QR content fields and the previous preview were cleared locally. Existing downloads and clipboard contents cannot be recalled.');
  $('payload').focus();
});
function changedInput() {
  refreshBytes();
  discard();
  info('Content changed. Generate the updated QR code.');
}
contentType.addEventListener('change', selectContentType);
for(const id of ['payload','wifi-ssid','wifi-password','wifi-hidden','wifi-security',
  'email-to','email-subject','email-body','phone-number','sms-number','sms-body',
  'geo-latitude','geo-longitude','contact-name','contact-phone','contact-email']) {
  $(id).addEventListener('input', changedInput);
}
$('wifi-security').addEventListener('change', () => {
  $('wifi-password-wrap').hidden = $('wifi-security').value === 'nopass';
  changedInput();
});
// A color picker fires "input" continuously before "change". Redraw on
// every change to the actual color value, so downloadable QR artwork can
// never lag behind the foreground/background shown in the controls.
let lastRenderedStyle='';
function refreshStyle() {
  updateContrast();
  const style=[$('dark').value,$('light').value,$('scale').value].join('|');
  if (!encoded || style === lastRenderedStyle) return;
  generate();
}
for(const id of ['dark','light']){
  $(id).addEventListener('input',refreshStyle);
  $(id).addEventListener('change',refreshStyle);
}
$('scale').addEventListener('change',refreshStyle);
$('reset-colors').addEventListener('click',()=>{
  $('dark').value='#111827';
  $('light').value='#ffffff';
  refreshStyle();
  if(!encoded)info('Colors reset. Generate a QR code to use the reliable palette.');
});
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
updateContrast();
generate();
