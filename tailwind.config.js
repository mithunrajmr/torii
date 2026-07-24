/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          bg: '#e8ecf2',
          card: '#e8ecf2',
          accent: '#2563eb',
          danger: '#ef4444',
          success: '#10b981',
          warning: '#f59e0b',
        }
      },
      boxShadow: {
        'neo': '8px 8px 16px #cbced1, -8px -8px 16px #ffffff',
        'neo-inset': 'inset 4px 4px 8px #cbced1, inset -4px -4px 8px #ffffff',
        'neo-sm': '4px 4px 8px #cbced1, -4px -4px 8px #ffffff',
        'neo-accent': '0 8px 16px rgba(37, 99, 235, 0.3)',
      }
    },
  },
  plugins: [],
}
