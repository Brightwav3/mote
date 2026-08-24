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

/* ADR 0012: eye ink follows the host theme as one cast-wide colour, with only
   the matching endpoint inverted so a black or white body keeps its face. */
const BLACK_BODY = "#0a0a0c";
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

function eyeInkFor(hex, theme = "light") {
  const paint = hex.toLowerCase();
  if (theme === "dark") return paint === BLACK_BODY ? INKS[1] : INKS[0];
  return paint === WHITE_BODY ? INKS[0] : INKS[1];
}
