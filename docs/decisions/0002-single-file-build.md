# ADR 0002: Sources are plain scripts concatenated by a manifest into one HTML file

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision owners:** Project owner

## Context

Mote is delivered as a Claude artifact: one HTML file served under a strict
Content-Security-Policy that blocks every external host except Google Fonts. No
CDN, no module graph fetched at runtime, no fetching of a sibling file. Every
byte must already be inside the document when it is published.

That is the constraint. It rules out the obvious structure — ES modules with
`import`, resolved by the browser or by a bundler — unless something inlines
them first, and inlining a module graph correctly (import order, live bindings,
cycles) is a bundler's job.

Meanwhile the file had grown past 1,300 lines of script inside a single HTML
document, which is not a repository anyone can work in.

## Decision

Sources live as **plain scripts** under `src/`, sharing one top-level scope, with
no `import` or `export`. `src/manifest.json` lists them in evaluation order, and
`build.mjs` concatenates them between `src/shell.html` and `src/shell-tail.html`
into `dist/index.html`.

Tests load the same files the same way — concatenated into one `node:vm` context
— so what is tested is what ships, not a differently-linked variant.

The build has no dependencies. `npm run check` builds and tests with nothing but
Node.

## Rejected alternatives

**ES modules plus a bundler (esbuild, rollup, vite).** The normal answer, and
sound. Rejected for the size of this project: it adds a dependency tree and a
lockfile in order to concatenate thirteen files in a fixed order, and the
artifact target means the bundler's real work — module resolution, code
splitting, tree shaking — produces nothing of value here.

**ES modules inlined by a hand-rolled resolver.** Sketched and abandoned.
Stripping `import`/`export` from a module graph is easy until it is wrong: live
bindings, cycles and name collisions all fail silently, producing a file that
loads and misbehaves. A manifest is dumber and cannot fail that way.

**Keep everything in one file.** What this replaces. Works, and is unreviewable
past about a thousand lines.

**`<script type="module">` with relative imports and no build.** Fails outright:
the artifact is a single document with no sibling files to fetch.

## Consequences

### Positive

- The shipped file is byte-reproducible from sources. The split that created
  `src/` asserted the concatenation was identical to the working file.
- No dependencies, no lockfile, no toolchain drift.
- Tests exercise the real linkage rather than a test-only one.

### Costs

- One shared scope: every top-level name is global to the bundle, so a collision
  between two modules is a silent shadow. Names must be unique project-wide.
- Order is manual. A module that uses another module's binding at load time must
  come after it in the manifest, and nothing checks that but the tests.
- No per-module isolation; tests load a group of files together.

## Enforced in

- `build.mjs`
- `src/manifest.json`
- `test/harness.mjs`
- `package.json`

## Explicit non-decisions

This does not forbid ever adopting a bundler. The justification is "thirteen
files, no dependencies, one artifact"; if Mote grows a second delivery target or
needs npm dependencies, the decision should be revisited.

It does not say the shell HTML must remain a single file. `src/shell.html` may be
split further so long as the build still emits one document.
