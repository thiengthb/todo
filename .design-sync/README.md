# .design-sync — preview bundle for Claude Design (claude.ai/design)

Static HTML preview cards mirroring `todo`'s shadcn/ui primitives, pushed to a
Claude Design project via the `DesignSync` tool. **Not part of the Next.js build**
(dot-prefixed → ignored by file routing); purely a sync source.

## Why static HTML

Claude Design renders static preview HTML, not live React/TSX. Each card is a
self-contained `.html` file whose **first line** is the index marker:

```html
<!-- @dsCard group="Actions" -->
```

The Design System pane builds its card index from that marker. Design tokens
(OKLCH) are copied verbatim from `app/globals.css` and split light | dark in each
card. **When a token or a component variant changes in the app, update the matching
card here in the same change** — otherwise the mirror drifts.

## Cards (22 — full `components/ui/` set)

| File                          | Group        | Source component                |
| ----------------------------- | ------------ | ------------------------------- |
| `components/button.html`      | Actions      | `components/ui/button.tsx`      |
| `components/badge.html`       | Data display | `components/ui/badge.tsx`       |
| `components/truncate.html`    | Data display | `components/ui/truncate.tsx`    |
| `components/card.html`        | Surfaces     | `components/ui/card.tsx`        |
| `components/input.html`       | Forms        | `components/ui/input.tsx`       |
| `components/textarea.html`    | Forms        | `components/ui/textarea.tsx`    |
| `components/checkbox.html`    | Forms        | `components/ui/checkbox.tsx`    |
| `components/switch.html`      | Forms        | `components/ui/switch.tsx`      |
| `components/calendar.html`    | Forms        | `components/ui/calendar.tsx`    |
| `components/date-picker.html` | Forms        | `components/ui/date-picker.tsx` |
| `components/time-picker.html` | Forms        | `components/ui/time-picker.tsx` |
| `components/dialog.html`      | Overlays     | `components/ui/dialog.tsx`      |
| `components/sheet.html`       | Overlays     | `components/ui/sheet.tsx`       |
| `components/popover.html`     | Overlays     | `components/ui/popover.tsx`     |
| `components/tooltip.html`     | Overlays     | `components/ui/tooltip.tsx`     |
| `components/tabs.html`        | Layout       | `components/ui/tabs.tsx`        |
| `components/separator.html`   | Layout       | `components/ui/separator.tsx`   |
| `components/scroll-area.html` | Layout       | `components/ui/scroll-area.tsx` |
| `components/skeleton.html`    | Feedback     | `components/ui/skeleton.tsx`    |
| `components/sonner.html`      | Feedback     | `components/ui/sonner.tsx` (toast) |
| `components/progress-bar.html`  | Feedback   | `components/ui/progress-bar.tsx`  |
| `components/progress-ring.html` | Feedback   | `components/ui/progress-ring.tsx` |

> Composite cards (`date-picker`, `time-picker`) render the assembled widget.
> Date/calendar cards use a fixed sample month (June 2026) — they illustrate
> states (today/selected/outside), not a live date.

## Sync flow (DesignSync tool)

1. `list_projects` → pick an existing design-system project, or `create_project`.
2. `finalize_plan` with `localDir` = this folder, `writes` = `todo/components/**`
   (namespaced under `todo/` in the shared "Design System" project so other apps
   can sync alongside without path collisions).
3. `write_files` (reads each `localPath` from disk; contents never enter the model).
4. Open the project on claude.ai/design to view the cards.
