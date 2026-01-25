/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        'cr-blue': '#1e40af',  // King's Blue
        'cr-gold': '#facc15',  // Trophy Gold
        'cr-dark': '#0f172a',  // Dark background
      },
      boxShadow: {
        'clash': '0 4px 0 0 rgba(0, 0, 0, 0.3)', // Flat bottom shadow for buttons
      }
    },
  },
  plugins: [],
}
