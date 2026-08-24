const makeView = document.getElementById("make");
const liveView = document.getElementById("live");
const previewHost = document.getElementById("preview");
const nameInput = document.getElementById("name");
const givenEl = document.getElementById("given");

/* ADR 0011: the maker edits the same sun object carried by the public skin. */
const draft = { body: BODIES[0], paint: PAINTS[0][1], sun: sunOptions() };
const preview = makeStage(previewHost, { decorative: true, theme: DEMO_THEME });

/* The preview and every tile are the real renderer holding a still pose, so
   what you pick is exactly what you get. */
const REST_FACE = poseOf(FACES.find((f) => f.id === "attentive"));
const STILL = {
  x: 0, y: 0, blinkLid: 1,
  gaze: gazeOf(REST_FACE, { yaw: 0, pitch: 0 }),
  split: REST_FACE.split, eyes: REST_FACE.eyes,
};
/* The preview breathes the same engine, cut right down: it looks about and
   it blinks, and nothing else. No moods, no reactions, no drifting weather —
   you are choosing a body here, not meeting him yet. But a specimen frozen
   dead on the slab is a poor advertisement for a creature, so he gets eyes
   that work. */
/* `body`/`bodyFrom`/`bodyAt` are the same three fields the creature carries,
   so the preview morphs between shapes with the identical code — picking a
   tile bends one silhouette into the next rather than cutting to it. */
const sprout = {
  gaze: new Gaze(), blinkAt: -9, blinkDur: 0.16, nextBlink: 1.4, nextPlace: 0,
  body: BODIES[0], bodyFrom: null, bodyAt: -9, t: 0,
};

/* Hand the renderer a silhouette while the shape is travelling and the plain
   body once it has arrived — a settled body keeps its cached path. */
const previewShape = () => (bodyMorphing(sprout)
  ? { sil: bodySilNow(sprout, sprout.t) }
  : { body: sprout.body });

function drawPreview(t) {
  if (t === undefined) {
    drawStage(preview, { ...STILL, ...previewShape(), paint: draft.paint });
    return;
  }
  sprout.t = t;

  if (t > sprout.nextPlace) {
    sprout.nextPlace = t + rnd(1.1, 3.0);
    const q = PLACES[Math.floor(Math.random() * PLACES.length)];
    sprout.gaze.aim(q.y * 0.7 + rnd(-6, 6), q.p * 0.7 + rnd(-4, 4));
  }
  sprout.gaze.step(t, 1 / 60, 0.5, () => { sprout.blinkAt = t; sprout.blinkDur = 0.15; });

  if (t > sprout.nextBlink) {
    sprout.blinkAt = t; sprout.blinkDur = 0.2;
    sprout.nextBlink = t + rnd(2.2, 5.4);
  }
  const bk = (t - sprout.blinkAt) / sprout.blinkDur;
  let lid = 1;
  if (bk >= 0 && bk <= 1) lid = bk < 0.42 ? 1 - bk / 0.42 : (bk - 0.42) / 0.58;

  const gx = Math.sin(rad(sprout.gaze.yaw)), gy = -Math.sin(rad(sprout.gaze.pitch));
  drawStage(preview, {
    ...STILL, ...previewShape(), paint: draft.paint,
    x: gx * 7, y: gy * 5,
    gaze: gazeOf(REST_FACE, sprout.gaze),
    blinkLid: lid,
  });
}

const shapesEl = document.getElementById("shapes");
const tiles = BODIES.map((b) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", b.label);
  btn.title = b.label;
  btn.setAttribute("aria-pressed", String(b === draft.body));
  const st = makeStage(btn, { decorative: true, theme: DEMO_THEME });
  const paint = () => drawStage(st, { ...STILL, body: b, paint: draft.paint });
  paint();
  btn.addEventListener("click", () => {
    draft.body = b;
    morphBody(sprout, b.id === "sun" ? makeSunBody(draft.sun) : b, sprout.t);
    tiles.forEach((tb) => tb.btn.setAttribute("aria-pressed", String(tb.body === b)));
    sunControls.hidden = b.id !== "sun";
    drawPreview();
  });
  shapesEl.appendChild(btn);
  return { btn, body: b, paint, stage: st };
});

const sunControls = document.getElementById("sun-controls");
const sunInputs = [...sunControls.querySelectorAll("input")];
function syncSunControls() {
  for (const input of sunInputs) input.value = draft.sun[input.name];
  sunControls.hidden = draft.body.id !== "sun";
}
sunInputs.forEach((input) => input.addEventListener("input", () => {
  draft.sun = sunOptions({ ...draft.sun, [input.name]: Number(input.value) });
  const body = makeSunBody(draft.sun);
  draft.body = BODY_BY_ID.sun;
  /* Petal sliders edit one body; treating each input event as a body change
     collapses unlike ray profiles through the core before they settle. */
  sprout.body = body;
  sprout.bodyFrom = null;
  sprout.bodyAt = sprout.t;
  drawPreview();
}));
syncSunControls();

const coloursEl = document.getElementById("colours");
const dots = PAINTS.map(([name, hex]) => {
  const btn = document.createElement("button");
  btn.type = "button"; btn.style.background = hex;
  btn.title = name; btn.setAttribute("aria-label", name);
  btn.setAttribute("aria-pressed", String(hex === draft.paint));
  btn.addEventListener("click", () => {
    draft.paint = hex;
    dots.forEach((d) => d.setAttribute("aria-pressed", String(d.style.background === btn.style.background)));
    tiles.forEach((tb) => tb.paint());
    drawPreview();
  });
  coloursEl.appendChild(btn);
  return btn;
});

drawPreview();

window.addEventListener("mote-theme", (event) => {
  preview.theme = event.detail;
  tiles.forEach((tile) => { tile.stage.theme = event.detail; tile.paint(); });
  drawPreview();
});

const backBtn = document.getElementById("back");
const hatchBtn = document.getElementById("hatch");
let hasHatched = false;

function openMaker() {
  liveView.classList.remove("on");
  makeView.classList.add("on");
  hatchBtn.textContent = hasHatched ? "Save changes" : "Bring it to life";
  backBtn.hidden = !hasHatched;
  drawPreview();
}

/* Say who he will be, in a sentence, before you commit to him. Drawn from the
   same numbers that actually drive him — this is a description, not flavour
   text bolted on the side. */
const TRAITS = [
  (T) => (T.baseA > 0.56 ? "lively" : T.baseA < 0.44 ? "placid" : null),
  (T) => (T.baseV > 0.26 ? "sunny" : T.baseV < 0.04 ? "solemn" : null),
  (T) => (T.baseD > 0.22 ? "bold" : T.baseD < -0.14 ? "timid" : null),
  (T) => (T.volatility > 1.18 ? "excitable" : T.volatility < 0.82 ? "even-tempered" : null),
  (T) => (T.curiosity > 1.2 ? "endlessly curious" : T.curiosity < 0.78 ? "incurious" : null),
  (T) => (T.sociability > 1.35 ? "fond of company" : T.sociability < 0.6 ? "private" : null),
  (T) => (T.moodGain > 1.3 ? "quick to take things to heart" : null),
];
const temperEl = document.getElementById("temper");

function describe(name) {
  const T = temperamentFor(name || "Mote");
  const traits = TRAITS.map((f) => f(T)).filter(Boolean).slice(0, 3);
  const who = (name || "").trim() || "It";
  if (!traits.length) return `${who} will be a fairly ordinary sort.`;
  const list = traits.length === 1 ? traits[0]
    : traits.slice(0, -1).join(", ") + " and " + traits[traits.length - 1];
  return `${who} will be ${list}.`;
}
const refreshTemper = () => { temperEl.textContent = describe(nameInput.value); };
nameInput.addEventListener("input", refreshTemper);
refreshTemper();

function hatch() {
  const first = !hasHatched;
  hasHatched = true;
  const name = (nameInput.value || "").trim() || "Mote";
  avatar.setSkin({ body: draft.body.id, paint: draft.paint, name, sun: draft.sun });
  refreshCatalogues();
  givenEl.textContent = name;
  document.title = name;
  makeView.classList.remove("on");
  liveView.classList.add("on");
  try { localStorage.setItem("mote", JSON.stringify({ body: draft.body.id, paint: draft.paint, name, sun: draft.sun })); } catch {}

  if (!first) return;   // coming back from an edit: do not re-introduce it

  /* It was already busy before you arrived; it notices you a beat later. */
  avatar.look("about", 1.9);
  avatar.after(1.9, () => avatar.notify());
}
document.getElementById("hatch").addEventListener("click", hatch);
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") hatch(); });

document.getElementById("change").addEventListener("click", openMaker);
backBtn.addEventListener("click", () => {
  /* Abandoning an edit puts back what he actually is, not the half-made draft. */
  const was = avatar.skin();
  draft.body = BODY_BY_ID[was.body]; draft.paint = was.paint; draft.sun = sunOptions(was.sun);
  nameInput.value = was.name;
  syncPickers();
  makeView.classList.remove("on");
  liveView.classList.add("on");
});

function syncPickers() {
  /* Snap rather than morph: this is "put back what it actually is", not a
     choice the person just made. */
  sprout.body = draft.body; sprout.bodyFrom = null;
  tiles.forEach((tb) => { tb.btn.setAttribute("aria-pressed", String(tb.body === draft.body)); tb.paint(); });
  dots.forEach((d, i) => d.setAttribute("aria-pressed", String(PAINTS[i][1] === draft.paint)));
  syncSunControls();
  refreshTemper();
  drawPreview();
}

/* Somebody who already made one should meet it, not the form. */
try {
  const saved = JSON.parse(localStorage.getItem("mote") || "null");
  if (saved && BODY_BY_ID[saved.body]) {
    draft.body = BODY_BY_ID[saved.body];
    draft.paint = saved.paint;
    draft.sun = sunOptions(saved.sun);
    nameInput.value = saved.name || "";
    syncPickers();
    hatch();
  }
} catch {}

requestAnimationFrame(frame);
