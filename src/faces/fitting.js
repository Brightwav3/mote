/* ── KEEPING THE EYES INSIDE THE BODY ─────────────────────────────────────
   An expression's eye geometry is measured against a UNIT SPHERE: `eyeFrames`
   places the pair on a ball of radius R whatever the silhouette actually is,
   and the eye's own width and height are fractions of that same R. That is
   Bloub's arrangement and it is right for Bloub, where the body is a circle.

   It stops being right the moment the body is not a circle. Measured across
   all eight silhouettes and all seventeen faces, the widest eye corner reaches
   this fraction of the silhouette's own radius in that direction:

       circle 0.65   pebble 0.72   squircle 0.59   capsule 0.71
       triangle 0.81  hexagon 0.70   cloud 0.75   droplet 1.10

   The droplet is over one. Its waist is 0.68 of its peak radius, so `scared` —
   the widest pair of the seventeen — hangs out through the side of it. That is
   not a matter of taste, it is eyes outside the head.

   So the eyes are CONTAINED rather than reauthored. Nothing in
   `faces/expressions.js` moves: the poses stay Bloub's, pinned, and the fix is
   one scalar applied at draw time that shrinks the whole pair toward the
   centre until it fits. Uniform, so an expression keeps its proportions
   exactly and stays recognisably itself — see ADR 0003, a drawn face is one
   pose and not a reshaping of it. Position and size take the same scalar, so
   overflow falls off linearly with it and one step solves it outright.

   ADR 0001 forbids adjusting a ported constant to taste. This is the reason
   it can be done anyway: no constant changes, and the scalar is not chosen,
   it is solved. On a circle the worst face reaches 0.65 against a limit of
   0.9, so the scalar is exactly 1 and every existing body but the droplet
   renders bit for bit as before.

   The radii are read RAW — before the silhouette's own rotation, squash and
   offset. A state from the animation catalogue that drags the body sideways
   or squashes it flat must not drag the eyes' size around with it; what the
   containment is about is the shape of the body, not where a pose has put it.
   ADR 0005: docs/decisions/0005-animation-catalogue.md */

/* ADR 0010: containment is solved at draw time, never authored into the pose
   table. docs/decisions/0010-eye-containment-solved-not-authored.md */

/* The fraction of the silhouette's radius the outermost eye corner may reach.
   Anywhere above 0.81 leaves all seven well-behaved bodies untouched; 0.9
   leaves the droplet a visible margin of body around its eyes rather than
   having them graze the outline. */
const EYE_LIMIT = 0.9;

/* A shape can be driven arbitrarily small — the catalogue collapses the body
   to a dot of 0.16 and regrows it — and a scalar solved against that would
   take the eyes to nothing. They are invisible at that point anyway
   (`eyeAlpha` is 0 through every one of those frames), so the floor costs no
   fidelity and stops the arithmetic running away. */
const EYE_FIT_FLOOR = 0.55;

/* Radius of a profile in an arbitrary direction, by interpolating between the
   two samples either side. The drawn outline is a Catmull-Rom through those
   samples and bulges very slightly further out between them, so this reads a
   touch small — which errs toward keeping the eyes in. */
function radiusAt(radii, angle) {
  const n = radii.length;
  const f = ((angle % TAU) + TAU) / TAU * n;
  const i = Math.floor(f) % n;
  return lerp(radii[i], radii[(i + 1) % n], f - Math.floor(f));
}

/* The four corners of one eye, in stage units. `frame` carries the tangent
   basis `eyeFrames` produced, which is what gives the eye its foreshortening;
   a corner has to travel through that basis or the test would be against an
   eye nobody draws. */
function eyeCorners(frame, e, R, out) {
  const w = (e.w * R) / 2, h = (e.h * R) / 2;
  let k = 0;
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      const lx = sx * w, ly = sy * h;
      out[k++] = [frame.x + frame.a * lx + frame.c * ly,
                  frame.y + frame.b * lx + frame.d * ly];
    }
  }
  return out;
}

const FIT_CORNERS = [null, null, null, null];

/* One scalar for the pair, never above 1: this may pull eyes in, and may not
   push them out. Growing them to fill a wider body would be a restyling of
   Bloub's poses, which is exactly what ADR 0001 is there to prevent. */
function eyeFitFor(radii, frames, eyes, R) {
  let worst = 0;
  for (let i = 0; i < 2; i++) {
    const corners = eyeCorners(frames[i], eyes[i], R, FIT_CORNERS);
    for (const [x, y] of corners) {
      const reach = Math.hypot(x, y);
      if (reach === 0) continue;
      const limit = radiusAt(radii, Math.atan2(y, x)) * R;
      if (limit <= 0) continue;
      const over = reach / limit;
      if (over > worst) worst = over;
    }
  }
  if (worst <= EYE_LIMIT) return 1;
  return Math.max(EYE_FIT_FLOOR, EYE_LIMIT / worst);
}
