# Design tokens (copy)

`tokens.resolved.json` is a copy of `tokens/build/tokens.resolved.json` from the
**kazispace-ui** repository, the design source of truth for every frontend.
`tailwind.config.ts` reads its colour values from this file instead of hard-coding hex.

- **Source:** kazispace-ui `main` @ `be520f5` (tokens 0.4: adds Radio's `color.radio.*`, D48). SHA-256 of the file:
  `7f6f559d5245337736a8adfee684cedefdf9a7f601861bc07ad438ec62ee3fb6`.
- **To update:** copy the file again from kazispace-ui (never edit it by hand), update the
  source line and hash above and `SOURCE_SHA256` in `tokens.test.ts`, then run `npm test`. `tokens.test.ts` checks that every token the Tailwind config uses still
  exists and resolves to a hex colour.
