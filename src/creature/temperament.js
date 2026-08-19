function seedFrom(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 0x9e3779b9;
}

function temperamentFor(name) {
  const rng = createRng(seedFrom(name.toLowerCase().trim() || "mote"));
  const spread = (mid, half) => mid + (rng() * 2 - 1) * half;
  return {
    baseV: spread(0.15, 0.13),      // sunny or grave by default
    baseA: spread(0.52, 0.09),      // lively or placid
    baseD: spread(0.08, 0.18),      // bold or timid
    volatility: spread(1.00, 0.35), // how hard events land
    recovery: spread(1.00, 0.30),   // how fast it lets go of a feeling
    moodGain: spread(1.00, 0.45),   // how much a feeling stains the mood
    curiosity: spread(1.00, 0.40),  // how often something occurs to it
    sociability: spread(1.00, 0.60),// how often it looks over at you
  };
}

/* Two timescales, which is the part the old single-spring model got wrong.

   EMOTION is fast: seconds. It spikes on an event and lets go.
   MOOD is slow: minutes. It integrates whatever the emotion has been doing
   and biases where the emotion returns TO.

   The consequence is a creature with a short memory you can actually feel.
   Praise it three times running and it does not merely flash pleased three
   times and reset — it ends up in a good mood, and stays there a while.
   Scold it and it is subdued for minutes afterwards, so the NEXT thing you do
   lands differently. Nothing on screen reports this; you just notice that it
   has been in a funny mood since you shouted at it.                        */
class Mood {
  constructor() { this.v = 0; this.a = 0; this.d = 0; }

  /* An episode leaves a residue. This is deposited when the feeling FIRES,
     not integrated while it plays out — the first version integrated
     `emotion − home` every frame and could never accumulate anything, because
     the emotion by definition returns to home, so the average was zero. Four
     praises moved the mood by 0.01. Depositing on the event instead ties the
     trace to how far the feeling reached and how novel it was, which is what
     "it took it to heart" actually means. */
  absorb(target, base, temper) {
    const gain = 0.26 * clamp(temper.moodGain, 0.4, 1.8);
    this.v = clamp(this.v + (target.v - base.v) * gain, -0.45, 0.45);
    this.a = clamp(this.a + (target.a - base.a) * gain * 0.6, -0.30, 0.30);
    this.d = clamp(this.d + (target.d - base.d) * gain * 0.7, -0.40, 0.40);
  }

  /* And it fades, over a minute or two, on its own. */
  decay(dt) {
    const k = Math.exp(-dt / 75);
    this.v *= k; this.a *= k; this.d *= k;
  }
}
