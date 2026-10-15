# Design tokens (copy)

`tokens.resolved.json` is a copy of `tokens/build/tokens.resolved.json` from the
**kazispace-ui** repository, the design source of truth for every frontend.
`tailwind.config.ts` reads its colour values from this file instead of hard-coding hex.

- **Source:** kazispace-ui `main` @ `56cac83` (tokens 0.2).
- **To update:** copy the file again from kazispace-ui (never edit it by hand), then run
  `npm test`. `tokens.test.ts` checks that every token the Tailwind config uses still
  exists and resolves to a hex colour.
