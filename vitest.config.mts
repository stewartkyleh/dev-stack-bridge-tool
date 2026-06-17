import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve the `@/*` path alias from tsconfig so tests can import app
    // modules the same way the app does (e.g. `@/app/lib/...`).
    tsconfigPaths: true,
  },
  test: {
    // Both seams under test run server-side: route handlers (constructed
    // `Request` → exported handler) and pure logic. No DOM is needed, so we
    // default to the Node environment. A component test can opt into jsdom
    // per-file with a `// @vitest-environment jsdom` docblock if ever needed.
    environment: "node",
  },
});
