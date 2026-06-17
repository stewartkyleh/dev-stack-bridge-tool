# Testing convention

The runner is [Vitest](https://vitest.dev). Tests run server-side in the Node
environment (see `vitest.config.mts`); the `@/*` path alias resolves from
`tsconfig.json`, so tests import app code exactly as the app does.

```bash
npm test          # run the suite once (what CI runs)
npm run test:watch # re-run on change while developing
```

CI runs the suite on every PR as a `test` job alongside `tsc --noEmit`
(`.github/workflows/main.yml`). Both must pass.

## What makes a good test here

Assert **external behaviour, not implementation details.** Do not assert
internal call order or private state.

- **Route handlers** — assert HTTP status, response headers, and persistence
  effects.
- **Pure functions** — assert input → output.

Name test files `*.test.ts` and colocate them next to the module under test
(e.g. `lib/utils.test.ts`, `app/api/.../route.test.ts`). Import `describe` /
`it` / `expect` from `vitest` explicitly rather than relying on globals.

## Two seams

**Seam 1 — Route-handler tests.** Invoke the exported handler with a
constructed `Request`. Mock the four external boundaries at the module level:

1. Clerk `auth()`,
2. the AI SDK `streamText`,
3. the Prisma client,
4. the Upstash limiter.

**Seam 2 — Pure-logic unit tests.** On modules extracted to be testable —
e.g. the stack-picker selection, the Stage 1 stream-state reducer, and the Zod
schemas. Plain input → output assertions, no mocks.

## Out of scope (for now)

Component rendering (jsdom + React Testing Library), E2E / Playwright, and any
seeded test DB or Clerk test-mode harness. A future component test can opt into
jsdom per-file with a `// @vitest-environment jsdom` docblock.
