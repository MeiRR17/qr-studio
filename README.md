# QR Studio

A no-dependency, browser-based QR generator that performs **encoding locally**. Create QR codes from short text or URLs, customize foreground/background colors, and download SVG or PNG. No external API or QR library.

## Quick start

From a clone of the repository, serve static files:

    python3 -m http.server 8000

Open http://localhost:8000. A local HTTP server or HTTPS static hosting supports the native JavaScript ES modules. The app defaults to a sample URL; replace it with your text and generate a code.

## Implementation

- UTF-8 byte-mode encoding for QR Code **versions 1–4** at error correction level **L** (approximately 7% codeword recovery under typical error conditions).
- Maximum UTF-8 payload sizes: v1 17 bytes, v2 32 bytes, v3 53 bytes, v4 78 bytes.
- Reed–Solomon error correction over GF(256), finder/timing/alignment patterns, BCH-encoded format information, and all eight QR data masks selected using a penalty heuristic.
- Mandatory four-module quiet zone in exported images.
- Color picker, module scale selector, SVG and PNG exports, and byte-count feedback.
- Library API: `encodeQr(text)` returns a matrix; `toSvg(result, options)` creates standalone SVG.

## Limitations

This first implementation intentionally supports **only short UTF-8 strings**, not structured append, binary-file import, Kanji mode or higher QR versions. Multibyte Unicode characters consume more than one byte. The PNG converter uses your browser's canvas and does not upload data.

Use a dark foreground and light background for best camera compatibility; custom colors can make QR codes unreadable. Always scan a generated QR code with a camera before printing or circulating it widely.

**Validation has not been performed**. The owner requested implementation-only changes; QR interoperability should be checked during the consolidated validation round before any public release.

## Privacy

Input is encoded entirely in JavaScript in your browser; no content is transmitted to a server. The app does not save your input in localStorage, cookies or analytics. If you publish the static files on a remote host, your browser still downloads those public files as with any website.

## Files

- `src/qr.js` — byte-mode encoder, Reed–Solomon codewords, QR matrix placement and SVG export
- `index.html` — browser interface
- `app.js` — local input, preview and SVG/PNG download
- `styles.css` — responsive styling
- `LICENSE` — MIT

## Author

Built by Meir Dvir · https://github.com/MeiRR17
