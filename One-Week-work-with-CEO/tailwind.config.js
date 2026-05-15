/*****************
 Tailwind config
******************/
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{html,js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F4F7FF',
          100: '#E9EFFF',
          200: '#C9D8FF',
          300: '#A9C0FF',
          400: '#6A90FF',
          500: '#2B60FF',
          600: '#1F49C2',
          700: '#163693',
          800: '#0F276A',
          900: '#0A1B4A',
        },
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
