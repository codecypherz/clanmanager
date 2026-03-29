---
name: styling
description: Use when styling components, adding visual design, or working with CSS. Enforces Tailwind-first approach with CSS as fallback only.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Styling Skill — Tailwind-First

This project uses **Tailwind CSS 4** with Angular 21. All styling MUST prioritize Tailwind utility classes. Raw CSS is a fallback only.

## Rules (in priority order)

### 1. Use Tailwind utility classes in templates (ALWAYS try this first)

Apply styles directly in HTML templates using Tailwind classes:

```html
<div class="flex items-center gap-4 p-6 bg-cr-dark rounded-lg shadow-clash">
  <h2 class="text-xl font-bold text-cr-gold">Title</h2>
</div>
```

### 2. Use `@apply` in component CSS (if class lists get unwieldy)

When a single element accumulates 8+ utility classes or the same combination repeats many times in one template, extract to the component's `.css` file with `@apply`:

```css
.member-card {
  @apply flex items-center gap-4 p-6 bg-cr-dark rounded-lg shadow-clash
         border border-white/10 hover:border-cr-gold/50 transition-colors;
}
```

### 3. Raw CSS (LAST RESORT only)

Only use raw CSS when Tailwind genuinely cannot express the style. Examples of valid raw CSS:
- Complex animations/keyframes (like `@keyframes shimmer` in `styles.css`)
- CSS properties Tailwind doesn't cover (e.g., `-webkit-text-stroke`, `text-shadow`)
- Complex `background` shorthand with multiple layers
- Pseudo-element content (`::before`, `::after` with `content:`)

When writing raw CSS, add it to the component's own `.css` file, NOT to `styles.css` (unless it's truly global).

## Project Theme

Custom Tailwind values defined in `tailwind.config.js`:

| Token | Value | Usage |
|-------|-------|-------|
| `cr-blue` | `#1e40af` | King's Blue — primary accent |
| `cr-gold` | `#facc15` | Trophy Gold — highlights, important text |
| `cr-dark` | `#0f172a` | Dark background |
| `shadow-clash` | flat bottom shadow | Button/card depth |

Use these tokens over raw color values: `text-cr-gold` not `text-[#facc15]`.

## Global Styles

`frontend/src/styles.css` contains:
- Tailwind import (`@import "tailwindcss"`)
- Custom utilities in `@layer utilities` (e.g., `.text-stroke`)
- Global keyframe animations (e.g., `shimmer`)

Do NOT add component-specific styles to `styles.css`.

## Common Patterns

### Responsive design
Use Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Dark theme
This app uses a dark theme by default (`bg-cr-dark`). Design with light text on dark backgrounds.

### Conditional classes in Angular
Use class binding for dynamic styles:
```html
<span [class.text-red-500]="isWarning" [class.text-green-500]="!isWarning">
  {{ status }}
</span>
```

Or with `ngClass` / template expressions for multiple dynamic classes:
```html
<div [class]="'p-4 rounded ' + (isActive ? 'bg-cr-blue text-white' : 'bg-gray-800 text-gray-400')">
```

## Anti-patterns (DO NOT do these)

- Writing raw CSS for something Tailwind can handle (margins, padding, flex, grid, colors, typography)
- Using arbitrary values (`text-[14px]`) when a Tailwind scale value exists (`text-sm`)
- Adding `!important` — restructure specificity instead
- Inline `style` attributes — use Tailwind classes or `[style.*]` bindings for truly dynamic values only
- Creating new global CSS classes in `styles.css` for component-specific styles
