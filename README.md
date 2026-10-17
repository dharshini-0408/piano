# React Piano

A playable piano built with React and the Web Audio API — no external
sound libraries or audio files needed, everything is synthesized in the
browser.

## Features

- Click or tap keys to play notes
- Play with your computer keyboard (`A` through `;` maps to two octaves)
- Shift octaves up/down with the on-screen buttons or the `Z` / `X` keys
- Hold `Space` (or the Sustain button) to sustain notes like a piano pedal
- Volume control
- Warm, piano-like tone made from layered oscillators with an ADSR-style envelope

## Getting started

You'll need [Node.js](https://nodejs.org/) (16+) installed.

```bash
npm install
npm start
```

This opens the app at `http://localhost:3000`.

To build a production version:

```bash
npm run build
```

The output goes to the `build/` folder, which you can deploy anywhere
that serves static files.

## How it works

- `src/synth.js` — the sound engine. Creates oscillators + a gain envelope
  through the Web Audio API for each note press, with no audio files.
- `src/Piano.js` — the piano UI: key layout, mouse/touch/keyboard handling,
  octave shifting, sustain, and volume.
- `src/Piano.css` — the walnut, ivory, and brass visual styling.

## Keyboard map

```
White keys: A S D F G H J K L ;
Black keys: W E   T Y U   O P
```

`Z` shifts down an octave, `X` shifts up an octave, `Space` sustains.
