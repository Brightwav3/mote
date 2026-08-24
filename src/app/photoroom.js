/* ── THE PHOTOROOM ────────────────────────────────────────────────────────
   A still portrait, for when you want the creature as an icon rather than as
   a creature. You pick one of the seventeen faces, it holds it, and you take
   the SVG away.

   Nothing here is alive, and that is the whole feature. The live view and the
   maker preview both run on the animation clock — the creature looks about,
   it blinks, its mood drifts. An avatar file that was captured mid-blink or
   mid-saccade is a bad file, and there is no way to catch the moment you
   wanted by pressing a button at the right instant. So the photoroom does not
   tick at all: `frame()` in app/loop.js draws neither the preview nor the
   creature while this view is open, and every pose reaching the renderer here
   is composed directly from a face rather than sampled out of a running one.

   The pose is the maker's still treatment, not the expression's raw head pose:
   `gazeOf(pose, { yaw: 0, pitch: 0 })` turns him to face the viewer and leaves
   a fifth of the expression's own carriage plus all of its roll. An icon that
   is looking off at the floor — which is where `neutral`'s measured 28 degrees
   of yaw and pitch actually point — is not an icon of anything. */
const photoView = document.getElementById("photo");
const photoHost = document.getElementById("photo-preview");
const photoFacesEl = document.getElementById("photo-faces");
const photoStage = makeStage(photoHost, { decorative: true, theme: DEMO_THEME });

/* The face ids are the vocabulary, not prose: "unimpressed" is the name of
   that pose everywhere else in this project, so it is the name on the tile. */
const photoLabel = (id) => id.charAt(0).toUpperCase() + id.slice(1);

const photoPick = { face: FACES.find((f) => f.id === "attentive") || FACES[0] };

/* One pose, held. No blink phase, no gaze wander, no mood — the arguments the
   live renderer varies are all pinned to their resting values. */
function photoPoseOf(face) {
  const pose = poseOf(face);
  return {
    x: 0, y: 0, blinkLid: 1,
    gaze: gazeOf(pose, { yaw: 0, pitch: 0 }),
    split: pose.split, eyes: pose.eyes,
  };
}

/* Body and colour are whatever the creature actually is. You are photographing
   him, not designing a second one — that is what the maker is for. */
const photoSkin = () => avatar.skin();

let photoTiles = [];

function drawPhoto() {
  const skin = photoSkin();
  const body = BODY_BY_ID[skin.body] || BODIES[0];
  drawStage(photoStage, { ...photoPoseOf(photoPick.face), body, paint: skin.paint });
  photoTiles.forEach((t) => t.paint(body, skin.paint));
}

/* Every tile is the real renderer holding the real pose, at thumbnail size —
   the same bargain the shape picker makes. What you see is what saves. */
photoTiles = FACES.map((face) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = photoLabel(face.id);
  btn.setAttribute("aria-label", photoLabel(face.id));
  btn.setAttribute("aria-pressed", String(face === photoPick.face));
  const st = makeStage(btn, { decorative: true, theme: DEMO_THEME });
  const paint = (body, hex) => drawStage(st, { ...photoPoseOf(face), body, paint: hex });
  btn.addEventListener("click", () => {
    photoPick.face = face;
    photoTiles.forEach((t) => t.btn.setAttribute("aria-pressed", String(t.face === face)));
    photoNameEl.textContent = photoLabel(face.id);
    photoResetOut();
    drawPhoto();
  });
  photoFacesEl.appendChild(btn);
  return { btn, face, paint, stage: st };
});

const photoNameEl = document.getElementById("photo-face-name");

window.addEventListener("mote-theme", (event) => {
  photoStage.theme = event.detail;
  photoTiles.forEach((tile) => { tile.stage.theme = event.detail; });
  drawPhoto();
});

/* ── taking it away ───────────────────────────────────────────────────────
   The stage's viewBox is already square and centred (-150 -150 300 300), so
   the export is a crop of nothing: the file is the frame you are looking at.

   Serialised from the live node rather than rebuilt from a template, for the
   same reason the tiles are real stages. A second code path that emits SVG
   would drift from the renderer, and the drift would only ever show up in
   somebody else's saved file.

   `width`/`height` are a default size for a viewer that insists on one; the
   viewBox means it scales to anything. `xmlns` is required — the document
   copy inherits the namespace implicitly, a standalone file cannot. */
const PHOTO_PX = 512;

function photoSvgText() {
  const skin = photoSkin();
  const clone = photoStage.svg.cloneNode(true);
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(PHOTO_PX));
  clone.setAttribute("height", String(PHOTO_PX));
  /* On the page it is decoration beside a heading that already says the name.
     On its own it is the only thing in the file, so it gets to be an image. */
  clone.removeAttribute("aria-hidden");
  clone.setAttribute("role", "img");
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = `${skin.name}, ${photoLabel(photoPick.face.id).toLowerCase()}`;
  clone.insertBefore(title, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

const photoSlug = (s) => (s || "mote").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "") || "mote";

/* Two ways out, because there are two places this page runs.

   Served as a file, a download link is the right answer, and a `data:` URI is
   a better one than a Blob URL: the CSP names its allowed hosts, and a data
   URI needs no object store to create, revoke, or leak.

   Embedded in a sandboxed viewer, a download the page starts itself is inert —
   the anchor is clicked, nothing arrives, and the button silently lies. So the
   markup is also offered directly. The clipboard is tried first and the
   textarea is the fallback rather than the other way round, because a
   permissions policy can refuse the clipboard without throwing anywhere we can
   see it, and a visible box of text always works. */
const photoOutEl = document.getElementById("photo-out");
const photoSaveBtn = document.getElementById("photo-save");
const photoCopyBtn = document.getElementById("photo-copy");

function photoReveal(text) {
  photoOutEl.value = text;
  photoOutEl.hidden = false;
  photoOutEl.focus();
  photoOutEl.select();
}

/* Framed means embedded — an artifact viewer, a docs page, an iframe of any
   kind — and an embedded page is not permitted to hand anybody a file: the
   anchor is clicked, the click is swallowed, and the button has lied. Rather
   than ship a control that does nothing wherever this page is embedded, the
   primary action becomes the one that works there. Served as a file, at the
   top level, it stays a download. */
const photoFramed = (() => {
  try { return window.top !== window.self; } catch { return true; }
})();

photoSaveBtn.addEventListener("click", () => {
  if (photoFramed) { photoReveal(photoSvgText()); return; }
  const skin = photoSkin();
  const a = document.createElement("a");
  a.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(photoSvgText());
  a.download = `${photoSlug(skin.name)}-${photoPick.face.id}.svg`;
  a.click();
});
if (photoFramed) photoSaveBtn.textContent = "Show the SVG";

photoCopyBtn.addEventListener("click", () => {
  const text = photoSvgText();
  const done = () => { photoCopyBtn.textContent = "Copied"; };
  const fall = () => { photoReveal(text); photoCopyBtn.textContent = "Copy the markup"; };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, fall);
  } else {
    fall();
  }
});

/* A different face is a different file: whatever was offered is now stale. */
function photoResetOut() {
  photoOutEl.hidden = true;
  photoOutEl.value = "";
  photoCopyBtn.textContent = "Copy the markup";
}

document.getElementById("photo-open").addEventListener("click", () => {
  liveView.classList.remove("on");
  makeView.classList.remove("on");
  photoView.classList.add("on");
  photoNameEl.textContent = photoLabel(photoPick.face.id);
  photoResetOut();
  drawPhoto();
});

document.getElementById("photo-back").addEventListener("click", () => {
  photoView.classList.remove("on");
  liveView.classList.add("on");
});
