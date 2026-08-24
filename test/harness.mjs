/* Loads chosen src modules into a sandbox.

   The sources are plain scripts, not ES modules, because the build target is a
   single inline <script> (ADR 0002). Tests therefore load them the same way the
   browser does — concatenated into one scope — rather than importing them. */
/* ADR 0002: loads sources the way the browser does, concatenated into one
   scope, so the tested linkage is the shipped linkage.
   docs/decisions/0002-single-file-build.md */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export async function load(parts) {
  const code = (await Promise.all(
    parts.map((p) => readFile(join(root, 'src', p), 'utf8'))
  )).join('\n')

  const sandbox = {
    Math, JSON, Array, Object, Number, String, Boolean, Map, Set, console, performance,
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  }
  vm.createContext(sandbox)
  /* The animation names only exist when the anim sources were asked for, and
     naming an undeclared binding here throws for every caller. */
  const anim = parts.some((p) => p.startsWith('anim/'))
    ? ', STATES, STATE_BY_ID, arcRender, RINGS, COMET_RIBBONS, particles, ' +
      'DOT_X, DOT_R, COMET_DOT, NOTIF_R, NOTIF_DIST'
    : ''
  vm.runInContext(code + '\n;globalThis.__exports = { ' +
    'clamp, lerp, rad, rnd, noise, createRng, eyeFrames, FACES, poseOf, lerpPose, ' +
    'expressionFor, faceDistance, CROSSFADE, Spring, BODIES, BODY_BY_ID, PROFILE_SAMPLES, ' +
    'makeSunBody, sunOptions, SUN_DEFAULTS, ' +
    'eyeInkFor, PAINTS, EASE, poseSil, circleSil, blendSil, silPath, ' +
    'eyeFitFor, radiusAt, EYE_LIMIT, EYE_FIT_FLOOR, gazeOf' + anim + ' };', sandbox)
  return sandbox.__exports
}

export const PURE = [
  'lib/math.js', 'lib/geometry.js', 'faces/expressions.js',
  'lib/springs.js', 'bodies/shapes.js', 'bodies/palette.js',
  'faces/fitting.js',
]
