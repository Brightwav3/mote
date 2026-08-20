/* ── THE AGENT SURFACE ────────────────────────────────────────────────────
   Everything below this line is the creature. Everything above it is a page.
   This is the seam, and it exists so that Mote can be dropped into somebody
   else's agent UI without bringing a demo with it.

   The API is deliberately written in the vocabulary of an agent's turn —
   `thinking`, `tool`, `speaking`, `needsInput`, `error` — and not in the
   vocabulary of the creature. An integrator has an agent, not a mood: asking
   them which of seventeen faces means "waiting on a tool call" is asking them
   to design the avatar, which is the part they came here not to do.

   So the mapping from agent state to choreography lives HERE, once, hardwired,
   and it is the substance of the thing. Each entry is a scripted episode in
   the sense of ADR 0004 — a written face order, optionally naming an animation
   from the catalogue — and the table is the specification.

   What the creature does BETWEEN calls is its own business: it looks around,
   drifts on slow mood weather and occasionally plays something to itself. An
   agent that never calls anything still has a face worth looking at, which is
   the entire argument for an avatar over a spinner. */
/* ADR 0006: docs/decisions/0006-embeddable-agent-avatar.md */
/* ADR 0009: docs/decisions/0009-multi-instance-agent-avatars.md */

const AGENT_ACTS = {
  /* Nothing is happening. Not a state so much as the absence of one — this
     hands the creature back to itself. */
  idle: () => { stopAnim(); epoch++; mote.awaitingTool = false; mote.hold = null; mote.episodeUntil = -9; },

  /* You are typing, or the mic is open. It attends to you and holds it. */
  listening: () => play([
    { face: "attentive", hold: 3.2, kind: "listen", look: ["viewer", 2.6] },
  ]),

  /* The model is working. The three dots ARE this state — it is the one piece
     of the catalogue that reads as computation to everybody. */
  thinking: () => play([
    { face: "neutral", hold: 0.5, kind: "think", think: 3.0 },
    { face: "neutral", hold: 2.6, anim: "thinking" },
    { face: "curious", hold: 1.6 },
  ]),

  /* A tool call: the same work, but with something outside itself involved,
     so it looks away while it waits.

     This one WAITS. A tool call has no duration in a model stream — the event
     says it began and nothing says it ended, because the result comes back in
     the next request — so the script re-arms itself until `toolResult` is
     called. A creature that looks up after a fixed 2.4s whether or not the
     tool returned is the tell that it is animation rather than status. */
  tool: (name) => {
    mote.awaitingTool = true;
    const beat = () => {
      play([
        { face: "curious", hold: 0.8, kind: "tool", look: ["away", 2.2],
          say: name ? [`${name}…`, 1400] : undefined },
        { face: "neutral", hold: 2.6, anim: "thinking" },
      ]);
      later(3.4, () => { if (mote.awaitingTool) beat(); });
    };
    beat();
  },

  /* The result came back. `ok: false` is a failed tool, which is not the same
     event as the agent failing — it looks put out, not alarmed. */
  toolResult: (ok = true) => {
    mote.awaitingTool = false;
    play(ok
      ? [{ face: "attentive", hold: 1.8 }]
      : [{ face: "unimpressed", hold: 1.6, blink: true }, { face: "attentive", hold: 1.4 }]);
  },

  /* Streaming a reply. The hold is long because speech is long; call it again
     to extend, which is what a stream does anyway. */
  speaking: (text, ms) => play([
    { face: "attentive", hold: Math.max(1.4, (ms || 2400) / 1000),
      kind: "speak", look: ["viewer", 1.8],
      say: text ? [text, ms || 2400] : undefined },
  ]),

  /* The turn landed. Pleased, then back to attending — pleased-and-stays-
     pleased reads as smug within about three turns. */
  done: () => play([
    { face: "happy", hold: 1.6, kind: "done", trace: true, blink: true },
    { face: "attentive", hold: 2.0 },
  ]),

  /* A long job finished. Worth more than `done`, and rare enough to stay
     worth it. */
  shipped: () => play([
    { face: "excited", hold: 1.6, kind: "ship", trace: true, blink: true },
    { face: "proud", hold: 2.6, look: ["viewer", 1.6] },
  ]),

  /* It needs you: a clarifying question, or permission to act. The
     exclamation mark is the whole point — it is legible across a room. */
  needsInput: (question) => play([
    { face: "attentive", hold: 2.0, kind: "ask", anim: "exclaim" },
    { face: "curious", hold: 2.6, look: ["viewer", 2.2],
      say: question ? [question, 2400] : undefined },
  ]),

  /* Something arrived while you were elsewhere. */
  notify: () => play([
    { face: "surprised", hold: 2.2, kind: "notify", anim: "notify" },
    { face: "attentive", hold: 1.6 },
  ]),

  /* It failed. Alarmed, then it owns it — the sequence matters more than
     either face: startled-then-sheepish reads as a mistake, sad alone reads
     as a sulk. */
  error: (message) => play([
    { face: "scared", hold: 2.4, kind: "error", trace: true, anim: "alert" },
    { face: "surprised", hold: 1.0, blink: true },
    { face: "shy", hold: 2.8, look: ["away", 2.4],
      say: message ? [message, 2200] : undefined },
  ]),

  /* You stopped it mid-flight. */
  interrupted: () => play([
    { face: "surprised", hold: 2.6, kind: "stop", anim: "burst" },
    { face: "attentive", hold: 1.6, look: ["viewer", 1.4] },
  ]),

  /* The session has gone quiet. Not a script: this is how the creature is
     when nobody has been here for a while, so it is expressed as absence. */
  asleep: () => {
    mote.awaitingTool = false;
    epoch++; stopAnim();
    mote.hold = null; mote.episodeUntil = -9;
    mote.lastInput = clock - 52;
    mote.cursor.has = false;
  },
};

/* Each legacy creature helper still reads the shared names `mote`, `clock`,
   `pending`, `epoch` and `anim`. A mount owns a context containing those
   mutable values; calls switch into that context for their duration. This
   keeps the plain concatenated source intact while making every handle's mood,
   attention, script queue and animation player independent. */
/* ADR 0009: docs/decisions/0009-multi-instance-agent-avatars.md */
function makeMoteRuntimeContext() {
  const previous = { mote, clock, pending, epoch, anim };
  mote = makeMoteState();
  clock = 0;
  pending = [];
  epoch = 0;
  anim = makeAnimState();
  const context = { mote, clock, pending, epoch, anim };
  mote = previous.mote; clock = previous.clock; pending = previous.pending; epoch = previous.epoch; anim = previous.anim;
  return context;
}

function withMoteRuntimeContext(context, fn) {
  const previous = { mote, clock, pending, epoch, anim };
  mote = context.mote; clock = context.clock; pending = context.pending; epoch = context.epoch; anim = context.anim;
  try {
    return fn();
  } finally {
    context.mote = mote; context.clock = clock; context.pending = pending; context.epoch = epoch; context.anim = anim;
    mote = previous.mote; clock = previous.clock; pending = previous.pending; epoch = previous.epoch; anim = previous.anim;
  }
}

/* Mount a creature into an element and get back a handle. Multiple handles are
   intentionally allowed: each has its own runtime context and animation loop. */

function mountMote(host, opts = {}) {
  if (!host) throw new Error("mote: mount needs an element");

  const context = makeMoteRuntimeContext();
  const stage = makeStage(host, { decorative: opts.decorative === true });
  let running = false;
  let raf = 0;
  let last = 0;

  const api = {
    el: host,

    /* Appearance and character. The name is not decoration: it seeds
       temperament, so the same name is always the same animal. */
    setSkin(next = {}) { return withMoteRuntimeContext(context, () => {
      /* A change of body MORPHS — it does not swap. See `morphBody`. */
      if (next.body && BODY_BY_ID[next.body]) morphBody(mote, BODY_BY_ID[next.body], clock);
      if (next.paint) mote.paint = next.paint;
      if (next.name) { mote.name = next.name; mote.temper = temperamentFor(next.name); }
      return api;
    }); },

    /* Where its attention goes. `viewer` is a fixation on where the pointer
       was when you called, NOT a follow — continuous tracking reads as a
       targeting reticle rather than as a creature. */
    look(mode = "about", seconds = 1.4) { return withMoteRuntimeContext(context, () => { look(mode, seconds); return api; }); },

    /* What it currently is. Enough to save and restore one. */
    skin: () => withMoteRuntimeContext(context, () => ({ body: mote.body.id, paint: mote.paint, name: mote.name })),

    /* ADR 0008-snapshot-boundary: Copy the last frame into a decorative host without mounting another
       creature. This is deliberately a rendered SVG snapshot, not a CSS
       approximation: the page may use it for compact presence surfaces while
       the mounted handle remains the only live Mote on the page. */
    snapshot(snapshotHost, options = {}) {
      if (!snapshotHost) throw new Error("mote: snapshot needs an element");
      clearHost(snapshotHost);
      const clone = stage.svg.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");

      /* SVG paint/mask references are document-global. Give each copy fresh
         ids so several sidebar rows cannot accidentally resolve one another's
         definitions. */
      const idMap = new Map();
      const nodes = [clone, ...clone.querySelectorAll("*")];
      nodes.filter((node) => node.getAttribute("id")).forEach((node) => {
        const oldId = node.getAttribute("id");
        const nextId = `${oldId}-snapshot-${++stageSeq}`;
        idMap.set(oldId, nextId);
        node.setAttribute("id", nextId);
      });
      nodes.forEach((node) => {
        node.getAttributeNames().forEach((name) => {
          const value = node.getAttribute(name);
          if (!value) return;
          let next = value;
          idMap.forEach((replacement, oldId) => {
            next = next.replaceAll(`#${oldId}`, `#${replacement}`);
          });
          if (next !== value) node.setAttribute(name, next);
        });
      });
      const bodyNode = nodes.find((node) => node.getAttribute("data-mote-body") === "true");
      if (bodyNode && options.body && BODY_BY_ID[options.body]) {
        bodyNode.setAttribute("d", profilePath(BODY_BY_ID[options.body], R));
      }
      if (bodyNode && options.paint) {
        bodyNode.setAttribute("fill", options.paint);
        const ink = eyeInkFor(options.paint);
        nodes.filter((node) => node.tagName === "rect" && node.getAttribute("rx") !== null)
          .forEach((node) => node.setAttribute("fill", ink));
      }
      if (options.name) clone.setAttribute("data-mote-name", options.name);
      snapshotHost.appendChild(clone);
      return api;
    },

    /* Schedule on the ANIMATION clock, not the wall clock. Exposed because an
       integrator chaining two calls — listen, then think a beat later — would
       otherwise reach for setTimeout, which fires against a frozen creature
       when the tab is hidden and takes the sequence apart. See ADR 0004. */
    after(seconds, fn) { return withMoteRuntimeContext(context, () => { later(seconds, fn); return api; }); },
    say(text, ms = 1800) { return withMoteRuntimeContext(context, () => { say(text, ms); return api; }); },

    /* One of the fourteen, by id, for anyone who wants the vocabulary
       directly. */
    animate(id, hold) { return withMoteRuntimeContext(context, () => { playAnim(id, hold); return api; }); },
    animations: () => STATES.map((s) => ({ id: s.id, label: s.label })),
    bodies: () => BODIES.map((b) => ({ id: b.id, label: b.label })),
    palette: () => PAINTS.map(([label, hex]) => ({ label, hex })),

    /* Where the creature's own voice goes, if anywhere. */
    onSay(fn) { return withMoteRuntimeContext(context, () => { mote.onSay = fn; return api; }); },
    onFace(fn) { return withMoteRuntimeContext(context, () => { mote.onFace = fn; return api; }); },

    /* A pointer position, in -1..1 across the element, for the rare moments
       it chooses to glance over. Optional: it has a life without one. */
    pointer(x, y) { return withMoteRuntimeContext(context, () => {
      mote.cursor = { x: clamp(x, -1.6, 1.6), y: clamp(y, -1.6, 1.6), has: true };
      mote.lastInput = clock;
      /* Movement is what wakes it. Anything else — a call, a tick — leaves a
         sleeping creature asleep, which is the point of it having slept. */
      if (mote.mode === "asleep") {
        look("viewer", 1.3);
        mote.valence.push(0.25); mote.arousal.push(0.85); mote.dominance.push(0.2);
        blink(clock, 0.24);
      }
      return api;
    }); },
    poke() { return withMoteRuntimeContext(context, () => {
      mote.lastInput = clock;
      react("surprised", 1.0, { kind: "poke", blink: true, power: 0.8 });
      look("viewer", 1.2);
      return api;
    }); },

    /* Drive it yourself — pass a `performance.now()`-style millisecond stamp.
       `mount` starts its own loop unless you asked for `manual`. */
    tick(now) { return withMoteRuntimeContext(context, () => { step(now); return api; }); },

    start() { return withMoteRuntimeContext(context, () => {
      if (running) return api;
      running = true;
      last = performance.now() / 1000;
      const loop = (now) => { if (!running) return; withMoteRuntimeContext(context, () => step(now)); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return api;
    }); },
    stop() { running = false; cancelAnimationFrame(raf); return api; },
    /* Put the creature back to how it was found. The state is module-level,
       so without this a remount inherits the previous avatar's mood, its
       attention mode and whatever it was in the middle of playing — which
       looks like a bug the first time an app remounts on a route change. */
    destroy() {
      api.stop();
      withMoteRuntimeContext(context, () => { cancelAnim(); resetMote(); });
      clearHost(host);
    },
  };

  /* The agent surface, bound onto the handle. Generated from the table so the
     table stays the only place a state is defined.

     Repeating a state while its episode is still running is a NO-OP, and that
     is not an optimisation. A model stream calls `thinking()` on every
     thinking delta — hundreds of times a turn — and without this the script
     restarts on every token and the creature never reaches its second beat.
     Arguments are part of the comparison, so `tool("search")` twice is one
     call but `tool("read")` after it is a new one. `speaking` is exempt: the
     text differs every time and saying the next sentence is the point. */
  /* ADR 0007: the no-op-on-repeat rule and `state()` exist because a model
     stream calls the same state on every delta.
     docs/decisions/0007-stream-adapter.md */
  let lastCall = "";
  for (const [name, fn] of Object.entries(AGENT_ACTS)) {
    api[name] = (...args) => {
      return withMoteRuntimeContext(context, () => {
        const sig = name + "|" + args.map((a) => String(a)).join("|");
        if (name !== "speaking" && sig === lastCall && clock < mote.episodeUntil) return api;
        lastCall = sig;
        mote.lastInput = clock;
        fn(...args);
        return api;
      });
    };
  }

  /* Which state it was last put into, and whether that episode is still
     playing. Enough to drive a status line without tracking it yourself. */
  api.state = () => withMoteRuntimeContext(context, () => ({
    name: lastCall.split("|")[0] || null,
    playing: clock < mote.episodeUntil,
    awaitingTool: mote.awaitingTool === true,
  }));

  /* Events straight from a model stream. See `embed/stream.js`. */
  const driver = makeStreamDriver(api);
  api.event = (e) => driver.event(e);
  api.runStream = (stream) => driver.run(stream);

  function step(now) {
    const nowS = now / 1000;
    const dt = clamp(nowS - last, 0, 0.05);
    last = nowS;
    clock += dt;
    drawFrame(stage, clock, dt);
  }

  withMoteRuntimeContext(context, () => {
    mote.ambient = opts.ambient !== false;
    api.setSkin(opts);
    drawFrame(stage, clock, 0);
  });
  if (!opts.manual) api.start();
  return api;
}

/* ── ONE FRAME ────────────────────────────────────────────────────────────
   Read the creature's state and draw it. Decides nothing that is not about
   drawing: what it wants, how it feels and what it is playing were all
   settled before this ran. */
function drawFrame(stage, t, dt) {
  runPending();
  direct(t);
  mote.mood.decay(dt);
  if (mote.hold) {
    if (t < mote.hold.until) {
      mote.valence.home = mote.hold.v;
      mote.arousal.home = mote.hold.a;
      mote.dominance.home = mote.hold.d;
    } else mote.hold = null;
  }
  mote.valence.step(dt);
  mote.arousal.step(dt);
  mote.dominance.step(dt);
  const v = clamp(mote.valence.x, -1, 1);
  const a = clamp(mote.arousal.x, 0, 1);
  const d = clamp(mote.dominance.x, -1, 1);

  if (mote.ambient) {
    mote.gaze.step(t, dt, a, (amp) => blink(t, 0.1 + amp * 0.0022));
  } else {
    /* Compact agent rows keep a living clock and state choreography, but hold
       a centered gaze so five tiny creatures do not all scan the sidebar. */
    mote.gaze.sac = null;
    mote.gaze.yaw = 0; mote.gaze.pitch = 0;
    mote.gaze.fixYaw = 0; mote.gaze.fixPitch = 0;
    mote.gaze.tgtYaw = 0; mote.gaze.tgtPitch = 0;
  }

  /* Spontaneous blinks: an alert creature blinks less, a drowsy one blinks
     slowly and often. */
  if (t > mote.nextBlink) {
    blink(t, lerp(0.30, 0.11, a));
    mote.nextBlink = t + lerp(1.6, 5.2, a) * rnd(0.6, 1.5);
  }
  const bk = (t - mote.blinkAt) / mote.blinkDur;
  let lidClose = 1;
  if (bk >= 0 && bk <= 1) lidClose = bk < 0.42 ? 1 - bk / 0.42 : (bk - 0.42) / 0.58;

  /* While a feeling is running, it wears the face that feeling NAMED. Picking
     the nearest face to the live mood instead meant it wore every expression
     the trajectory happened to pass over on the way. */
  const held = mote.hold && t < mote.hold.until ? mote.hold.face : null;
  const { mix, id: faceId, settled } = expressionFor(t, v, a, d, held);
  maybeIdleAnim(t);

  /* The body never changes size. No breath, no speech swell, no reaction
     kick — every one of those was a pulse, and pulses on a shape this simple
     read as a glitch rather than as life. What is left is a small lean in the
     direction it is looking, which only moves when its attention does. */
  const gx = Math.sin(rad(mote.gaze.yaw)), gy = -Math.sin(rad(mote.gaze.pitch));

  const rest = {
    sil: bodySilNow(mote, t),
    gaze: gazeOf(mix, mote.gaze),
    split: mix.split, eyes: mix.eyes,
  };
  /* One call a frame: it advances the animation state machine as well as
     answering it. Null means nothing is playing and nothing is still fading
     out, and the renderer can use the cached body path. */
  const pose = animPose(rest) || rest;
  /* Compact agent rows keep their identity and status choreography, but they
     must not repeatedly lean their eyes toward ambient attention targets. The
     expression and animation channels can still change the face; this final
     display gate makes the gaze direction itself stable in the row. The
     compact eye pair is fixed as well: status is represented by the body and
     its small episode marks, never by a face that jitters between expressions. */
  const displayedGaze = mote.ambient ? pose.gaze : { yaw: 0, pitch: 0, roll: 0 };
  const displayedSplit = mote.ambient ? pose.split : 16;
  const displayedEyes = mote.ambient
    ? pose.eyes
    : [{ w: 0.21, h: 0.44, tilt: 0, open: 1 }, { w: 0.21, h: 0.44, tilt: 0, open: 1 }];

  drawStage(stage, {
    /* The cached path is only safe for a settled body: mid-morph the
       silhouette changes every frame like an animation's does. */
    body: pose === rest && !bodyMorphing(mote) ? mote.body : undefined,
    sil: pose === rest && !bodyMorphing(mote) ? undefined : pose.sil,
    paint: mote.paint,
    x: gx * 7, y: gy * 5,
    gaze: displayedGaze, split: displayedSplit, eyes: displayedEyes,
    eyeAlpha: mote.ambient ? pose.eyeAlpha : 1,
    blinkLid: mote.ambient ? lidClose : 1,
    dots: pose.dots, arcs: pose.arcs, notif: pose.notif, dotsBehind: pose.dotsBehind,
  });

  if (mote.onFace) mote.onFace(faceId, settled, MOODLINE[faceId]);
}

/* The public object. In the bundled build this is what `Mote` is; the demo on
   this page uses the very same thing, which is the only way to know the seam
   holds. */
const Mote = {
  mount: mountMote,
  faces: () => FACES.map((f) => f.id),
  states: () => STATES.map((s) => ({ id: s.id, label: s.label })),
  bodies: () => BODIES.map((b) => ({ id: b.id, label: b.label })),
  palette: () => PAINTS.map(([label, hex]) => ({ label, hex })),
  describe: (name) => temperamentFor(name),
};
