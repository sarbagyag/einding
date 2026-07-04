/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        bg: '#0f0f0f',
        surface: '#1a1a1a',
        accent: '#7c6af7',
        primary: '#f0f0f0',
        muted: '#666666',
        success: '#4ade80',
      },
    },
  },
  plugins: [],
}
