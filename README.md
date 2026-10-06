# Chabad of Teaneck · Digital Pushka (v1 demo)

A full-screen web prototype of a tzedakah pushka for **Chabad of Teaneck**.  
Shake the phone, tap the cylinder, or press **Space** to give **$1** (simulated). Fill level rises toward a goal (default **$36**). Balance persists in `localStorage`.

> **Demo only — you are not charged.** No payment processor is connected yet. This builds the interaction loop for QR stickers on physical pushkas in shul.

Original design: an SVG smoked-glass cylinder with brushed champagne lid/base, coin slot, and a liquid-gold fill level. Not affiliated with or copied from any other pushka app.

To change the word on the cylinder, edit the single `<text id="box-word">` node in `index.html`.

## Quick start

From this folder:

```bash
cd /workspace/teaneck-pushka
python3 -m http.server 8765
```

Then open:

- Main app: [http://127.0.0.1:8765/](http://127.0.0.1:8765/)
- Or open `index.html` directly in a browser (DeviceMotion / some APIs work best over `http://` or `https://`, not always `file://`).

**Mobile tip:** DeviceMotion on iOS requires HTTPS (or localhost) and an explicit permission tap (“Enable shake”). Desktop uses click / Space.

## How to give

| Input | Action |
|--------|--------|
| Tap / click the pushka | +$1 |
| `Space` key | +$1 |
| Shake phone (after permission) | +$1 per shake (cooldown ~0.7s) |
| QR deep link | Auto +$1 once on load |

## QR sticker deep links

Print a QR that points at the deployed URL with either:

1. **Query param (recommended):**  
   `https://YOUR-HOST/?give=1`  
   Opens the pushka and auto-gives **$1** once, then strips `give` from the URL so refresh doesn’t double-charge the demo counter.

2. **Path shorthand:**  
   `https://YOUR-HOST/q/teaneck/`  
   Static redirect to `../../index.html?give=1`.

Local examples while the demo server is running:

- http://127.0.0.1:8765/?give=1  
- http://127.0.0.1:8765/q/teaneck/

## Persistence

- Key: `teaneck-pushka-v1` in `localStorage`
- Fields: `{ given, goal }`
- **Reset** button (top right) clears the demo balance after confirm
- Session total (footer) resets when you reload the page; lifetime “Given” persists

## Goal & fill

- Default goal: **$36** (chai × 2 — easy to change later)
- Cylinder fill height + mini progress bar track `given / goal`
- Soft gold glow when goal is reached

## Project layout

```
teaneck-pushka/
├── index.html      # Main full-viewport pushka
├── styles.css      # Original Chabad-of-Teaneck look
├── app.js          # Give / shake / deep link / persist
├── q/teaneck/      # QR path → ?give=1
└── README.md
```

Zero build step — plain HTML, CSS, and JS.

## Demo vs real payments (later)

| Now (v1) | Later |
|----------|--------|
| Local counter only | Stripe / PayPal / charity gateway |
| “Demo — not charged” banner | Live receipt + house dashboard |
| Single house hardcoded | Multi-house config / QR routing |
| $1 fixed | Amount picker, recurring, dedication |

When wiring payments: keep the same give UX, swap the `give()` success path to confirm a charge, then increment the fill from the server total.

## Browser notes

- **iOS Safari:** tap “Enable shake” when prompted; needs secure context for motion.
- **Android Chrome:** shake usually works without a prompt over HTTPS.
- **Desktop:** click and Space; shake N/A.
- `prefers-reduced-motion` tones down shake / coin animations.

## License / branding

Prototype for Joseph Isaac · Chabad of Teaneck. Invented UI — do not reuse third-party pushka assets or branding.
