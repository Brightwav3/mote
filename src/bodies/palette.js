/* Bloub's customiser palette, exactly as published in `skins.ts`. Twelve
   paints; the eye colour is chosen per paint rather than fixed, so the pale
   ones are usable bodies too. */
/* ADR 0001: Bloub's customiser palette, unchanged.
   docs/decisions/0001-port-bloub-verbatim.md */
const PAINTS = [
  ["Ink", "#0a0a0c"], ["Brown", "#8b5e3c"], ["Red", "#e8483f"],
  ["Orange", "#f08a24"], ["Amber", "#f0b429"], ["Green", "#3ecf8e"],
  ["Turquoise", "#2fbfa0"], ["Blue", "#3b93f0"], ["Violet", "#8b5cf6"],
  ["Pink", "#e152b0"], ["Grey", "#a3a3a3"], ["Cream", "#f1efe9"],
];

/* Pick the eye colour that actually contrasts more against the body, rather
   than switching on a luminance threshold. A threshold looks equivalent and is
   not: mid-tone paints sit near the crossover, and the fixed cut chose white
   for orange at 3.48:1 when dark ink would have given 5.20:1. Measured by
   WCAG contrast ratio, best-of-two, so every paint in the palette clears 4.5.  */
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
  return contrastRatio(hex, INKS[0]) >= contrastRatio(hex, INKS[1]) ? INKS[0] : INKS[1];
}
