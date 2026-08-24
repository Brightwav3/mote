# Work plan

This file tracks the next bounded engineering outcomes. Architectural reasons
belong in `docs/decisions/`; completed facts belong in `PROGRESS.md`.

## Now — stabilize the expanded demo

1. Keep the original Bloub animation catalogue separate from experimental Mote
   choreography in the demo.
2. Preserve the public ID of every retained expression and animation across UI,
   runtime lookup, TypeScript declarations, and tests.
3. Verify expression one-shots, experiment navigation, theme switching, and Sun
   controls in the browser after UI changes.

Completion gate: `npm run check` passes and the live artifact has no console
errors while each visible selector can be activated.

## Next — strengthen behavioural coverage

1. Add browser-level coverage for selector counts, selected state, and navigation
   between Make, Live, New animations, and Photoroom.
2. Add focused tests for ADR 0013 mood deposits and ADR 0014 autonomous face
   reachability instead of relying only on broad runtime tests.
3. Add an explicit test that large-field states are refused when reduced motion
   is active while local states still run.

Completion gate: each new ADR has a test that would fail if its central rule were
reversed.

## Later — release hygiene

1. Decide whether experimental animations graduate into the stable catalogue.
2. Review README examples and generated TypeScript declarations before versioning.
3. Build `dist/` from source and inspect the resulting single-file demo and module.

Completion gate: source, docs, types, generated artifacts, and release notes agree
on the supported catalogue.
