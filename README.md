# QR Studio

A no-dependency, browser-based QR generator that performs **encoding locally**. Create QR codes from short text or URLs, customize foreground/background colors, and download SVG or PNG. No external API or QR library.

## Quick start

From a clone of the repository, serve static files:

    python3 -m http.server 8000

Open http://localhost:8000. A local HTTP server or HTTPS static hosting supports the native JavaScript ES modules. The app defaults to a sample URL; replace it with your text and generate a code. Alternatively choose **Wi-Fi network**, **Email message**, **Telephone call**, **Text message (SMS)**, **Geographic location**, or **Contact card (MECARD)** and fill the structured fields.

## Implementation

- UTF-8 byte-mode encoding for QR Code **versions 1–4** at error correction level **L** (approximately 7% codeword recovery under typical error conditions).
- Maximum UTF-8 payload sizes: v1 17 bytes, v2 32 bytes, v3 53 bytes, v4 78 bytes.
- **Strict Unicode handling:** preflight and QR generation share one UTF-8 encoder that rejects unpaired UTF-16 surrogate code units (malformed Unicode) instead of allowing `TextEncoder` to silently substitute `U+FFFD`. This prevents an unnoticed QR payload change, particularly for credentials or contact details. Valid supplementary characters such as emoji remain supported and count as their full UTF-8 bytes. Both paths now enforce a 10,000 UTF-16-code-unit input bound before encoding, in addition to the 78-byte QR v4-L limit. Error messages never echo the entered content.
- **Live QR capacity preflight:** before generation, the interface shows the smallest expected supported version (`1–4`, level L) and how many UTF-8 bytes remain within that version's actual capacity. For oversized content it shows the exact byte count exceeding v4-L's 78-byte ceiling. Structured content counts all protocol prefixes and escaping by using its final built payload. Invalid or incomplete content reports an unavailable estimate instead of guessing. It does not store or display entered secrets, construct a matrix, or require a scanner/camera/network permission. The generated QR still needs practical scanner verification.
- Reed–Solomon error correction over GF(256), finder/timing/alignment patterns, BCH-encoded format information, and all eight QR data masks selected using a penalty heuristic.
- Mandatory four-module quiet zone in exported images.
- Color picker, module scale selector, SVG and PNG exports, and byte-count feedback.
- **Clear all content & QR** explicitly empties input fields from **every** content type (including hidden Wi-Fi passwords, contact fields, SMS/email details and entered coordinates), clears the rendered QR and byte-mode matrix, disables SVG/PNG exports, and invalidates pending asynchronous PNG conversion. It switches to a blank plain-text form while keeping non-sensitive palette settings. This is an in-page privacy action: it does **not** delete files already downloaded, clipboard contents, screenshots or browser-level caches, nor does it guarantee immediate JavaScript heap erasure.
- Local color-legibility estimate computed from sRGB relative luminance and contrast, including an inversion warning and a one-click return to high-contrast defaults. This is only a heuristic, not an ISO QR-scanning certification.
- Structured Wi-Fi QR payloads with security type (WPA/WPA2, WEP or open), optional hidden SSID, and proper escaping for delimiters.
- SMS QR payloads using an `sms:` URI and an optional URI-encoded `?body=` query parameter. Both SMS and telephone QR types accept the same conservative phone-number formats. The QR only requests that compatible devices open a compose view; it never sends a message. SMS scanner support varies by platform. Message body is single-line and capped at 250 characters before the global 78-byte QR limit.
- Compact **MECARD contact QR payloads** include a required single-line name, optional phone number and optional email. Structural delimiters and backslashes in names are escaped so user input cannot add additional contact properties. Phone and email values reuse the conservative existing validators; **78 total UTF-8 bytes** still apply, so long cards must be shortened. Scanners vary in MECARD support, and anyone who scans the resulting QR can recover the contact details. Contact card creation does not communicate with contacts services or upload information.
- Geographic-location QR payloads use a minimal `geo:latitude,longitude` URI (RFC 5870 subset), with manually entered decimal coordinates, range checking (latitude ±90°, longitude ±180°), and up to six fractional digits. No GPS or browser location permission is used; QR scanner handling depends on platform.
- Telephone call QR payloads using a `tel:` URI. Accepts conservatively normalized international E.164 (`+` and up to 15 digits) or local Israeli 0-prefixed 9–10-digit numbers. Removes spaces, hyphens and parentheses; rejects extensions, URI query/fragment markers and control characters. A QR does not check that a number is allocated or reachable.
- Email QR payloads using a `mailto:` URI with an optional encoded subject and body. Recipient validation accepts a deliberately conservative, mailto-safe address subset (no query/fragment separators) to avoid injected URI parameters; unusual email syntaxes may be rejected.
- The 78-byte limit applies to the **entire encoded payload**, including Wi-Fi/email protocol prefixes and escaping, not just the visible input fields.
- Library API: `qrCapacityInfo(text)` returns only byte counts, smallest supported version, free capacity and overage (never the input text); `encodeQr(text)` returns a matrix; `toSvg(result, options)` creates standalone SVG. The capacity preview and encoder now use the same version-selection rule.

## Limitations

This first implementation intentionally supports **only short UTF-8 strings**, not structured append, binary-file import, Kanji mode or higher QR versions. Multibyte Unicode characters consume more than one byte. The PNG converter uses your browser's canvas and does not upload data.

Use a dark foreground and light background for best camera compatibility; custom colors can make QR codes unreadable. The on-screen color advisory recommends a dark foreground and a contrast ratio of at least 4.5:1 as a conservative legibility heuristic, not a universal QR standard or guarantee. Users can still choose other palettes; always test the resulting file on the intended devices. Wi-Fi, email and telephone URI recognition depends on the scanner and its OS; results are not guaranteed across all camera apps. Always scan a generated QR code with a camera before printing or circulating it widely.

**Validation has not been performed**. The owner requested implementation-only changes; QR interoperability should be checked during the consolidated validation round before any public release.

## Privacy

Input is encoded entirely in JavaScript in your browser; no content is transmitted to a server. **A Wi-Fi QR code contains credentials as recoverable plaintext.** Anyone with a copy of the code may retrieve the network password. Do not publish Wi-Fi QR codes publicly for private networks. Save or share image files with the same care as the credentials themselves. Color pickers now redraw the generated QR immediately when a color changes (including live drag updates), rather than only on the final color-change event. SVG/PNG exports always use the currently displayed palette, and asynchronous PNG conversions remain tied to their original preview revision.

The app does not save your input in localStorage, cookies or analytics. When the content or QR type changes, the old QR preview is immediately removed, including any earlier network credentials. The dedicated clearing button also wipes currently hidden content fields from every payload mode, resets the preview and cancels stale pending PNG work; it cannot revoke QR images already shared or downloaded. Pending PNG image conversions are cancelled when the generated content or styling changes, preventing accidental export of a superseded QR. If you publish the static files on a remote host, your browser still downloads those public files as with any website.

## Files

- `src/qr.js` — byte-mode capacity preflight, encoder, Reed–Solomon codewords, QR matrix placement and SVG export
- `src/payloads.js` — local Wi-Fi, email, telephone, SMS, geographic-location and MECARD contact QR content builders (no networking)
- `src/contrast.js` — isolated palette contrast advisory and accessibility-friendly warnings
- `index.html` — browser interface
- `app.js` — local input, preview and SVG/PNG download
- `styles.css` — responsive styling
- `LICENSE` — MIT

## Author

Built by Meir Dvir · https://github.com/MeiRR17
