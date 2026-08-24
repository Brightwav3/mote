# ADR 0012: Host theme controls one cast-wide eye ink

- **Status:** Accepted
- **Date:** 2026-08-24
- **Decision owners:** Project owner

## Context

Choosing eye ink independently from each body colour produces a cast whose
face changes character with its paint. A single white or dark ink is more
coherent, but either disappears on the matching endpoint body.

The host already knows whether its surface is light or dark. Mote needs that
context through its public API rather than inferring it from arbitrary page
CSS or baking UI theme into a creature's identity.

## Decision

Expose `theme: "light" | "dark"` on mount and snapshots, plus
`avatar.setTheme(theme)` and `avatar.theme()`.

Dark hosts use dark eyes for the whole palette except the Ink body, which uses
white. Light hosts use white eyes for the whole palette except the White body,
which uses dark. The default is `light` for backward compatibility. The demo
passes its resolved page colour scheme explicitly and exposes a switch that
calls the same public `setTheme` method an embedder uses.

Theme is host context. It is not returned by `skin()` or `persona()` and does
not follow a creature copied into a differently themed application.

## Rejected alternatives

**Choose whichever ink maximizes contrast per body.** More measurable contrast,
but half the palette becomes a different-looking face.

**Infer from `prefers-color-scheme` inside the library.** Ignores explicit app
themes and makes rendering depend on ambient browser state.

**Store theme in the persona.** Makes a portable creature carry assumptions
about the surface where it used to live.

## Consequences

- Integrators can switch eye ink without remounting or changing skin.
- Black and white endpoint bodies remain legible in their matching modes.
- Other body colours intentionally share the theme's one cast-wide ink.
- Snapshots may override theme independently from body, paint and name.
- The demo switch updates its live Mote and every still preview without reload.

## Enforced in

- `src/bodies/palette.js`
- `src/render/stage.js`
- `src/embed/agent.js`
- `src/embed/types.d.ts`
- `src/app/loop.js`
- `test/affect.test.mjs`
- `test/mount.test.mjs`
- `README.md`

## Explicit non-decisions

- **Page background colours.** Mote receives a semantic mode, not CSS values.
- **Automatic observation of DOM theme changes.** The host calls `setTheme`.
- **Per-avatar eye colours.** Theme selects one cast-wide ink rule, not a skin
  customization.
