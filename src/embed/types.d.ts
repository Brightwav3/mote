/* ADR 0009: the public mount type permits independent handles.
   docs/decisions/0009-multi-instance-agent-avatars.md */
/* Hand-written, and copied to dist/ by build.mjs.

   Hand-written because the sources are plain concatenated scripts with no
   imports (ADR 0002), so nothing can generate these; and because the surface
   an integrator touches is one object with about thirty members, which is
   small enough to keep honest by hand and large enough that autocomplete is
   the difference between reading the docs and not.

   If you add a method to the handle, add it here in the same commit —
   test/agent.test.mjs checks that the twelve agent states stay in step, but
   nothing checks the rest of this file. */

/** One of the fourteen animations from the catalogue. */
export type MoteAnimation =
  | 'idle' | 'thinking' | 'wink' | 'wide' | 'alert' | 'notify' | 'exclaim'
  | 'sleep' | 'egg' | 'hexagon' | 'play' | 'orbit' | 'burst' | 'comet'

/** One of the eight silhouettes. */
export type MoteBody =
  | 'cercle' | 'galet' | 'squircle' | 'capsule'
  | 'triangle' | 'hexagone' | 'nuage' | 'goutte'

/** Where its attention goes. `viewer` fixates on where the pointer was when
 *  you called — it is not a follow. */
export type MoteLook = 'about' | 'viewer' | 'away' | 'inward'

export interface MoteSkin {
  /** Silhouette id. */
  body?: MoteBody
  /** Any CSS hex colour; `palette()` returns the twelve it was designed with. */
  paint?: string
  /** Seeds temperament — the same name is always the same animal. */
  name?: string
}

/** One beat of a written episode: a face, how long it is held, and
 *  optionally what else happens on that beat. Unknown keys are rejected —
 *  a typo is the failure this shape exists to catch. */
export interface MoteBeat {
  /** One of the seventeen; `Mote.faces()` lists them. */
  face: string
  /** Seconds, greater than 0 and at most 30. Covers exactly until the next
   *  beat begins, so there is no gap to fall through. */
  hold: number
  /** Play one of the fourteen animations for this beat. A beat that names
   *  none leaves a running animation alone rather than cutting it. */
  anim?: MoteAnimation
  /** Where its attention goes for this beat. */
  look?: [MoteLook, number]
  /** Something to say: text and how long to show it, in milliseconds. */
  say?: [string, number]
  /** Turn it inward for this many seconds. */
  think?: number
  blink?: boolean
  /** Leave a mood residue. One event, one trace — the opening beat only. */
  trace?: boolean
  /** Names the stimulus, for habituation: the same kind twice running lands
   *  softer. */
  kind?: string
}

/** How a written episode repeats.
 *
 *  `pingpong` walks back out the way it came — `a b c b` — so the join is a
 *  beat that was already there rather than a cut from the end to the start.
 *  The endpoints are not repeated. */
export type MoteEpisodeMode = 'once' | 'loop' | 'pingpong'

export interface MoteEpisodeOptions {
  /** Default `once`. */
  mode?: MoteEpisodeMode
  /** How many rounds — one pass of the whole cycle. Default is unbounded for
   *  a repeating mode. A loop needs no cancelling: the next deliberate act
   *  ends it. */
  repeat?: number
}

/** An episode in a persona: bare beats for a one-shot, or beats plus how they
 *  repeat. */
export type MoteEpisode = MoteBeat[] | (MoteEpisodeOptions & { steps: MoteBeat[] })

/** Everything that makes a creature that creature, as plain JSON.
 *  `Mote.mount(host, avatar.persona())` produces the same animal. */
export interface MotePersona extends MoteSkin {
  episodes?: Record<string, MoteEpisode>
}

export interface MoteMountOptions extends MoteSkin {
  /** Named scripts this creature carries, played by `episode(name)`. Checked
   *  at mount, so a typo in a config file surfaces when it is loaded. */
  episodes?: Record<string, MoteEpisode>
  /** Don't start an internal requestAnimationFrame loop; call `tick` yourself. */
  manual?: boolean
  /** Keep the instance alive but stop autonomous gaze and mood wandering. */
  ambient?: boolean
  /** Mark the SVG `aria-hidden` — for previews and decorative copies. */
  decorative?: boolean
}

export interface MoteSnapshotOptions extends MoteSkin {
  /** Decorative snapshots are static copies and do not own an animation loop. */
  decorative?: boolean
}

export interface MoteState {
  /** The last agent state it was put into, or null if none yet. */
  name: string | null
  /** Whether that state's episode is still playing. */
  playing: boolean
  /** Whether a `tool()` call is still waiting for its `toolResult()`. */
  awaitingTool: boolean
}

/** An event from a model stream. Shaped after the Anthropic Messages
 *  streaming events; unknown types are ignored. */
export interface MoteStreamEvent {
  type: string
  delta?: { type?: string; text?: string; stop_reason?: string }
  content_block?: { type?: string; name?: string }
  error?: { message?: string }
  [key: string]: unknown
}

/**
 * The handle returned by `Mote.mount`. Every method returns the handle, so
 * calls chain.
 *
 * The primary surface is the states of an agent's turn. Repeating a state
 * while its episode is still playing is a no-op — a token stream may call
 * `thinking()` hundreds of times a turn.
 */
export interface MoteAvatar {
  readonly el: Element

  // ── the agent's turn ────────────────────────────────────────────────────
  /** Hand it back to itself: no state, just its own life. */
  idle(): MoteAvatar
  /** You are typing, or the mic is open. */
  listening(): MoteAvatar
  /** The model is working. */
  thinking(): MoteAvatar
  /** A tool call began. WAITS until `toolResult` — a stream never says a tool
   *  finished, because the result comes back in the next request. */
  tool(name?: string): MoteAvatar
  /** The tool came back. `false` for a failed one. */
  toolResult(ok?: boolean): MoteAvatar
  /** Saying something. Call it per sentence, not per token. */
  speaking(text?: string, ms?: number): MoteAvatar
  /** The turn landed. */
  done(): MoteAvatar
  /** A long job landed — more than `done`, and worth keeping rare. */
  shipped(): MoteAvatar
  /** It needs you: a clarifying question, or permission. */
  needsInput(question?: string): MoteAvatar
  /** Something arrived while you were elsewhere. */
  notify(): MoteAvatar
  /** It failed. */
  error(message?: string): MoteAvatar
  /** You stopped it mid-flight. */
  interrupted(): MoteAvatar
  /** The session has gone quiet. */
  asleep(): MoteAvatar

  /** What it was last put into, and whether that is still playing. */
  state(): MoteState

  // ── driving it from a stream ────────────────────────────────────────────
  /** One event from a model stream. */
  event(e: MoteStreamEvent | null | undefined): MoteAvatar
  /** A whole stream: `await avatar.runStream(client.messages.stream(...))`. */
  runStream(stream: AsyncIterable<MoteStreamEvent>): Promise<MoteAvatar>

  // ── the creature directly ───────────────────────────────────────────────
  setSkin(skin: MoteSkin): MoteAvatar
  skin(): Required<MoteSkin>
  /** Schedule work on this Mote's animation clock. */
  after(seconds: number, fn: () => void): MoteAvatar
  /** ADR 0008-snapshot-boundary: copy a rendered frame for a compact decorative surface. */
  snapshot(host: Element, options?: MoteSnapshotOptions): MoteAvatar
  say(text: string, ms?: number): MoteAvatar
  look(mode?: MoteLook, seconds?: number): MoteAvatar
  /** Play one of the fourteen animations by id. */
  animate(id: MoteAnimation, hold?: number): MoteAvatar

  // ── written episodes ────────────────────────────────────────────────────
  /** Play a written script — the same beat vocabulary the built-in states
   *  are made of. Pass beats directly, or the name of one carried in the
   *  persona. Throws on a bad script, at the call, before anything plays. */
  episode(steps: MoteBeat[], opts?: MoteEpisodeOptions): MoteAvatar
  episode(name: string, opts?: MoteEpisodeOptions): MoteAvatar
  /** The names of the episodes this creature carries. */
  episodes(): string[]
  /** This creature as plain JSON, ready to mount again. */
  persona(): MotePersona
  animations(): Array<{ id: MoteAnimation; label: string }>
  bodies(): Array<{ id: MoteBody; label: string }>
  palette(): Array<{ label: string; hex: string }>

  // ── the page, from its side ─────────────────────────────────────────────
  /** Where it said something. */
  onSay(fn: ((text: string, ms: number) => void) | null): MoteAvatar
  /** Which expression it settled into, and the phrase describing it. */
  onFace(fn: ((faceId: string, settled: boolean, line: string) => void) | null): MoteAvatar
  /** Pointer position in -1..1 across the element. Optional — it has a life
   *  without one. Movement is also what wakes it from `asleep`. */
  pointer(x: number, y: number): MoteAvatar
  /** Somebody prodded it. */
  poke(): MoteAvatar

  // ── lifecycle ───────────────────────────────────────────────────────────
  /** Advance and draw one frame. Pass a `performance.now()`-style stamp. */
  tick(now: number): MoteAvatar
  start(): MoteAvatar
  stop(): MoteAvatar
  /** Stops, empties the element, and resets the creature. */
  destroy(): void
}

export interface MoteTemperament {
  baseV: number; baseA: number; baseD: number
  volatility: number; recovery: number
  curiosity: number; sociability: number; moodGain: number
}

export interface MoteStatic {
  /** Mount an independent creature into an element. Multiple handles may coexist. */
  mount(host: Element, opts?: MoteMountOptions): MoteAvatar
  faces(): string[]
  states(): Array<{ id: MoteAnimation; label: string }>
  bodies(): Array<{ id: MoteBody; label: string }>
  palette(): Array<{ label: string; hex: string }>
  /** What a name would produce, without mounting anything. */
  describe(name: string): MoteTemperament
}

declare const Mote: MoteStatic
export default Mote
export { Mote }

/**
 * A whole private copy of the library, for a host that wants to own the
 * lifetime itself. You almost certainly do not need this: `Mote.mount` already
 * calls it once per handle, which is what makes several live Motes possible.
 * ADR 0009: docs/decisions/0009-multi-instance-agent-avatars.md
 */
export declare function createMoteRuntime(): MoteStatic
