# Progress

Last updated: 2026-08-24

## Current state

- The project builds two dependency-free artifacts: `dist/index.html` and
  `dist/mote-avatar.js` with matching declarations.
- The public avatar supports 17 expressions, 25 animations, 9 bodies, editable
  Sun petals, host light/dark theme control, episodes, snapshots, and stream
  adaptation.
- The demo separates 14 measured Bloub animations from 11 original Mote
  experiments on a dedicated page.
- Expressions and animations are selectable through visual SVG catalogues.
- Expression-specific one-shot movement exists for Laughing and Surprised.
- ADRs `0001–0017` document the current architectural boundaries.

## Verification baseline

- `npm test`: 61 passing tests on 2026-08-24.
- Structure coverage checks contiguous ADR numbering, mandatory sections,
  `AGENTS.md`/`CLAUDE.md` equality, governed-path existence, and back-references.
- Browser verification has covered catalogue counts, theme switching, expression
  selection, animation selection, and the experimental page.

## Recently completed

- Added the editable Sun body without importing Blobatar eyes or animation.
- Added host-controlled eye ink rules for light and dark themes.
- Rebuilt the live demo around 16 expression tiles and animation catalogues.
- Added 11 original animation experiments and removed the rejected Clone concept.
- Recovered five architectural decisions previously stranded in source comments.
- Added this documentation set and an ADR index.
