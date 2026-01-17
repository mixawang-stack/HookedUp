# UI/UX Standards for HookedUp

This guide defines the default UI/UX rules for all frontend work in this repo.
Use it as the baseline unless a feature requires an explicit exception.

---

## 1) Spacing and Alignment

- **Spacing scale:** use a consistent scale (8px or 10px base).
- **Common steps:** 8px, 16px, 24px, 32px, 40px.
- **Margins/padding:** keep component spacing consistent and avoid excessive whitespace.
- **Alignment:** default to left-aligned text/inputs; keep vertical alignment consistent.

## 2) Responsive Design

- **Layout:** use Flexbox/Grid for adaptive layouts.
- **Width constraints:** always set `max-width` / `min-width` to avoid over-stretching.
- **Breakpoints:** use media queries around 320, 480, 768, 1024, 1200.
- **Typography:** prefer `rem` units for scalable text.

## 3) Component Consistency

- **Buttons:** consistent size, radius, color; clear primary vs secondary states.
- **Forms:** consistent input sizes; labels and error text must be readable.
- **Modals:** centered; responsive sizing; clear CTA and dismiss actions.

## 4) Scroll and Interaction

- **Scroll:** use `overflow-y: auto` for long content; avoid content clipping.
- **Hover/Focus:** provide clear visual feedback for interactive elements.
- **Loading:** always show loading states for async actions.

## 5) Next.js Conventions

- **Structure:** keep routes simple; avoid deep nesting.
- **Logic:** keep components single-purpose; avoid complex logic in render.
- **Navigation:** use `next/link` for routing; `useRouter` for navigation actions.
- **Rendering:** dynamic routes should be SSR/SSG where appropriate.

## 6) Color and Theme

- **Contrast:** ensure readable text on all backgrounds.
- **Theme:** maintain clear dark/light separation if both exist.
- **Shadows:** soft shadows preferred; avoid hard borders unless intentional.

## 7) Icons and Media

- **Icons:** minimal and consistent with labels.
- **Images:** optimize size; prefer WebP where possible.

## 8) Motion

- **Transitions:** subtle and purposeful.
- **Animations:** minimal; avoid heavy animations that impact performance.

---

## Implementation Notes

- If a requirement conflicts with this guide, document the exception in the PR.
- Keep UI copy in English by default unless the product spec states otherwise.
