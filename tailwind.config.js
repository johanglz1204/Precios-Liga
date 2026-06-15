/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pharmacy: {
          light: '#F0FDFA',
          green: '#10B981',
          darkgreen: '#047857',
          navy: '#0F172A',
          accent: '#0EA5E9',
        }
      }
    },
  },
  plugins: [],
}
