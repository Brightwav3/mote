const R = 92;
const VIEWBOX = "-150 -150 300 300";
let stageSeq = 0;

/* One renderer, used for both the live creature and the little previews in
   the picker. A preview is just a frozen Mote, which is why the shape tiles
   look like the thing you are actually choosing.

   Draw order is the whole trick of the animations: the half of an orbit ring
   with z < 0 goes in `arcsBack`, BEFORE the body, so the body occludes it. Put
   every arc in front and the rings stop being orbits and become a doodle. */
/* ADR 0005: the back/front split and the notch mask exist for the animation
   catalogue. docs/decisions/0005-animation-catalogue.md */
const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};
const add = (parent, tag, attrs) => { const n = svgEl(tag, attrs); parent.appendChild(n); return n; };

/* Built node by node rather than from a markup string. `innerHTML` was shorter
   and it made the render layer impossible to test without a browser: the whole
   thing hung on an HTML parser. With the tree built through `createElementNS`
   and the references kept as they are made, ~40 lines of stub DOM in a test
   are enough to run a real frame. ADR 0006:
   docs/decisions/0006-embeddable-agent-avatar.md */
function makeStage(host, opts = {}) {
  const uid = `s${++stageSeq}`;
  const svg = add(host, "svg", {
    viewBox: VIEWBOX,
    "aria-hidden": opts.decorative ? "true" : "false",
  });

  const defs = add(svg, "defs");
  const mask = add(defs, "mask", {
    id: `${uid}-notch`, maskUnits: "userSpaceOnUse",
    x: "-150", y: "-150", width: "300", height: "300",
  });
  add(mask, "rect", { x: "-150", y: "-150", width: "300", height: "300", fill: "#fff" });
  const notch = add(mask, "circle", { r: "0", fill: "#000" });

  const wrap = add(svg, "g");
  const arcsBack = add(wrap, "g");
  const dotsBack = add(wrap, "g");
  const bodyG = add(wrap, "g", { mask: `url(#${uid}-notch)` });
  const body = add(bodyG, "path");
  const eyes = [0, 1].map(() => {
    const outer = add(wrap, "g");
    const inner = add(outer, "g");
    return { outer, inner, rect: add(inner, "rect", { rx: "9" }) };
  });
  const arcsFront = add(wrap, "g");
  const dotsFront = add(wrap, "g");
  const pip = add(wrap, "circle", { r: "0", fill: NOTIF_BLUE });

  return {
    uid, svg, defs, notch, pip,
    arcsBack, arcsFront, dotsBack, dotsFront,
    wrap, bodyG, body, eyes,
    dotPool: [], arcPool: new Map(),
  };
}

/* Empty an element without `innerHTML`, for the same reason. */
function clearHost(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

/* Decor nodes are pooled rather than rebuilt: a state can ask for ten dots on
   one frame and none on the next, and churning the DOM at 60Hz for that is a
   waste of the only budget this page has. */
function dotNode(st, i) {
  if (!st.dotPool[i]) {
    const g = svgEl("path");
    st.dotPool[i] = g;
  }
  return st.dotPool[i];
}

function arcNodes(st, id) {
  let n = st.arcPool.get(id);
  if (!n) {
    const grad = svgEl("linearGradient");
    grad.setAttribute("id", `${st.uid}-${id}`);
    grad.setAttribute("gradientUnits", "userSpaceOnUse");
    const stops = [0, 0.5, 1].map((o) => {
      const s = svgEl("stop");
      s.setAttribute("offset", String(o));
      grad.appendChild(s);
      return s;
    });
    st.defs.appendChild(grad);
    const mk = () => {
      const p = svgEl("path");
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", `url(#${st.uid}-${id})`);
      p.setAttribute("stroke-linecap", "round");
      return p;
    };
    n = { grad, stops, back: mk(), front: mk() };
    st.arcPool.set(id, n);
  }
  return n;
}

/* Draw one frame into a stage. Pure: hand it a pose, it renders that pose and
   decides nothing. The previews call it once; the live view calls it at 60Hz. */
function drawStage(st, pose) {
  /* A posed silhouette changes every frame, so it is rebuilt every frame. A
     resting body does not: writing 9 KB of identical path data sixty times a
     second is the kind of thing that makes a page feel heavy for no gain. */
  if (pose.sil) {
    st.body.setAttribute("d", silPath(pose.sil, R));
    st.shownBody = null;
  } else if (st.shownBody !== pose.body.id) {
    st.body.setAttribute("d", profilePath(pose.body, R));
    st.shownBody = pose.body.id;
  }
  st.body.setAttribute("fill", pose.paint);
  st.wrap.setAttribute("transform", `translate(${r2(pose.x)},${r2(pose.y)})`);

  /* The gaze reaching this point is ABSOLUTE and already composed: the
     expression's own measured head pose, mixed with wherever attention is
     pointing. Rendering decides nothing about where he looks. */
  const frames = eyeFrames(pose.gaze.yaw, pose.gaze.pitch, pose.gaze.roll, pose.split, R);
  const ink = eyeInkFor(pose.paint);
  const alpha = pose.eyeAlpha === undefined ? 1 : pose.eyeAlpha;
  frames.forEach((p, i) => {
    const n = st.eyes[i];
    const e = pose.eyes[i];
    const w = e.w * R, h = e.h * R;
    const lidScale = 0.06 + 0.94 * clamp(e.open * pose.blinkLid);
    n.outer.setAttribute("transform", `translate(${r2(p.x)},${r2(p.y)}) scale(1,${r2(lidScale)})`);
    n.inner.setAttribute("transform",
      `matrix(${r2(p.a)},${r2(p.b)},${r2(p.c)},${r2(p.d)},0,0) rotate(${r2(e.tilt)})`);
    n.rect.setAttribute("x", r2(-w / 2)); n.rect.setAttribute("y", r2(-h / 2));
    n.rect.setAttribute("width", r2(w)); n.rect.setAttribute("height", r2(h));
    n.rect.setAttribute("rx", r2(Math.min(w, h) / 2));
    n.rect.setAttribute("fill", ink);
    n.outer.setAttribute("opacity", r2(clamp((p.depth - 0.02) * 9, 0, 1) * alpha));
  });

  drawDecor(st, pose);
}

function drawDecor(st, pose) {
  const dots = pose.dots || [];
  const arcs = pose.arcs || [];
  const host = pose.dotsBehind ? st.dotsBack : st.dotsFront;

  st.dotPool.forEach((n) => { if (n.parentNode) n.setAttribute("opacity", "0"); });
  dots.forEach((dot, i) => {
    const n = dotNode(st, i);
    if (n.parentNode !== host) host.appendChild(n);
    /* A dot may carry its own outline — the teardrop of the leaning "!" is not
       a disc — in which case `r` is not used for the path at all. */
    if (dot.d) {
      n.setAttribute("d", dot.d);
      n.setAttribute("transform",
        `translate(${r2(dot.x * R)},${r2(dot.y * R)}) rotate(${r2(dot.rot || 0)}) scale(${R})`);
    } else {
      const r = dot.r * R;
      n.setAttribute("d", `M${r2(-r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(r * 2)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-r * 2)} 0Z`);
      n.setAttribute("transform", `translate(${r2(dot.x * R)},${r2(dot.y * R)})`);
    }
    /* Depth haze: the burst particles pass behind the core, and fading them
       toward the page rather than shrinking them is what sells that. */
    n.setAttribute("fill", dot.color || pose.paint);
    n.setAttribute("opacity", r2(dot.opacity * (dot.depth === undefined ? 1 : lerp(0.35, 1, dot.depth))));
  });

  st.arcPool.forEach((n) => { n.back.setAttribute("opacity", "0"); n.front.setAttribute("opacity", "0"); });
  for (const spec of arcs) {
    const a = arcRender(spec.seed, spec.t, R, spec.id, spec.opacity);
    const n = arcNodes(st, spec.id);
    if (n.back.parentNode !== st.arcsBack) st.arcsBack.appendChild(n.back);
    if (n.front.parentNode !== st.arcsFront) st.arcsFront.appendChild(n.front);
    n.grad.setAttribute("x1", a.grad.x1); n.grad.setAttribute("y1", a.grad.y1);
    n.grad.setAttribute("x2", a.grad.x2); n.grad.setAttribute("y2", a.grad.y2);
    a.grad.stops.forEach((c, i) => n.stops[i].setAttribute("stop-color", c));
    n.back.setAttribute("d", a.back); n.front.setAttribute("d", a.front);
    n.back.setAttribute("stroke-width", r2(a.width));
    n.front.setAttribute("stroke-width", r2(a.width));
    n.back.setAttribute("opacity", r2(a.opacity));
    n.front.setAttribute("opacity", r2(a.opacity));
  }

  /* The pip is not drawn on top of the body: the body is notched out around
     it, concentrically, with a constant margin. */
  const nf = pose.notif;
  st.notch.setAttribute("r", nf ? r2(nf.notch * R) : 0);
  if (nf) {
    st.notch.setAttribute("cx", r2(nf.x * R));
    st.notch.setAttribute("cy", r2(nf.y * R));
    st.pip.setAttribute("cx", r2(nf.x * R));
    st.pip.setAttribute("cy", r2(nf.y * R));
  }
  st.pip.setAttribute("r", nf ? r2(nf.r * R) : 0);
}
