# ADR 0017: Body transforms carry facial anchors

- **Status:** Accepted
- **Date:** 2026-08-24
- **Decision owners:** Project owner

## Context

Animation poses can translate, rotate, and non-uniformly scale the silhouette.
Originally those transforms changed only the body path while eye centres remained
in stage coordinates. Stretching or moving a body therefore left its face pinned
behind, visibly separating identity from material.

Expressions and gaze still own eye geometry and orientation, so the renderer must
carry positions with the body without turning body animation into a second face
system.

## Decision

The renderer applies the active silhouette's translation, rotation, and scale to
the computed eye centres. Eye dimensions, lid openness, expression tilt, gaze,
and containment remain owned by their existing channels.

Body transforms move facial anchors; they do not re-author the expression.

## Rejected alternatives

**Keep eyes in stage coordinates.** Any translated or stretched silhouette moves
away from its face.

**Bake matching eye positions into every animation.** It duplicates renderer
geometry in each state and makes every animation body-specific.

**Transform the whole SVG wrapper.** Decor, orbit depth layers, and host-level
gaze offsets would move with the body even when they belong to the stage.

## Consequences

### Positive

- Faces remain attached through body motion for every silhouette.
- Animation definitions need only describe body transforms.
- Expression and containment logic remain centralized.

### Costs

- The renderer must compose silhouette and eye-frame coordinate systems.
- A future animation that intentionally detaches eyes needs an explicit channel.

## Enforced in

- `src/render/stage.js`
- `src/anim/player.js`

## Explicit non-decisions

This ADR does not make eye width and height scale with every body deformation.
Only the anchor centres inherit the silhouette transform.

It does not change body-relative containment from ADR 0010.

It does not decide how decor, notification pips, or orbit rings inherit body
motion.
