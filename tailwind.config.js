/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        swiggy: {
          orange: '#FC8019',
          dark: '#1B1B1B',
          green: '#60B246',
          red: '#E43D3D',
          mart: '#7E3FBF',
        },
        cater: {
          50: '#FFF6EE',
          100: '#FFE6D0',
          500: '#FC8019',
          600: '#F26B0A',
          coral: '#FF5E5B',
          peach: '#FFB071',
        },
      },
      fontFamily: {
        sans: ['"Basis Grotesque Pro"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Basis Grotesque Pro"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        pop: '0 12px 32px -8px rgba(252,128,25,0.18), 0 4px 12px rgba(0,0,0,0.05)',
        glow: '0 0 0 4px rgba(252,128,25,0.15), 0 8px 24px rgba(252,128,25,0.25)',
      },
      backgroundImage: {
        'mesh-warm':
          'radial-gradient(at 12% 18%, #FFB071 0px, transparent 45%), radial-gradient(at 80% 12%, #FF5E5B 0px, transparent 50%), radial-gradient(at 70% 80%, #FC8019 0px, transparent 55%), linear-gradient(135deg, #FC8019 0%, #FF5E5B 100%)',
        'shimmer': 'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '60%': { transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0)' },
          '50%': { transform: 'translateY(-14px) rotate(4deg)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.5' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'confetti': {
          '0%': { transform: 'translateY(0) rotate(0)', opacity: '1' },
          '100%': { transform: 'translateY(-220px) rotate(540deg)', opacity: '0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'fade-in-down': 'fade-in-down 0.4s ease-out both',
        'pop': 'pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        'float': 'float 4s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.4s linear infinite',
        'pulse-soft': 'pulse-soft 2.5s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
        'spin-slow': 'spin-slow 18s linear infinite',
        'confetti': 'confetti 2.4s ease-out forwards',
        'gradient-shift': 'gradient-shift 8s ease infinite',
      },
    },
  },
  plugins: [],
};
