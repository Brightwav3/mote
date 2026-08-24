/* The live page is the two Bloub catalogues made tangible: still expressions
   and measured animation states, each drawn by Mote's real renderer with the
   current skin and host theme. ADR 0001 and ADR 0005 keep those source values
   pinned to Bloub; ADR 0004 supplies expression episodes and ADR 0006 the
   public avatar controls used here. See docs/decisions/0004-scripted-episodes.md,
   docs/decisions/0005-animation-catalogue.md, and
   docs/decisions/0006-embeddable-agent-avatar.md. */
const EXPRESSION_ORDER = [
  "neutral", "attentive", "surprised", "excited",
  "happy", "laughing", "angry", "sad",
  "scared", "suspicious", "confused", "curious",
  "proud", "shy", "unimpressed", "sleepy",
];
const catalogueLabel = (id) => id.charAt(0).toUpperCase() + id.slice(1);
const expressionEl = document.getElementById("expressions");
const animationEl = document.getElementById("animations");
const experimentalAnimationEl = document.getElementById("experimental-animations");
let selectedExpression = "neutral";
let selectedAnimation = "idle";

function catalogueButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "catalogue-tile";
  button.setAttribute("aria-label", label);
  const text = document.createElement("span");
  text.textContent = label;
  button.appendChild(text);
  return { button, text };
}

const expressionTiles = EXPRESSION_ORDER.map((id) => {
  const face = FACES.find((item) => item.id === id);
  const { button, text } = catalogueButton(catalogueLabel(id));
  const stage = makeStage(button, { decorative: true, theme: DEMO_THEME });
  button.appendChild(text);
  button.addEventListener("click", () => {
    selectedExpression = id;
    selectedAnimation = "";
    field.classList.remove("is-laughing", "is-surprised");
    void field.offsetWidth;
    if (id === "laughing") field.classList.add("is-laughing");
    if (id === "surprised") field.classList.add("is-surprised");
    avatar.episode([{ face: id, hold: 30 }]);
    refreshCatalogues();
  });
  expressionEl.appendChild(button);
  return { id, face, button, stage };
});

const ANIMATION_SAMPLE = {
  idle: 0.2, thinking: 0.8, wink: 0.7, wide: 0.8,
  alert: 0.85, notify: 0.8, exclaim: 0.85, sleep: 1.1,
  egg: 0.8, hexagon: 0.8, play: 0.9, orbit: 1.0, burst: 0.75, comet: 0.9,
  nod: 0.42, nope: 0.35, listening: 0.8, peek: 0.72, focus: 0.8,
  celebrate: 0.55, charge: 1, glitch: 0.62, melt: 1.1, portal: 1.2,
  magnet: 0.95,
};
const animationTiles = STATES.map((state, index) => {
  const { button, text } = catalogueButton(state.label);
  const stage = makeStage(button, { decorative: true, theme: DEMO_THEME });
  button.appendChild(text);
  button.addEventListener("click", () => {
    selectedAnimation = state.id;
    selectedExpression = "";
    field.classList.remove("is-laughing", "is-surprised");
    avatar.animate(state.id);
    refreshCatalogues();
  });
  (index < 14 ? animationEl : experimentalAnimationEl).appendChild(button);
  return { state, button, stage };
});

function refreshCatalogues() {
  const skin = avatar.skin();
  const body = skin.body === "sun" ? makeSunBody(skin.sun) : (BODY_BY_ID[skin.body] || BODIES[0]);
  for (const tile of expressionTiles) {
    const pose = poseOf(tile.face);
    drawStage(tile.stage, {
      ...photoPoseOf(tile.face), body, paint: skin.paint, theme: avatar.theme(),
    });
    tile.button.setAttribute("aria-pressed", String(tile.id === selectedExpression));
  }
  for (const tile of animationTiles) {
    const pose = tile.state.pose(ANIMATION_SAMPLE[tile.state.id] || 0.8);
    if (tile.state.baseBody) pose.sil = bodySil(body);
    drawStage(tile.stage, { ...pose, paint: skin.paint, theme: avatar.theme() });
    tile.button.setAttribute("aria-pressed", String(tile.state.id === selectedAnimation));
  }
}

window.addEventListener("mote-theme", () => refreshCatalogues());
refreshCatalogues();

const labView = document.getElementById("lab");
const labHero = document.getElementById("lab-hero");
const liveHero = document.querySelector("#live .live-hero");
const catalogues = document.querySelector("#live .catalogues");
document.getElementById("lab-open").addEventListener("click", () => {
  liveView.classList.remove("on");
  labView.classList.add("on");
  labHero.appendChild(liveHero);
  field.querySelector("svg").setAttribute("viewBox", "-240 -170 480 340");
});
document.getElementById("lab-back").addEventListener("click", () => {
  labView.classList.remove("on");
  liveView.classList.add("on");
  liveView.insertBefore(liveHero, catalogues);
  field.querySelector("svg").setAttribute("viewBox", VIEWBOX);
});

/* ── the creature as JSON ─────────────────────────────────────────────────
   `persona()` is the round trip made visible: what this panel shows is
   exactly what `Mote.mount` accepts. It is refreshed on open rather than
   every frame, because a persona only changes when you change the creature,
   and re-serialising it sixty times a second to sit unread in a folded panel
   would be a waste of the only budget this page has. */
const personaOut = document.getElementById("persona-out");
const personaPanel = personaOut.closest("details");
const personaCopy = document.getElementById("persona-copy");

const refreshPersona = () => {
  personaOut.value = JSON.stringify(avatar.persona(), null, 2);
  personaCopy.textContent = "Copy it";
};
personaPanel.addEventListener("toggle", () => { if (personaPanel.open) refreshPersona(); });

/* Embedded, the clipboard may be refused without throwing anywhere we can
   see, so selecting the text is the fallback that always works — the same
   bargain the photoroom makes. */
personaCopy.addEventListener("click", () => {
  const text = personaOut.value;
  const fall = () => { personaOut.focus(); personaOut.select(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => { personaCopy.textContent = "Copied"; }, fall);
  } else {
    fall();
  }
});
