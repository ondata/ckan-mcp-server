---
name: create-astro-website
description: Create static website with Astro v5+, React, Tailwind CSS, TypeScript, with accessibility and SEO best practices
---

# Create Astro Website

Create production-ready static website with modern stack and best practices.

## Stack

- **Astro v5+** (`output: 'static'`)
- **React** for interactive components
- **Tailwind CSS** + typography plugin
- **TypeScript** strict mode
- **SEO**: RSS feed, sitemap, Open Graph, favicon set
- **Accessibility**: ARIA labels, keyboard navigation, WCAG AA contrast
- **PWA ready**: manifest.json, multi-format icons

## Project Setup

```bash
# Initialize Astro project
npm create astro@latest -- --template minimal --typescript strict

# Install integrations
npm install @astrojs/react @astrojs/tailwind @astrojs/sitemap @astrojs/rss
npm install react react-dom tailwindcss @tailwindcss/typography

# Initialize Tailwind
npx tailwindcss init
```

## Directory Structure

```
src/
  layouts/
    Layout.astro          # Main layout with SEO, Open Graph, favicon
  pages/
    index.astro           # Homepage
    about.astro           # About page with Markdown import
  content/
    about.md              # Markdown content for long-form pages
  components/
    Footer.astro          # Reusable footer
  styles/
    global.css            # Custom Tailwind utilities
  config/
    content.ts            # Centralized content configuration
  lib/                    # Helper functions
public/
  favicon.svg             # SVG favicon (optimized)
  favicon-16.png          # 16x16 PNG
  favicon-32.png          # 32x32 PNG
  favicon-48.png          # 48x48 PNG
  favicon-180.png         # 180x180 Apple Touch Icon
  favicon-192.png         # 192x192 PWA icon
  favicon-512.png         # 512x512 PWA icon
  favicon.ico             # ICO format
  manifest.json           # Web app manifest
  robots.txt
```

## Astro Config

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [react(), tailwind(), sitemap()],
  site: 'https://example.com',
  output: 'static',
});
```

## Tailwind Config

`tailwind.config.mjs`:

```js
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  plugins: [require('@tailwindcss/typography')],
}
```

## TypeScript Config

`tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

## Layout Template

`src/layouts/Layout.astro`:

```astro
---
interface Props {
  title: string;
  description?: string;
  image?: string;
}

const { title, description = 'Default site description', image = '/og-image.png' } = Astro.props;
const siteUrl = Astro.site || 'https://example.com';
const canonicalURL = new URL(Astro.url.pathname, siteUrl);
---

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content={description}>

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png">
  <link rel="manifest" href="/manifest.json">

  <!-- Open Graph -->
  <meta property="og:title" content={title}>
  <meta property="og:description" content={description}>
  <meta property="og:image" content={new URL(image, siteUrl)}>
  <meta property="og:url" content={canonicalURL}>
  <meta property="og:type" content="website">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={title}>
  <meta name="twitter:description" content={description}>
  <meta name="twitter:image" content={new URL(image, siteUrl)}>

  <link rel="canonical" href={canonicalURL}>
</head>
<body>
  <slot />
</body>
</html>
```

## Markdown Integration

`src/pages/about.astro`:

```astro
---
import Layout from '../layouts/Layout.astro';
import Content from '../content/about.md';
---

<Layout title="About">
  <article class="prose prose-lg prose-gray max-w-none
    prose-headings:text-gray-900
    prose-a:text-blue-600
    prose-strong:font-semibold">
    <Content />
  </article>
</Layout>
```

`src/content/about.md`:

```md
# About

Long-form **Markdown** content with automatic formatting.

## Features

- Clean typography
- Responsive design
- Accessible markup
```

## Manifest Configuration

`public/manifest.json`:

```json
{
  "name": "Site Full Name",
  "short_name": "Site Name",
  "description": "Site description",
  "theme_color": "#3B82F6",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    {
      "src": "favicon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "favicon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

## Accessibility Patterns

### Accessible Links

```astro
<a
  href="https://github.com/user/repo"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="GitHub Repository"
  title="Visit GitHub Repository"
  class="text-blue-600 hover:text-blue-700 focus:outline-2 focus:outline-blue-500"
>
  <svg aria-hidden="true"><!-- icon --></svg>
</a>
```

### Focus States

```css
/* Maintain visible focus indicators */
button:focus-visible,
a:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

### Semantic HTML

```astro
<header>
  <nav aria-label="Main navigation">
    <!-- navigation items -->
  </nav>
</header>

<main>
  <article>
    <!-- main content -->
  </article>
</main>

<footer>
  <!-- footer content -->
</footer>
```

## Component Patterns

### Static Components

Use `.astro` files for non-interactive content:

```astro
---
// src/components/Footer.astro
const currentYear = new Date().getFullYear();
---

<footer class="bg-gray-100 py-8">
  <p class="text-center text-gray-600">
    © {currentYear} Site Name
  </p>
</footer>
```

### Interactive Components

Use React with `client:load` only when needed:

```tsx
// src/components/Counter.tsx
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

```astro
---
import Counter from '../components/Counter';
---
<Counter client:load />
```

## Scripts

`package.json`:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  }
}
```

## Best Practices

### Design

- Mobile-first responsive design
- Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- WCAG AA color contrast (text-gray-700+ on white)
- Typography plugin for Markdown content

### Performance

- Static output for optimal performance
- Minimal JavaScript (React only where needed)
- Optimized images (WebP, AVIF with `<Picture>`)
- Tree-shaking unused CSS

### SEO

- Semantic HTML structure
- Descriptive meta tags
- Open Graph images (1200x630px)
- XML sitemap (automatic)
- RSS feed for blog/updates
- robots.txt configuration

### Content

- Centralize content in `src/config/content.ts`
- Markdown files in `src/content/` for long-form
- Frontmatter for metadata
- Collections for structured content

## Deployment

Ready for static hosting:

- **Netlify**: Connect Git repo, auto-deploy
- **Vercel**: Import project, zero config
- **GitHub Pages**: Add workflow, deploy on push
- **Cloudflare Pages**: Direct Git integration

## Quality Checklist

- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Accessibility (WCAG AA, ARIA, keyboard navigation)
- ✅ SEO (meta tags, sitemap, Open Graph)
- ✅ PWA ready (manifest, icons)
- ✅ TypeScript strict mode
- ✅ Fast build times
- ✅ Lighthouse score 90+

## Next Steps

After setup:

1. Customize colors in `tailwind.config.mjs`
2. Add content to `src/pages/`
3. Create reusable components
4. Generate favicon set (use favicon generator)
5. Add OG image (1200x630px)
6. Configure RSS feed if needed
7. Set up deployment
8. Test accessibility with screen reader

## Resources

- Astro Docs: https://docs.astro.build
- Tailwind CSS: https://tailwindcss.com
- React: https://react.dev
- WCAG Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
