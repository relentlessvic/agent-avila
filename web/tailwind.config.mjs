/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,mjs,svelte,ts,tsx,vue}'
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0b0f1a',
          bgDeep: '#020308',
          cyan: '#00e6ff',
          violet: '#8b5cf6',
          emerald: '#10b981',
          amber: '#fbbf24',
          coral: '#ff6b6b',
          warm: '#ffb96b',
          rose: '#ff6b9b'
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
        display: ['"SF Pro Display"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
};
