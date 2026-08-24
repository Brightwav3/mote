class Gaze {
  constructor() {
    this.yaw = 0; this.pitch = 0;         // where the eyes actually point
    this.fixYaw = 0; this.fixPitch = 0;   // where they are trying to point
    this.tgtYaw = 0; this.tgtPitch = 0;   // where attention says to point
    this.sac = null;
    this.nextMicro = 0;
    this.lastAmp = 0;
    this.count = 0;
  }
  aim(yaw, pitch) { this.tgtYaw = yaw; this.tgtPitch = pitch; }

  step(t, dt, arousal, onSaccade) {
    if (this.sac) {
      const k = clamp((t - this.sac.t0) / this.sac.dur);
      const e = 1 - Math.pow(1 - k, 2.4);   // fast out, settled arrival
      this.fixYaw   = lerp(this.sac.fy, this.sac.ty, e);
      this.fixPitch = lerp(this.sac.fp, this.sac.tp, e);
      if (k >= 1) this.sac = null;
    } else {
      const dy = this.tgtYaw - this.fixYaw, dp = this.tgtPitch - this.fixPitch;
      const amp = Math.hypot(dy, dp);

      if (amp > 3.2) {
        // Ballistic jump. 24 ms of overhead plus 2.2 ms per degree travelled.
        this.sac = {
          t0: t, dur: 0.024 + 0.0022 * amp,
          fy: this.fixYaw, fp: this.fixPitch,
          ty: this.tgtYaw, tp: this.tgtPitch,
        };
        this.lastAmp = amp; this.count++;
        if (amp > 13) onSaccade(amp);       // big jump → reflex blink
      } else if (amp > 0.05) {
        // Smooth pursuit: the eye can track slow movement without jumping.
        const g = clamp(dt * 7.5, 0, 1);
        this.fixYaw   += dy * g;
        this.fixPitch += dp * g;
      }

      // Microsaccades — the eye refuses to be perfectly still.
      if (t > this.nextMicro) {
        this.nextMicro = t + rnd(0.5, 1.6);
        this.fixYaw   += rnd(-0.55, 0.55);
        this.fixPitch += rnd(-0.4, 0.4);
      }
    }

    // Drift and tremor ride on top of the fixation point, scaled by arousal:
    // a calm creature wanders more, an alert one locks on.
    const wander = reducedMotion() ? 0.35 : lerp(1.25, 0.35, arousal);
    this.yaw   = this.fixYaw   + noise(t, 11.3, 0.4) * 2.2 * wander + noise(t, 0.9, 2.0) * 0.16;
    this.pitch = this.fixPitch + noise(t, 9.1, 1.3) * 1.7 * wander + noise(t, 0.7, 4.1) * 0.13;
  }
}


/* ADR 0001: these generators are faithful Bloub ports, not approximations.
   docs/decisions/0001-port-bloub-verbatim.md

   ── BODIES ───────────────────────────────────────────────────────────────
   Ported from Bloub's `shape.ts` / `skins.ts`, function for function, rather
   than reimplemented. My own versions were close in spirit and wrong in every
   particular: 240 samples instead of 64, corners rounded by a p-norm soft
   minimum instead of a Minkowski sum with a disc, capsule and droplet built
   as stacks of overlapping circles instead of the convex hull of two — which
   is what gives them their straight tangent sides — and normalised on area,
   which I invented, instead of on peak radius, which is what the originals do.

   A shape is a radial profile: one radius per angle, all shapes sampled at the
   same angles, so any two correspond point for point.                       */
