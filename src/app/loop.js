/* ── THE DEMO PAGE ────────────────────────────────────────────────────────
   From here down, nothing is the creature: this is one integrator among
   others, and it goes through `Mote.mount` exactly like anybody else would.

   That is deliberate. A demo that reaches past the public API always ends up
   proving the API works when it does not — the page looks right and the first
   person to embed it finds the hole. Everything this page does, it does with
   the handle below. */
/* ADR 0006: this page goes through Mote.mount like anybody else would.
   docs/decisions/0006-embeddable-agent-avatar.md */
const field = document.getElementById("field");
const speechEl = document.getElementById("speech");
const moodEl = document.getElementById("mood");

const avatar = Mote.mount(field, { manual: true });
let shownMood = "";

avatar.onSay((text) => {
  speechEl.textContent = text;
  speechEl.classList.add("on");
});
avatar.onFace((id, settled, line) => {
  if (line !== shownMood && settled) { shownMood = line; moodEl.textContent = line; }
});

/* One loop for the page: the maker preview while you are still choosing, the
   creature once it exists. The avatar was mounted `manual` for exactly this —
   an embedder who has no second thing to draw just lets it run its own. */
function frame(now) {
  /* The photoroom is a still: neither the preview nor the creature is
     advanced while it is open, so the pose on screen is exactly the pose that
     saves. See src/app/photoroom.js. */
  if (photoView.classList.contains("on")) { requestAnimationFrame(frame); return; }
  if (makeView.classList.contains("on")) drawPreview(now / 1000);
  else {
    avatar.tick(now);
    if (clock > mote.speakUntil && speechEl.classList.contains("on")) {
      speechEl.classList.remove("on");
    }
  }
  requestAnimationFrame(frame);
}

/* ── you, from its side ───────────────────────────────────────────────────
   It knows where you are and does not follow you. The pointer records a
   position for the rare moments it chooses to look over, and nothing else
   about it reaches the creature. */
window.addEventListener("pointermove", (e) => {
  const r = field.getBoundingClientRect();
  avatar.pointer(
    ((e.clientX - r.left) / r.width - 0.5) * 2,
    ((e.clientY - r.top) / r.height - 0.5) * 2,
  );
});

field.addEventListener("pointerdown", () => avatar.poke());
