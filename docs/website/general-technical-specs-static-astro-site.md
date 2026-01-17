# General Technical Specifications

This document describes the core architectural choices adopted in the project, independent of the specific use case. It represents a reusable pattern for similar projects.

## Core Technology Stack

**Static site generator**: Astro 5.x

- Output: fully static site
- Automatic file-based routing
- Build-time rendering for performance

**Interactive components**: React 19.x

- Selective hydration via `client:load`
- Used only where interactivity is needed (filters, sortable tables, pagination)
- Pattern: Astro components for layout/static, React for interactive UI

**Type Safety**: TypeScript strict mode

- `extends: "astro/tsconfigs/strict"`
- No ESLint, no Prettier
- TypeScript as the only code quality guardrail

**Styling**: Tailwind CSS 3.x

- Custom theme with domain semantic variables
- Typography plugin for markdown content
- Custom animations/colors/fonts configuration
- Mobile-first responsive design

## Component Architecture

### Static vs Interactive Separation

**Astro components** (`.astro`):
- General layout
- Header, Footer, Navigation
- Pages with mostly static content
- HTML pre-rendered at build time

**React components** (`.tsx`):
- Filters and search
- Sortable tables
- Pagination
- Share button (Web Share API)
- Any UI that requires client-side state

### State Management

**URL Query Params as single source of truth**:

- All filters/state persisted in query string
- Native shareability (copy URL = share state)
- No Redux/Zustand/Context for simple filters
- Browser back/forward works out of the box

Example: `/?category=2&status=active&sort=date&page=3`

### Hydration Strategy

`client:load` directive for React components:

- Immediate hydration on page load
- Alternative: `client:idle` for non-critical components
- Prefer `client:load` for UX (avoids flash of non-interactive content)

## Build & Deployment

### GitHub Actions Workflow

**Multiple triggers**:
1. Push to main branch (excluding .md files and docs/)
2. Schedule cron (optional, for recurring tasks)
3. Manual dispatch with parameterized input

**Build pipeline**:

```yaml
- Generate OG images (pre-build)
- Build with Astro
- Deploy to GitHub Pages
```

**Important pattern**: Auto-commit in CI

- Generated/processed files are automatically committed if changed
- Commit message with `[skip ci]` to avoid loops
- `git pull --rebase --autostash` before push

### OG Image Generation

**Automatic and pre-build**:

- Dedicated script: `npm run generate-og-images`
- Library: Sharp (SVG -> PNG)
- Execution: before `astro build` in the pipeline
- Output committed: `public/og-images/*.png`

**Pattern**:
- One default image
- One image per page/entity (dynamic, with injected content)
- Standard size: 1200x630px
- Dynamic colors/layout based on category/type

### Environment Configuration

**Dev vs Production via `NODE_ENV`**:

```javascript
// astro.config.mjs
const isProd = process.env.NODE_ENV === 'production';

export default {
  site: isProd ? 'https://example.github.io' : 'http://localhost:4321',
  base: isProd ? '/repo-name' : '/',
  output: 'static'
}
```

**Deploy target**: GitHub Pages

- Static site hosting
- Configurable base path (for projects under an organization)
- Production environment configured via Pages settings

## Accessibility (a11y)

### Core Principles

**Semantic HTML First**:
- Semantic tags (`<nav>`, `<main>`, `<header>`, `<footer>`, `<article>`, `<section>`)
- Document structure with hierarchical headings (`<h1>` -> `<h6>`)
- Unordered lists (`<ul>`) for navigation
- Button vs link: `<button>` for actions, `<a>` for navigation

**ARIA Attributes**:
- `aria-label` for accessible labels on interactive elements
- `aria-expanded` / `aria-hidden` for dynamic component states
- `aria-controls` for associations between elements
- `aria-current="page"` to indicate current page in navigation
- `aria-live="polite"` / `role="status"` for dynamic regions (e.g., filter results)
- `aria-modal="true"` for dialog/modal

**Images**:
- Custom Rehype plugin (`rehypeValidateAlt`) to validate alt text
- Checks images without alt or with too-short alt (<10 characters)
- Build-time warning if alt text is missing/insufficient
- All decorative images must have `alt=""`

### Implementation

**Markdown configuration**:

```javascript
// astro.config.mjs
import { rehypeValidateAlt } from './src/lib/rehype-validate-alt.mjs';

export default {
  markdown: {
    rehypePlugins: [
      rehypeValidateAlt,  // Validate alt text
      // ... other plugins
    ]
  }
}
```

**Interactive component patterns**:

```tsx
// Example: Button with aria-label
<button
  aria-label="Share this page"
  aria-expanded={isOpen}
  aria-controls="share-menu"
>
  <ShareIcon aria-hidden="true" />
</button>

// Live region for filters
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {`${filteredCount} results found`}
</div>
```

**Document language**:
- `lang="it"` attribute (or appropriate language) on `<html>`
- Important for screen readers (correct pronunciation)

### Accessibility Checklist

- [ ] All interactive elements have accessible labels
- [ ] Images have descriptive alt text (not decorative = empty alt)
- [ ] Headings are hierarchical without level skips
- [ ] Keyboard navigation works (logical tab order)
- [ ] Dynamic states are announced (aria-live, role="status")
- [ ] Sufficient contrast ratio (WCAG AA: 4.5:1 for normal text)
- [ ] Visible focus on interactive elements
- [ ] Form inputs are associated with labels (`<label for="...">` or wrapping)
