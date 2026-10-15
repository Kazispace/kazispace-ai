# Design tokens (copy)

`tokens.resolved.json` is a copy of `tokens/build/tokens.resolved.json` from the
**kazispace-ui** repository, the design source of truth for every frontend.
`tailwind.config.ts` reads its colour values from this file instead of hard-coding hex.

- **Source:** kazispace-ui `main` @ `56cac83` (tokens 0.2). SHA-256 of the file:
  `b0329c2e1ea7b3eb523e70c5479e5532a8434cc255b104bbdf07f4ebe6abf949`.
- **To update:** copy the file again from kazispace-ui (never edit it by hand), update the
  source line and hash above and `SOURCE_SHA256` in `tokens.test.ts`, then run `npm test`. `tokens.test.ts` checks that every token the Tailwind config uses still
  exists and resolves to a hex colour.
