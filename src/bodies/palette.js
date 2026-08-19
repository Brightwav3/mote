/* Bloub's customiser palette, exactly as published in `skins.ts`, with one
   change: the pale "Cream" (#f1efe9) is pure white here. */
/* ADR 0001: Bloub's customiser palette, unchanged apart from the white.
   docs/decisions/0001-port-bloub-verbatim.md */
const PAINTS = [
  ["Ink", "#0a0a0c"], ["Brown", "#8b5e3c"], ["Red", "#e8483f"],
  ["Orange", "#f08a24"], ["Amber", "#f0b429"], ["Green", "#3ecf8e"],
  ["Turquoise", "#2fbfa0"], ["Blue", "#3b93f0"], ["Violet", "#8b5cf6"],
  ["Pink", "#e152b0"], ["Grey", "#a3a3a3"], ["White", "#ffffff"],
];

/* The eyes are white on every body but the white one, which takes dark ink.
   This is Bloub's own arrangement — a single `--ink` for the whole cast — and
   it is a look, not a contrast optimum: measured, white on Amber is 1.75:1 and
   on Grey 1.93:1, well under the 3:1 that WCAG 1.4.11 asks of a non-text
   graphic. Chosen deliberately over the best-of-two rule that used to live
   here, which kept every paint above 4.5:1 but gave the creature dark eyes on
   half the palette and light eyes on the other half — one animal wearing two
   different faces depending on its colour. `contrastRatio` stays below so the
   cost stays measurable rather than forgotten. */
const WHITE_BODY = "#ffffff";
const INKS = ["#14181A", "#FFFFFF"];

function relLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

function contrastRatio(a, b) {
  const la = relLuminance(a), lb = relLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function eyeInkFor(hex) {
  return hex.toLowerCase() === WHITE_BODY ? INKS[0] : INKS[1];
}
