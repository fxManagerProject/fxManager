# packages/ui

Shared ShadCN-style React 19 primitives (Radix, Tailwind 4, `cn()` from `lib/utils`), consumed by `apps/webpanel`.

- Exports are path-based: `@fxmanager/ui/components/<name>`, `@fxmanager/ui/lib/*`, `@fxmanager/ui/hooks/*` and `@fxmanager/ui/globals.css`. A new `src/components/<name>.tsx` is immediately importable as `components/<name>`.
- Keep components presentational: props in, markup out, `className` forwarded through `cn()`, `data-slot` attributes preserved. No routing, fetching, auth, fxmanager business logic or app-specific copy.
- Follow the existing shape: function components, named exports at the bottom, `React.ComponentProps<'div'>`-style prop typing, and `class-variance-authority` for variants.
- Style with the design tokens in `src/styles/globals.css` (background, card, muted, chart and sidebar variables) and Tailwind utilities. Keep light/dark parity; avoid literal colours, inline styles and one-off CSS.
- Changes are shared: check `apps/webpanel` usages when renaming props or changing defaults, and update them in the same change.
- There is no component test harness; `tsc --noEmit` and Biome are the checks, plus manual verification in the webpanel when the visual result matters.
