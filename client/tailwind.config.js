/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: '#FF5A1F', dark: '#E04A12' } },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Impact', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-left': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-right': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'ken-burns': { from: { transform: 'scale(1)' }, to: { transform: 'scale(1.08)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'fade-up': 'fade-up .45s ease-out both',
        'fade-in': 'fade-in .3s ease-out both',
        'slide-left': 'slide-left .35s cubic-bezier(.22,1,.36,1) both',
        'slide-right': 'slide-right .35s cubic-bezier(.22,1,.36,1) both',
        'ken-burns': 'ken-burns 18s ease-out both',
        marquee: 'marquee 28s linear infinite',
      },
    },
  },
  plugins: [],
};
