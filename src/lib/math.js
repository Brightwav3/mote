
"use strict";
/* ═══════════════════════════════════════════════════════════════════════════
   MOTE — a small creature you make
   ---------------------------------------------------------------------------
   Four layers, bottom to top:
     1. geometry   two capsules on a sphere; a tangent frame gives volume free
     2. affect     valence/arousal as damped springs with mass
     3. attention  what it wants to look at, and the oculomotor plant that gets
                   the eyes there (saccades, pursuit, drift, tremor, blinks)
     4. drives     boredom, startle, habituation, speech
   Rendering is a pure read of that state each frame; it decides nothing.
   ═══════════════════════════════════════════════════════════════════════════ */

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const rad   = (d) => (d * Math.PI) / 180;
const rnd   = (a, b) => a + Math.random() * (b - a);
const r2    = (v) => Math.round(v * 100) / 100;
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Deterministic PRNG (mulberry32). Needed because a Mote's character is
   derived from its name: the same name must always produce the same animal. */
function createRng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Layered sines with mutually prime periods: drift that never visibly loops. */
function noise(t, period, seed) {
  const p = (t / period) * Math.PI * 2;
  return 0.55 * Math.sin(p + seed) + 0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) + 0.15 * Math.sin(3 * p + seed * 2.3 + 2.4);
}

/* ── 1 · GEOMETRY ─────────────────────────────────────────────────────────
   The eyes move as if painted on a ball, though nothing is shaded. Build the head's
   orthonormal frame, rotate a copy out to each eye's longitude, and project
   orthographically. Foreshortening, tilt and depth-occlusion all fall out of
   that one step. The body stays a flat disc of one colour — all of the volume