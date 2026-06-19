<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI components

This project uses [shadcn/ui](https://ui.shadcn.com/docs/components). Reach for a
shadcn component by default before hand-rolling markup or inline-styled elements.
Installed primitives live in `components/ui/`; the full catalog (and install
commands) is at https://ui.shadcn.com/docs/components. When you need one that
isn't present yet, add it (matching the local style of the existing
`components/ui/` files) rather than reinventing it ad hoc.

## Testing

Vitest. Run `npm test`. Tests assert external behaviour, not implementation
details. See `docs/testing.md` for the convention and the two seams (route
handlers, pure logic).
