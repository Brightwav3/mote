const R = 92;
const VIEWBOX = "-150 -150 300 300";

/* One renderer, used for both the live creature and the little previews in
   the picker. A preview is just a frozen Mote, which is why the shape tiles
   look like the thing you are actually choosing. */
function makeStage(host, opts = {}) {
  host.innerHTML =
    `<svg viewBox="${VIEWBOX}" aria-hidden="${opts.decorative ? "true" : "false"}">` +
    `<g class="wrap"><g class="bodyG"><path class="body"/></g>` +
    `<g class="eyeA"><g><rect rx="9"/></g></g>` +
    `<g class="eyeB"><g><rect rx="9"/></g></g></g></svg>`;
  const q = (s) => host.querySelector(s);
  return {
    wrap: q(".wrap"), bodyG: q(".bodyG"), body: q(".body"),
    eyes: [
      { outer: q(".eyeA"), inner: q(".eyeA > g"), rect: q(".eyeA rect") },
      { outer: q(".eyeB"), inner: q(".eyeB > g"), rect: q(".eyeB rect") },
    ],
  };
}

/* Draw one frame into a stage. Pure: hand it a pose, it renders that pose and
   decides nothing. The previews call it once; the live view calls it at 60Hz. */
function drawStage(st, pose) {
  /* Only touch the `d` attribute when the silhouette actually changed —
     writing 9 KB of path data 60 times a second for no reason is the kind of
     thing that makes a page feel heavy for no visible gain. */
  if (st.shownBody !== pose.body.id) {
    st.body.setAttribute("d", profilePath(pose.body, R));
    st.shownBody = pose.body.id;
  }
  st.body.setAttribute("fill", pose.paint);
  st.bodyG.setAttribute("transform", `scale(${r2(pose.sx)},${r2(pose.sy)})`);
  st.wrap.setAttribute("transform", `translate(${r2(pose.x)},${r2(pose.y)})`);

  /* The expression's OWN head pose, verbatim — Bloub's measured yaw, pitch,
     roll and split, at full strength and unscaled. Earlier this dropped yaw
     entirely and applied roll and pitch at two thirds and a half, so nothing
     rendered as the expression it claimed to be: `neutral` in particular is
     specified at (28.49, 28.62, -13) and was being drawn at (0, 0, 0), which
     is a different face.

     Attention rides on top as a bounded offset. It has to be bounded: these
     poses put the eyes near the edge of the sphere already, and an unclamped
     look would push them round the back. So he looks about within ±16° of
     whatever his expression is doing, and the expression is what you see. */
  const frames = eyeFrames(
    pose.mix.yaw + clamp(pose.lookYaw, -16, 16),
    pose.mix.pitch + clamp(pose.lookPitch, -11, 11),
    pose.mix.roll,
    pose.mix.split, R);
  const ink = eyeInkFor(pose.paint);
  frames.forEach((p, i) => {
    const n = st.eyes[i];
    const e = pose.mix.eyes[i];
    const w = e.w * R, h = e.h * R;
    const tilt = e.tilt;
    const lidScale = 0.06 + 0.94 * clamp(e.open * pose.blinkLid);
    n.outer.setAttribute("transform", `translate(${r2(p.x)},${r2(p.y)}) scale(1,${r2(lidScale)})`);
    n.inner.setAttribute("transform",
      `matrix(${r2(p.a)},${r2(p.b)},${r2(p.c)},${r2(p.d)},0,0) rotate(${r2(tilt)})`);
    n.rect.setAttribute("x", r2(-w / 2)); n.rect.setAttribute("y", r2(-h / 2));
    n.rect.setAttribute("width", r2(w)); n.rect.setAttribute("height", r2(h));
    n.rect.setAttribute("rx", r2(Math.min(w, h) / 2));
    n.rect.setAttribute("fill", ink);
    n.outer.setAttribute("opacity", r2(clamp((p.depth - 0.02) * 9, 0, 1)));
  });
}

/* ── TEMPERAMENT ──────────────────────────────────────────────────────────
   Every Mote is a different animal, and which animal is decided by its name.
   A string hash seeds a small PRNG, so "Bo" is always the same creature — the
   same baseline, the same volatility, the same appetite for looking at you.
   That is what makes the maker page mean something: you are not picking a
   skin, you are drawing a character.                                       */