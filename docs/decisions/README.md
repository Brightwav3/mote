# Architecture decision index

ADRs record why Mote is shaped the way it is. They are append-only: when a
decision changes, add a new ADR that supersedes the old one instead of rewriting
history. Source files governed by a decision cite it at the relevant boundary.

## How to use this directory

1. Start with the topic table below.
2. Read `ARCHITECTURE.md` for the current shape of the system.
3. Read the linked ADR when changing a boundary, invariant, or surprising rule.
4. Add the next four-digit ADR when a new choice meets the triggers in
   `AGENTS.md`; never leave a numbering gap.
5. Run `npm test`. `test/structure.test.mjs` checks numbering, mandatory sections,
   instruction-file equality, and `Enforced in` back-references.

## Decisions

| ADR | Topic | Governs |
| --- | --- | --- |
| [0001](0001-port-bloub-verbatim.md) | Port measured Bloub geometry verbatim | faces, bodies, palette, fidelity tests |
| [0002](0002-single-file-build.md) | Build one dependency-free artifact by ordered concatenation | build, manifest, harness |
| [0003](0003-discrete-expressions-with-crossfade.md) | Settle on exact discrete faces and crossfade between them | expression chooser |
| [0004](0004-scripted-episodes.md) | Represent reactions as interruptible scripted beats | episode playback |
| [0005](0005-animation-catalogue.md) | Keep animation poses pure and blend them through one player | states, decor, player, renderer |
| [0006](0006-embeddable-agent-avatar.md) | Expose Mote through a host-neutral mount API | library boundary and demo |
| [0007](0007-stream-adapter.md) | Adapt model-stream events without coupling the renderer | stream adapter |
| [0008](0008-snapshot-boundary.md) | Snapshot the last rendered SVG through the public handle | compact/static avatars |
| [0009](0009-multi-instance-agent-avatars.md) | Give every mounted avatar an isolated runtime | runtime factory and instances |
| [0010](0010-eye-containment-solved-not-authored.md) | Solve eye containment without rewriting expressions | fitting and rendering |
| [0011](0011-editable-sun-body.md) | Keep Sun geometry editable as part of skin | Sun body and public types |
| [0012](0012-host-theme-controls-eye-ink.md) | Let host theme select cast-wide eye ink | theme API and palette |
| [0013](0013-mood-residue-is-deposited-on-events.md) | Deposit mood residue once per external event | temperament and reactions |
| [0014](0014-autonomous-thoughts-cover-the-repertoire-without-mood-trace.md) | Cover all faces autonomously without mood drift | idle scripts |
| [0015](0015-large-field-motion-is-omitted-under-reduced-motion.md) | Omit large-field acts under reduced motion | state classification and player |
| [0016](0016-attention-snapshots-targets-instead-of-tracking.md) | Snapshot deliberate gaze targets | pointer and attention API |
| [0017](0017-body-transforms-carry-facial-anchors.md) | Move eye anchors with body transforms | player and renderer |

## Status

All ADRs in this directory are currently `Accepted`. If one is superseded,
update its status and link both documents in their context sections.
