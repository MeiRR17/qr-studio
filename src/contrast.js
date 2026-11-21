/**
 * Quick QR palette legibility advisory.
 * Uses relative sRGB luminance/contrast as a conservative heuristic;
 * it is NOT a QR-scanning certification or a universal scanner threshold.
 * A working QR also depends on size, quiet zone, print quality and camera.
 */
function luminance(value) {
  if (typeof value !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(value)) {
    throw new TypeError('Expected a six-digit hexadecimal RGB color.');
  }
  const rgb = [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16) / 255);
  const linear = rgb.map(channel => channel <= 0.04045 ?
    channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * @returns {{ratio:number, foregroundDarker:boolean, recommended:boolean, message:string}}
 */
export function qrContrastAdvisory(foreground, background) {
  const dark = luminance(foreground), light = luminance(background);
  const ratio = (Math.max(dark, light) + 0.05) /
    (Math.min(dark, light) + 0.05);
  const foregroundDarker = dark < light;
  const recommended = foregroundDarker && ratio >= 4.5;
  const message = !foregroundDarker ?
    'Use a dark foreground on a light background. Inverted QR palettes may not scan reliably.' :
    ratio < 4.5 ?
      'These colors have low contrast for a QR. Choose a darker foreground or lighter background.' :
      'This palette has good contrast by the advisory heuristic. Test scanning before distribution.';
  return {
    ratio: Math.round(ratio * 100) / 100,
    foregroundDarker,
    recommended,
    message,
  };
}
