<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Testing

Vitest. Run `npm test`. Tests assert external behaviour, not implementation
details. See `docs/testing.md` for the convention and the two seams (route
handlers, pure logic).
