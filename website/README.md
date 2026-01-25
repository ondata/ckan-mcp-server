# CKAN MCP Server Website

Landing page for the CKAN MCP Server project built with Astro v5, React, and Tailwind CSS.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Structure

```
website/
├── src/
│   ├── layouts/
│   │   └── Layout.astro       # Main layout with SEO
│   ├── pages/
│   │   └── index.astro        # Landing page
│   ├── components/
│   │   └── Footer.astro       # Footer component
│   └── styles/
│       └── global.css         # Global styles
├── public/
│   ├── favicon.svg            # SVG favicon
│   ├── favicon-*.png          # PNG favicons (to be generated)
│   ├── manifest.json          # PWA manifest
│   └── robots.txt
├── astro.config.mjs
├── tailwind.config.mjs
└── tsconfig.json
```

## Favicon Assets

The project includes a vector SVG favicon (`public/favicon.svg`). To generate PNG versions for broader compatibility:

```bash
# Install sharp-cli (if not already installed)
npm install -g sharp-cli

# Generate PNG favicons from SVG
sharp -i public/favicon.svg -o public/favicon-32.png resize 32 32
sharp -i public/favicon.svg -o public/favicon-180.png resize 180 180
sharp -i public/favicon.svg -o public/favicon-192.png resize 192 192
sharp -i public/favicon.svg -o public/favicon-512.png resize 512 512
```

Alternatively, use an online favicon generator like [favicon.io](https://favicon.io/) or [realfavicongenerator.net](https://realfavicongenerator.net/).

## Deployment

The website is automatically deployed to GitHub Pages when changes are pushed to the `main` branch under the `website/` directory.

**Deployment URL**: https://ondata.github.io/ckan-mcp-server/

The deployment is configured via `.github/workflows/deploy-website.yml`.

## Configuration

The site is configured for deployment to GitHub Pages at `/ckan-mcp-server` base path (configured in `astro.config.mjs`).

If deploying to a different location, update:
- `site` and `base` in `astro.config.mjs`
- `baseUrl` constant in layout and page files
- `start_url` in `manifest.json`

## Tech Stack

- **Astro v5** - Static site generator
- **React** - Interactive components (minimal usage)
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type safety
- **@tailwindcss/typography** - Prose styling

## Features

- ✅ SEO optimized (meta tags, Open Graph, Twitter Cards)
- ✅ Responsive design (mobile-first)
- ✅ Accessible (WCAG AA compliant)
- ✅ PWA ready (manifest, icons)
- ✅ Fast build times (static output)
- ✅ Sitemap generation
- ✅ robots.txt

## License

Same as parent project (MIT)
