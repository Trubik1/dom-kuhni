/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: '#c9a96e',
        'accent-dark': '#b8944f',
      },
    },
  },
  plugins: [],
};
