import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'navy': '#0A1628',
        'data-blue': '#0066CC',
        'teal': '#0D9488',
        'coral': '#F97316',
        'amber': '#F59E0B',
        'cream': '#FFFEF9',
      },
    },
  },
  plugins: [typography],
}
