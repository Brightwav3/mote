/* ── THE DECK ─────────────────────────────────────────────────────────────
   Nine things an agent does, driven entirely through the PUBLIC API — these
   are `avatar.thinking()`, `avatar.tool("search")`, `avatar.error(...)` and
   nothing else. That is the point of the page: if a button here needs to
   reach past `Mote.mount` to look right, the API is short of something an
   integrator will need on their first afternoon.

   Nothing here is an agent. There is no model, no tool call and no work — the
   whole point is the CREATURE, and what an agent's turn gives it is a reason
   to wear each face in an order that means something. A face sequence with a
   cause reads as a mind; the same sequence on a button marked "sad" reads as
   a menu. */
/* ADR 0004: the face order behind each of these is the specification, and it
   lives in the act table, not here. docs/decisions/0004-scripted-episodes.md
   ADR 0006: the demo is an integrator, not an insider.
   docs/decisions/0006-embeddable-agent-avatar.md
   ADR 0005: the animation row below plays the ported catalogue.
   docs/decisions/0005-animation-catalogue.md */
const ACTS = [
  ["Give it a task", () => { avatar.listening(); avatar.after(1.0, () => avatar.thinking()); }],
  ["Call a tool", () => avatar.tool("search")],
  ["Stream a reply", () => avatar.speaking("here is what I found.", 2600)],
  ["Finish the turn", () => avatar.done()],
  ["Ask for permission", () => avatar.needsInput("may I?")],
  ["Hit an error", () => avatar.error("...that was me.")],
  ["Interrupt it", () => avatar.interrupted()],
  ["Background result", () => avatar.notify()],
  ["Ship the big one", () => avatar.shipped()],
  ["Leave it be", () => avatar.asleep()],
];
const acts = document.getElementById("acts");
ACTS.forEach(([label, fn]) => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = label;
  b.addEventListener("click", fn);
  acts.appendChild(b);
});

/* ── making one ───────────────────────────────────────────────────────────  */
/* ── the catalogue, to look at ────────────────────────────────────────────
   Fourteen buttons and one that plays the lot in the order the reference
   video cut them. These are not reactions: they carry no mood trace and no
   speech, they just play. Starting one cancels whatever else was playing,
   which is why they are all `playAnim` and never queued. */
/* ADR 0005: docs/decisions/0005-animation-catalogue.md */
const animsEl = document.getElementById("anims");
avatar.animations().forEach((s) => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = s.label;
  b.addEventListener("click", () => avatar.animate(s.id));
  animsEl.appendChild(b);
});
const allBtn = document.createElement("button");
allBtn.type = "button"; allBtn.textContent = "Play them all";
allBtn.addEventListener("click", () => playAnimSequence());
animsEl.appendChild(allBtn);
