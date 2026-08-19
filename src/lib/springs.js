   pushed. `k` sets how hard it is pulled home, `c` how much it fights motion. */
class Spring {
  constructor(value, k, c) { this.x = value; this.v = 0; this.home = value; this.k = k; this.c = c; }
  push(impulse) { this.v += impulse; }
  step(dt) {
    /* dt must never be negative. `v *= exp(-c*dt)` is the damping term, and at
       dt < 0 it becomes exp(+something) — an amplifier — so one backwards step
       sends the spring to infinity instead of to rest. A tab being restored or
       the system clock moving is enough to produce that, so the guard is here
       as well as at the call site, and the state is bounded besides. Cheap
       insurance against a creature that explodes once a week. */
    if (!(dt > 0)) return;
    this.v += (this.home - this.x) * this.k * dt;
    this.v *= Math.exp(-this.c * dt);
    this.x = clamp(this.x + this.v * dt, -1.6, 1.6);
    this.v = clamp(this.v, -12, 12);
  }
}

/* A low-pass follower. Anything the body does goes through one of these, so
   no visual property is ever ASSIGNED — only chased. Assigning is what makes
   motion pop; chasing is what makes it read as mass.                       */
class Follow {
  constructor(x, rate) { this.x = x; this.rate = rate; }
  step(dt, target) { this.x += (target - this.x) * clamp(dt * this.rate, 0, 1); return this.x; }
}

/* ── 3 · ATTENTION + OCULOMOTOR PLANT ─────────────────────────────────────
   Gaze does not lerp. Real eyes hold still, then jump. The jump is ballistic
   and its duration scales with the distance travelled — the "main sequence".
   Between jumps the eye is never still either: slow drift plus a fine tremor,
   with a small corrective microsaccade every second or so.

   A large jump also triggers a reflex blink. That is not decoration: a blink
   suppresses vision through the jump, so the blink is what makes a big gaze
   change read as intentional instead of as a glitch.                       */