import { encodeQr, toSvg } from './qr.js';

const MAX_BATCH_LINES = 20;
const MAX_BATCH_INPUT = 20_000;

/** Encode independent QR codes from newline-separated text. */
export function generateQrBatch(input, options = {}) {
  if (typeof input !== 'string' || input.length > MAX_BATCH_INPUT) {
    throw new RangeError('Batch input must be text no longer than 20,000 characters.');
  }
  const selected = input.split(/\r?\n/u)
    .map((value, index) => ({ line: index + 1, value }))
    .filter(item => item.value.trim().length > 0);
  if (!selected.length) throw new RangeError('Enter at least one non-empty line.');
  if (selected.length > MAX_BATCH_LINES) {
    throw new RangeError('Batch mode accepts at most 20 non-empty lines.');
  }
  const items = [], errors = [];
  for (const item of selected) {
    try {
      const qr = encodeQr(item.value);
      items.push({ line: item.line, qr, svg: toSvg(qr, options) });
    } catch (error) {
      const message = error instanceof RangeError &&
        String(error.message).includes('78 UTF-8 bytes')
        ? 'exceeds the 78-byte QR capacity'
        : error instanceof RangeError && String(error.message).includes('surrogate')
          ? 'contains malformed Unicode'
          : error instanceof RangeError
            ? 'does not fit a supported QR code' : 'could not be encoded';
      errors.push({ line: item.line, reason: message });
    }
  }
  return { totalLines: selected.length, items, errors };
}
