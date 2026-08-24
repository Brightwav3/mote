# ADR 0005: The animation catalogue is ported from Bloub whole and blended into the creature by a single scalar

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision owners:** Project owner

## Context

The owner first asked for Bloub's fourteen animations — idle, thinking, wink,
wide, alert, notify, exclaim, sleep, egg, hexagon, play, orbit, burst, comet.
The catalogue now keeps those as its measured core and adds eleven original
Mote states: nod, nope, listening, peek, focus, celebrate, charge, glitch,
melt, portal, and magnet.

They are not expressions. An expression here is a face: eye geometry plus a head
pose, drawn on whichever body you picked. Several of these animations *replace*
the body — the creature becomes a leaning exclamation mark, three pulsing dots,
an egg, a tumbling triangle — and three of them draw things that are not the
creature at all: orbit rings with a real depth sort, spiralling burst particles,
comet ribbons, a notification pip that the body is notched out around.

So the existing pipeline could not carry them. It had one silhouette, chosen
once and cached, no decor layer at all, and a renderer that took the expression's
head pose as the only source of gaze.

Every constant in the catalogue is a measurement off the reference video —
travel distances, buzz frequencies, collapse curves, the 0.213 orbit radius that
makes the triangle read as tumbling rather than spinning. They were fitted
against Bloub's easing curves.

## Decision

The catalogue is **ported verbatim** from `bloub/src/bot/states.ts` and
`decor.ts`, easings included, and a state stays what it is there: a pure
function from local time to a complete pose. It owns no clock.

Original Mote states follow the same pure pose contract but are not presented
as Bloub ports. Their body transforms are composed onto the user's selected
profile, so even the large motions preserve an editable Sun or any other body.

`anim/player.js` owns the clock, and everything drawn is a **crossfade between
an outgoing pose and an incoming one**. Ordinary life — the body you picked
wearing the expression the mood chose — is itself a pose, so starting a state,
switching between two, and stopping are one operation with different ends: the
mix runs over the incoming state's measured `morph`, or over a fixed 0.38 s on
the way out. A state's `baseBody` / `baseFace` flags mean "that channel is not
mine", so the body you picked keeps playing underneath.

The outgoing state is evaluated **live**, with its own clock still running, so a
comet's ribbons keep turning while they fade. Decor is not interpolated — an
outgoing ring and an incoming dot are not two values of one thing — so both are
drawn and their opacities crossfade. Rotation is unwrapped toward the angle
drawn on the previous frame rather than toward the other silhouette.

The first version blended each state against ordinary life *only*, which is not
a crossfade but two of them back to back, and it was wrong in three ways that
all showed:

- switching states went **through** the resting ball — `thinking` collapses the
  body to a dot on the right and `notify` wants the full ball, so the ball
  popped back to full size and reformed;
- starting a state while nothing was playing had **no fade at all**: measured
  against the drawn silhouette, entering `thinking` from rest moved 154 px
  between two frames;
- `orbit` spins, so once its angle passed -180° the shortest rotational path
  from a still shape flipped sign and the blend reversed direction mid-fade,
  worth another 26 px.

Measured after: the worst single-frame change anywhere in the catalogue,
including the full fourteen-state sequence, is ~20 px, and the profile through
a switch ramps `0 → 14 → 0` over half a second with no spike.

Two consequences are load-bearing rather than incidental:

- **Draw order.** The half of an orbit ring with z < 0 is emitted as a separate
  path and drawn *before* the body, so the body occludes it.
- **The notification pip is a mask, not an overlay.** The body is notched out
  concentrically around the pip with a constant margin.

A scripted beat (ADR 0004) may **name** an animation, which then plays for
exactly that beat and puts itself away. That is how the act deck gives each
animation a reason: thinking while it works, the alert bar when it breaks
something, the burst when you cut it off.

A beat that names no animation **leaves a running one alone**, and stopping is
never a cut: `stopAnim()` brings the exit morph forward instead of dropping the
state on the frame the call lands. The first version did neither, and the
result was the most visible bug in the feature — every script the creature
plays to itself passes through beats with no animation, so an orbit begun a
second earlier was killed mid-turn, silhouette and rings vanishing on one
frame, by whatever it happened to think of next. Idle thoughts are now also
suppressed entirely while an animation plays. `cancelAnim()` is the hard stop
and belongs to one act: "leave it be".

Animations carry no mood trace. An animation is something the creature *does*,
not something that happens to it.

Separately, and forced by the same work: gaze composition moved out of the
renderer. Attention now supplies 80% of yaw and pitch and the expression 20%,
where before the expression's absolute pose was the base and attention a bounded
offset on top. Bloub's resting gaze is (28.49, 28.62, -13) and is *overridden*
whenever the pointer moves; this Mote does not track the pointer, so the same
numbers left it permanently looking at the floor.

## Rejected alternatives

**Re-derive the animations from the mood model.** Already rejected once, for
reactions, in ADR 0004, and worse here: no affect model produces a tumbling
triangle with orbit rings. These are choreography, not feeling.

**Approximate the constants.** They were fitted against Bloub's easing curves
off a video nobody here has. An approximation is not cheaper, it is just wrong
by an unmeasurable amount.

**Give animations their own renderer and swap between two stages.** Removes the
blend entirely — every entry and exit becomes a hard cut, and the states that
keep the chosen body (`wink`, `wide`, `notify`) would stop keeping it.

**Blend per-channel with separate timings.** More expressive and unjustified:
nothing in the catalogue asks for the silhouette and the eyes to arrive at
different times, and it multiplies the states the player can be in.

**Freeze the outgoing pose and fade the snapshot.** Cheaper — one pose to
evaluate instead of two — and it stops the world for the length of every fade:
a comet's ribbons would hang still while they dimmed.

**Keep gaze composition in the renderer and special-case the resting face.**
Puts a decision in the layer that is not allowed to decide anything, and leaves
the same bug in every other expression that carries a strong pose.

## Consequences

### Positive

- All fourteen play, from buttons and unprompted, and the fourteen-state
  sequence plays end to end.
- States are pure functions, so they are testable without a DOM or a clock.
- The creature no longer looks permanently downward.
- Decor nodes are pooled, so a state asking for ten dots on one frame and none
  on the next does not churn the DOM at 60 Hz.

### Costs

- A posed silhouette is rebuilt every frame — roughly 9 KB of path data — where
  a resting body is built once. Only while an animation is playing, but it is
  real work the page did not do before.
- Two shape vocabularies now exist: cached profiles for the resting body, posed
  silhouettes for animations. `drawStage` branches on which it was handed.
- More Bloub code, so more of this project is a port. `NOTICE` grew accordingly.
- The blend can be told to run a state whose `minDuration` exceeds the hold it
  was given; the player takes the larger, silently.
- Two states are evaluated per frame during a crossfade, and both sets of decor
  are drawn. Bounded — one crossfade at a time — but it doubles the work for a
  third of a second at every switch.
- `anim.rot` is drawing state kept across frames purely for continuity. It has
  to be cleared whenever the player goes idle, and nothing enforces that.

## Enforced in

- `src/anim/decor.js`
- `src/anim/states.js`
- `src/anim/player.js`
- `src/render/stage.js`
- `src/bodies/shapes.js`
- `src/lib/math.js`
- `src/lib/geometry.js`
- `src/app/acts.js`
- `src/creature/mote.js`
- `test/anim.test.mjs`
- `NOTICE`

## Explicit non-decisions

This does not decide *when* the creature plays an animation unprompted. The
weights in `IDLE_ANIMS` are a list, and editing one is editing a list.

It does not authorise adding animations of our own to `STATES`. That table is a
port and is pinned by tests; an original animation would need its own table and
its own entry in `NOTICE`.

It does not extend the blend to expressions. A drawn face is still one pose
exactly, per ADR 0003; this governs only how a state is mixed against the
creature's ordinary life.

It says nothing about the customiser offering the animation-only shapes (the
egg, the bar) as bodies. They are not in `BODIES` and this does not put them
there.
