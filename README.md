# Etchsky

Explore more than 119,000 real stars, learn what astronomers know about each one, and keep one in a public record with your name on it.

A kept star is a symbolic record. It does not give legal ownership of the star.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first `dev` or `build` downloads the star catalogue (about 30 MB) and builds the sky data into `public/sky`. This happens once. To rebuild it by hand: `npm run sky:data`.

Useful URLs:

- `/?perf=1` shows a frame-time overlay.
- `/?star=0` opens straight to a star (the number is the star's index in the data).
- `/record/ETC-000001` shows a kept star's certificate.

## How it is put together

- `src/engine`: the WebGL sky (Three.js), written without React so it can become its own package. It owns the frame loop, level-of-detail loading, picking and the labels.
- `src/components`: the interface (landing, star panel, search, journeys, keep flow, certificate). React never touches the frame loop.
- `src/lib`: astronomy helpers, pricing, sound, and the demo claims store.
- `src/content`: hand-written star stories and explainers.
- `scripts`: builds `public/sky` from the HYG catalogue and constellation data.

## What is a demo right now

- Keeping a star writes to `data/claims.json`. No payment is taken. The real registry will be on-chain, as set out in the blueprint, and replaces `src/lib/claims-store.ts` and `/api/claims`.
- Prices in `src/lib/pricing.ts` are placeholders for testing the flow.
- The Milky Way is generated in code, not painted from survey images.

## Data and credits

- Stars: HYG database v4.1 (Hipparcos, Yale Bright Star and Gliese catalogues), CC BY-SA 4.0, https://github.com/astronexus/HYG-Database. The attribution must stay visible in the app.
- Constellation lines: d3-celestial by Olaf Frohn, BSD 3-clause.
- Fonts: Fraunces and Instrument Sans via Fontsource (SIL Open Font License).

## Not built yet

Time slider and star motion, a 3D fly-through, on-chain registry contracts, real payments, the Gaia DR3 tile pipeline.
