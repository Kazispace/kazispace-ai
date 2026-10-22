# Design tokens (copy)

`tokens.resolved.json` is a copy of `tokens/build/tokens.resolved.json` from the
**kazispace-ui** repository, the design source of truth for every frontend.
`tailwind.config.ts` reads its colour values from this file instead of hard-coding hex.

- **Source:** kazispace-ui `main` @ `00d587c` (tokens 0.3). SHA-256 of the file:
  `e0d768a39eae4fc4dbc8d666bbe0273f4f2e84950420cb2a12cd364d44462595`.
- **To update:** copy the file again from kazispace-ui (never edit it by hand), update the
  source line and hash above and `SOURCE_SHA256` in `tokens.test.ts`, then run `npm test`. `tokens.test.ts` checks that every token the Tailwind config uses still
  exists and resolves to a hex colour.
