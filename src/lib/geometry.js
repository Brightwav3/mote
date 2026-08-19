function spin(u, v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [
    [u[0]*c + v[0]*s, u[1]*c + v[1]*s, u[2]*c + v[2]*s],
    [v[0]*c - u[0]*s, v[1]*c - u[1]*s, v[2]*c - u[2]*s],
  ];
}
/* ADR 0001: after bloub/src/bot/face.ts eyePoses().
   docs/decisions/0001-port-bloub-verbatim.md */
function eyeFrames(yaw, pitch, roll, split, R) {
  let f = [0,0,1], right = [1,0,0], down = [0,1,0];
  [f, right]    = spin(f, right, rad(yaw));
  [down, f]     = spin(down, f, rad(pitch));
  [right, down] = spin(right, down, rad(roll));
  const build = (side) => {
    const [ef, er] = spin(f, right, rad(split * side));
    return { x: ef[0]*R, y: ef[1]*R, a: er[0], b: er[1], c: down[0], d: down[1], depth: ef[2] };
  };
  return [build(-1), build(1)];
}

/* ── 2 · AFFECT ───────────────────────────────────────────────────────────
   Sixteen expressions, each a POINT on the valence/arousal plane rather than
   a state to switch into. The face is always a weighted blend of the three
   nearest, so it is continuous: it spends most of its life between named
   emotions, which is where real faces live too.

   Note what an expression owns: eye SHAPE only (proportions, tilt, lid) plus
   the separation of the two eyes. It does NOT own gaze direction. Baking head
   orientation into an expression is the classic mistake — the eyes then leap
   sideways every time the mood changes, because "sad looks down" fights with
   "you are over there".                                                    */
/* Bloub's expression set entire, per-eye, plus one of my own.

   Three things carried over that the earlier simplification threw away:

     · PER-EYE geometry. `suspicious`, `confused` and `curious` are not mirror
       pairs — one eye is squinted and the other is not, at a different tilt.
       That asymmetry is most of what separates them from a generic squint,
       and averaging them into one shape destroyed it.
     · the `open` channel, which is a lid coming down rather than the eye
       being smaller. `sleepy` needs it; a short eye is not a heavy one.
     · a POSTURAL bias — a head tilt and a raised or lowered gaze belonging to
       the expression. Bloub bakes these into the expression as absolute
       directions; that is what makes eyes leap sideways whenever the mood
       changes. Here they are a small bias ADDED to wherever attention has
       already pointed, so `curious` tilts his head and `proud` lifts his chin
       without either overruling what he is looking at.

   The third axis is DOMINANCE, and it earns its place: on valence/arousal
   alone, `angry` (-0.82, 0.78) and `scared` (-0.62, 0.96) sit almost on top of
   each other and bled into one another constantly, which is why he never
   looked properly furious. They are opposites in control — anger acts, fear
   submits — and separating them on a third axis fixes it. Same for `proud`
   against `shy`, and `suspicious` against `confused`.                       */
/* ── WHERE HE ACTUALLY LOOKS ──────────────────────────────────────────────
   An expression carries its own measured head pose, and Bloub's resting one
   is (yaw 28.49, pitch 28.62, roll -13) — a creature glancing down and to its
   right. That is correct in the original, where the pointer OVERRIDES the
   pose's gaze whenever you move the mouse, so you almost never see it. This
   Mote deliberately does not track the pointer, so the same numbers left it
   permanently looking at the floor.

   So attention wins most of the argument and the expression keeps a fifth of
   it: enough for `proud` to lift its chin and `shy` to duck, not enough to
   decide where he is looking. Roll stays entirely the expression's — a head
   tilt is part of the face, not part of the aim. */
/* ADR 0005: docs/decisions/0005-animation-catalogue.md */
const LOOK_MIX = 0.8;
function gazeOf(pose, aim) {
  return {
    yaw: lerp(pose.yaw, clamp(aim.yaw, -42, 42), LOOK_MIX),
    pitch: lerp(pose.pitch, clamp(aim.pitch, -27, 27), LOOK_MIX),
    roll: pose.roll,
  };
}
