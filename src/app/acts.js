/* ADR 0004: face order here is the specification, not a derived result.
   docs/decisions/0004-scripted-episodes.md */
const ACTS = [
  ["Say hello", () => play([
    { face: "surprised", hold: 1.1, blink: true, kind: "greet", trace: true, look: ["viewer", 1.6] },
    { face: "attentive", hold: 2.4, say: ["oh — hello.", 1500] },
  ])],

  ["Praise it", () => play([
    { face: "excited", hold: 1.5, blink: true, kind: "praise", trace: true, say: ["oh! really?", 1600] },
    { face: "attentive", hold: 2.4 },
  ])],

  ["Tell a joke", () => play([
    { face: "excited", hold: 2.6, kind: "joke", trace: true, blink: true, say: ["ha!", 1200] },
  ])],

  ["Ask it something", () => play([
    { face: "confused", hold: 1.3, kind: "ask", trace: true, think: 4.0 },
    { face: "curious", hold: 1.4 },
    { face: "suspicious", hold: 1.3 },
    { face: "curious", hold: 2.4, look: ["viewer", 1.6], say: ["I think so, yes.", 1800] },
  ])],

  ["Scold it", () => play([
    { face: "shy", hold: 3.2, kind: "scold", trace: true, blink: true, look: ["away", 2.6] },
  ])],

  ["Confuse it", () => play([
    { face: "confused", hold: 2.8, kind: "confuse", trace: true, say: ["...hm?", 1300], look: ["about", 2.4] },
  ])],

  ["Startle it", () => play([
    { face: "scared", hold: 1.9, kind: "alarm", trace: true, blink: true },
    { face: "surprised", hold: 1.4 },
    { face: "attentive", hold: 1.8 },
  ])],

  ["Leave it be", () => {
    epoch++;                      // drop anything still queued
    mote.episodeUntil = -9;
    mote.lastInput = clock - 52;
    mote.cursor.has = false;
    mote.hold = null;
  }],
];
const acts = document.getElementById("acts");
ACTS.forEach(([label, fn]) => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = label;
  b.addEventListener("click", () => { mote.lastInput = clock; fn(); });
  acts.appendChild(b);
});

/* ── making one ───────────────────────────────────────────────────────────  */