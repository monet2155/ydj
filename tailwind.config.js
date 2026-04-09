/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        deck: {
          a: '#1a1f2e',
          b: '#1f1a2e'
        }
      }
    }
  },
  plugins: []
}
