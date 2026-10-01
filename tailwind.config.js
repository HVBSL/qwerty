/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan index.html AND every JS file: classes added at runtime by the
  // filters, nav, modal and form state handlers must be present in the build.
  content: ['./index.html', './js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        black: '#000000',
        graphite: '#0c0c0e',
        panel: '#111114',
        'panel-border': '#222226',
        'panel-hover': '#18181d',
        'muted-grey': '#8a8a93',
        'dim-grey': '#404048',
        accent: {
          magenta: '#ff2fd0',
          violet: '#7a3cff',
          cyan: '#29e0e0',
          yellow: '#fbbf24',
        }
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"Space Mono"', 'monospace'],
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
};
