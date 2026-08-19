# Mote — working rules

A small creature you make: pick a body, a colour and a name, then it goes about
its own business. Ships as one self-contained HTML file.

`npm run check` builds and runs the tests. There are no dependencies; Node 20+
is all that is required.

## Do not

- **Do not edit `dist/`.** It is build output. Edit `src/` and run
  `npm run build`.
- **Do not retype the ported constants.** The expression poses, shape
  generators, geometry and palette come from Bloub and are pinned by tests. If
  a value looks wrong, check it against `bloub/src/bot/` — do not adjust it to
  taste. See ADR 0001.
- **Do not add `import`/`export` to `src/`.** Sources are plain scripts sharing
  one scope, concatenated in `src/manifest.json` order. See ADR 0002.
- **Do not add a runtime dependency or an external asset.** The artifact runs
  under a CSP that blocks every host except Google Fonts.
- **Do not reuse a top-level name.** One shared scope means a collision silently
  shadows.
- **Do not schedule creature behaviour with `setTimeout`.** Use `later()`, which
  runs on the animation clock. Wall-clock timers desynchronise when the tab is
  hidden. See ADR 0004.
- **Do not blend expressions.** A drawn face is one pose exactly; only the
  crossfade between two interpolates. See ADR 0003.
- **Do not port more Bloub code without extending `NOTICE` in the same commit.**

## Where things go

| Concern | Location |
| --- | --- |
| Ported geometry and constants | `src/faces/`, `src/bodies/`, `src/lib/geometry.js` |
| Affect, attention, temperament, scripts | `src/creature/` |
| SVG rendering | `src/render/` |
| Page shell, maker UI, loop | `src/app/`, `src/shell.html` |
| Why something is shaped as it is | `docs/decisions/` |

## Testing behaviour

The creature is driven by `requestAnimationFrame`. To test it, call `frame(t)`
in a loop with a **monotonically increasing** `t`. Two traps, both of which have
produced false results here:

- resetting `t` between cases makes the dwell guard suppress face changes;
- a negative `dt` turns the spring damping term into an amplifier. It is guarded
  now, and `test/affect.test.mjs` keeps it that way.
