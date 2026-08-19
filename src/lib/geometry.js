   is carried by how the eyes MOVE, never by shading.                       */
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