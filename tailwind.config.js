/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta tomada del logotipo Cross-Border Solutions
        navy: {
          DEFAULT: '#0F2247',
          50: '#EDF0F6',
          100: '#D6DDEA',
          200: '#AEBBD5',
          300: '#8699C0',
          400: '#5D77AB',
          500: '#3A5590',
          600: '#1E3A6E',
          700: '#152C55',
          800: '#0F2247',
          900: '#0A1730',
        },
        gold: {
          DEFAULT: '#C9A227',
          50: '#FBF6E7',
          100: '#F5E9C2',
          200: '#EBD489',
          300: '#DFBE59',
          400: '#D3AC3B',
          500: '#C9A227',
          600: '#A4821E',
          700: '#7D6318',
          800: '#564411',
          900: '#332809',
        },
        ink: '#14213D',
        canvas: '#F7F7F5',
        line: '#E4E1D8',
      },
      fontFamily: {
        display: ['var(--font-source-serif)', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        sora: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
