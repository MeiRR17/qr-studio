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
  if (/[\r\n]/u.test(name)) throw new RangeError('Wi-Fi SSID cannot contain line breaks.');
  if (!['WPA', 'WEP', 'nopass'].includes(security)) {
    throw new RangeError('Select WPA/WPA2, WEP or an open network.');
  }
  if (typeof hidden !== 'boolean') throw new TypeError('Hidden network must be boolean.');
  const credentials = security === 'nopass' ? '' : field(password, 'Wi-Fi password', 120);
  if (/[\r\n]/u.test(credentials)) throw new RangeError('Wi-Fi password cannot contain line breaks.');
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
  // This deliberately narrow mailto-safe subset excludes ? and #, which
  // would otherwise inject query/fragment data into the final URI.
  // More exotic valid email addresses are intentionally not supported.
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u.test(address) ||
      address.split('@')[1].split('.').some(part => part.startsWith('-') || part.endsWith('-'))) {
    throw new RangeError('Enter a valid email address.');
  }
  const topic = field(subject, 'Email subject', 120);
  const content = field(body, 'Email body', 250);
  const query = [];
  if (topic) query.push('subject=' + encodeURIComponent(topic));
  if (content) query.push('body=' + encodeURIComponent(content));
  return 'mailto:' + address + (query.length ? '?' + query.join('&') : '');
}

/**
 * Portable telephone URI for QR scanners. Only accepts conservative
 * international E.164 numbers or Israeli 0-prefixed local dialing numbers.
 * Formatting spaces, parentheses and hyphens are discarded; extension,
 * fragment and query delimiters are never accepted.
 */
function normalizedPhone(number) {
  const entered = field(number, 'Phone number', 40).trim();
  if (!entered || /[^+0-9 ()-]/u.test(entered)) {
    throw new RangeError('Enter a phone number without extensions or URI parameters.');
  }
  const normalized = entered.replace(/[ ()-]/gu, '');
  if (!/^(?:\+[1-9]\d{1,14}|0\d{8,9})$/u.test(normalized)) {
    throw new RangeError('Use a +country-code number (E.164) or an Israeli local number beginning with 0.');
  }
  return normalized;
}

export function phonePayload({number}) {
  return 'tel:' + normalizedPhone(number);
}

/**
 * RFC 5724-style SMS URI for scanners that support SMS composition.
 * Encoding a QR never sends a message; recipients and body are URI components.
 * The final QR encoder enforces the full byte-mode payload size limit.
 */
export function smsPayload({number, body = ''}) {
  const recipient = normalizedPhone(number);
  const content = field(body, 'SMS message', 250);
  if (/[\r\n]/u.test(content)) {
    throw new RangeError('SMS message must be a single line.');
  }
  return 'sms:' + recipient + (content ? '?body=' + encodeURIComponent(content) : '');
}

/** Geo URI (RFC 5870 subset): coordinates are entered explicitly by the user.
 * This tool never reads device location or queries a map service.
 */
function coordinate(value, label, minimum, maximum) {
  const entered = field(value, label, 24).trim();
  if (!/^-?(?:\d{1,3}(?:\.\d{1,6})?|\.\d{1,6})$/u.test(entered)) {
    throw new RangeError(label + ' must be a decimal coordinate with at most six fractional digits.');
  }
  const numeric = Number(entered);
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
    throw new RangeError(label + ' is outside the geographic coordinate range.');
  }
  return String(Object.is(numeric, -0) ? 0 : numeric);
}
export function geoPayload({latitude, longitude}) {
  return 'geo:' + coordinate(latitude, 'Latitude', -90, 90) + ',' +
    coordinate(longitude, 'Longitude', -180, 180);
}

export function buildQrPayload(kind, values) {
  if (kind === 'text') return field(values?.text, 'Text', 2000);
  if (kind === 'wifi') return wifiPayload(values);
  if (kind === 'email') return emailPayload(values);
  if (kind === 'phone') return phonePayload(values);
  if (kind === 'sms') return smsPayload(values);
  if (kind === 'geo') return geoPayload(values);
  throw new RangeError('Unsupported QR content type.');
}
