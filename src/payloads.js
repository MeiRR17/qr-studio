/**
 * Generate conventional short QR payloads locally.
 *
 * Wifi QR syntax is widely supported but not a formal guarantee of
 * compatibility across every device. Values may contain secrets:
 * never log, persist, send or display them in diagnostics.
 */
function field(value, label, max = 120) {
  if (typeof value !== 'string' || value.length > max) {
    throw new RangeError(label + ' must be at most ' + max + ' characters.');
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) {
    throw new RangeError(label + ' cannot contain control characters.');
  }
  return value;
}
function wifiEscape(value) {
  return value.replace(/[\\;,:"]/g, character => '\\' + character);
}

/** Compatible with the widespread WIFI:T:<mode>;S:<ssid>;P:<password>;; convention. */
export function wifiPayload({ssid, password = '', security = 'WPA', hidden = false}) {
  const name = field(ssid, 'Network name', 80);
  if (!name.length) throw new RangeError('Wi-Fi network name is required.');
  if (!['WPA', 'WEP', 'nopass'].includes(security)) {
    throw new RangeError('Select WPA/WPA2, WEP or an open network.');
  }
  if (typeof hidden !== 'boolean') throw new TypeError('Hidden network must be boolean.');
  const credentials = security === 'nopass' ? '' : field(password, 'Wi-Fi password', 120);
  if (security !== 'nopass' && !credentials.length) {
    throw new RangeError('Enter the Wi-Fi password for a protected network.');
  }
  return 'WIFI:T:' + security + ';S:' + wifiEscape(name) + ';' +
    (security === 'nopass' ? '' : 'P:' + wifiEscape(credentials) + ';') +
    (hidden ? 'H:true;' : '') + ';';
}

/** Standard mailto URI; the recipient is validated without attempting to deliver mail. */
export function emailPayload({recipient, subject = '', body = ''}) {
  const address = field(recipient, 'Email recipient', 120).trim();
  if (!/^[^\s@<>:,;]+@[^\s@<>:,;]+\.[^\s@<>:,;]+$/u.test(address)) {
    throw new RangeError('Enter a valid email address.');
  }
  const topic = field(subject, 'Email subject', 120);
  const content = field(body, 'Email body', 250);
  const query = [];
  if (topic) query.push('subject=' + encodeURIComponent(topic));
  if (content) query.push('body=' + encodeURIComponent(content));
  return 'mailto:' + address + (query.length ? '?' + query.join('&') : '');
}

export function buildQrPayload(kind, values) {
  if (kind === 'text') return field(values?.text, 'Text', 2000);
  if (kind === 'wifi') return wifiPayload(values);
  if (kind === 'email') return emailPayload(values);
  throw new RangeError('Unsupported QR content type.');
}
