# QR Studio

A QR code generator PWA. No login, no server, no tracking: every QR code is generated, styled, tested and exported in the browser. UI copy is in Bahasa Indonesia.

## Features

- **10 content types**: link, text, WiFi, contact (vCard 3.0), email, SMS, phone, WhatsApp, location, calendar event
- **Styling**: colours, linear/radial gradient, 5 module shapes, finder shapes, separate finder colour, logo with automatic error-correction bump, framed label, quiet-zone and error-correction control, built-in and saved presets
- **Scan check**: every preview is decoded again (platform `BarcodeDetector` first, jsQR as fallback) and the result is shown as a pass/fail chip
- **Export**: PNG, SVG, JPG, WebP (512–4096 px), copy image, Web Share, print, copy payload; `Ctrl/⌘ + S` downloads
- **Batch**: paste lines or upload CSV/TSV → ZIP (max 500 rows), with per-row errors and a `yang-gagal.txt` report
- **Scanner**: camera (camera switch, torch), image upload, drag & drop, paste; WiFi/contact/event results get specific actions
- **History**: local only, search, restore, backup/restore as JSON
- **PWA**: offline, installable, share target, app shortcuts, update prompt; light/dark/auto theme

## Interface

- Every page shares the same structure: a page header (title, one-line description, actions) followed by cards with numbered section headings where the page is a sequence of steps
- **Desktop**: top navigation; on Buat the preview and export panel stays sticky on the right while the steps scroll on the left; Banyak and Pindai use a two-column split
- **Mobile**: bottom tab bar within thumb reach; on Buat the result and download come right after the content step, with styling options below; a floating "Lihat hasil / Unduh" bar appears once a QR exists and the preview is off screen
- Pindai always shows a result panel, with an empty state until something is scanned; Riwayat has search and hides backup/clear actions when empty
- One set of design tokens in `src/style.css` (brand green `#0b6e4f` from the app icon, warm neutral base) drives both light and dark themes
- The page scrollbar is hidden so the layout width stays the same when switching between short and long pages

## Edge cases handled

URL scheme inference and blocking (`javascript:`, `data:` …), http and punycode warnings · WiFi/vCard/iCal escaping · Indonesian phone normalisation for WhatsApp (`08…`, `+62`, `0062`, missing country code) · Google Maps link parsing and short-link explanation · comma decimals · local time → UTC for events, all-day events, end-before-start · byte-capacity guard per error-correction level · contrast, inverted-colour, transparent background and thin quiet-zone warnings · dense-code warning and minimum print size · alignment patterns stay solid in dotted styles so they still scan · canvas size clamp for iOS · WebP fallback to PNG · clipboard/share feature detection · storage quota fallback (drops logos first) · sanitised styles from storage and imported backups · camera permission/in-use/insecure-context messages.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + encode/decode round-trip tests
npm run build      # type-check and build to dist/
npm run icons      # regenerate PWA icons (needs ImageMagick)
```

## Deploy to Vercel

Import the repository in Vercel (framework preset: Vite) or run `npx vercel --prod`. `vercel.json` sets the build command, a strict CSP, `Permissions-Policy` for camera/geolocation, and no-cache headers for the service worker.
