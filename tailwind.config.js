/** @type {import('tailwindcss').Config} */
// =====================================================
// Caterkart theme — aligned to Swiggy MCP Builders Club
// design tokens (extracted from mcp.swiggy.com/builders).
// Brand orange #FF5200, navy ink #0A2540, Gilroy/Plus Jakarta.
// =====================================================
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // === Swiggy brand ===
        swiggy: {
          orange: '#FF5200',  // primary
          DEFAULT: '#FF5200',
          dark: '#E04800',     // hover / active
          green: '#1BA672',    // positive
          red: '#FA3C5A',      // negative
          mart: '#7E3FBF',     // Instamart accent
        },
        // === Cater accent (warm secondary) ===
        cater: {
          50:  '#FFF6EE',
          100: '#FFE6D0',
          500: '#FF5200',
          600: '#E04800',
          coral: '#FF7A45',   // matches MCP hero second stop
          peach: '#FFB088',   // matches MCP hero third stop
        },
        // === Ink (text) — navy-leaning per MCP ===
        ink: {
          primary:   '#0A2540',
          secondary: '#425466',
          tertiary:  '#6B7C93',
          disabled:  '#99A5B4',
          inverse:   '#F6F9FC',
        },
        // === Surfaces & borders ===
        surface: {
          primary:   '#FFFFFF',
          secondary: '#F6F9FC',
          tertiary:  '#EDF0F4',
          elevated:  '#FFFFFF',
        },
        line: {
          default: '#E3E8EE',
          subtle:  '#EDF0F4',
        },
        // === Status ===
        info:    '#5D8FD5',
        warning: '#D07D00',
      },
      fontFamily: {
        // Plus Jakarta Sans is the closest free match to GilroyforSwiggy
        sans: [
          '"Plus Jakarta Sans"',
          '"Gilroy"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: [
          '"Plus Jakarta Sans"',
          '"Gilroy"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'ui-monospace',
          'monospace',
        ],
      },
      fontWeight: {
        medium:   '500',
        semibold: '600',
        bold:     '700',
        black:    '900',
      },
      borderRadius: {
        md:    '8px',
        lg:    '12px',
        xl:    '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card:     '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        floating: '0 8px 30px -6px rgba(0,0,0,0.12)',           // MCP token
        pop:      '0 12px 32px -8px rgba(255,82,0,0.18), 0 4px 12px rgba(0,0,0,0.05)',
        glow:     '0 0 0 4px rgba(255,82,0,0.15), 0 8px 24px rgba(255,82,0,0.25)',
      },
      backgroundImage: {
        // === MCP hero gradient (dark, dramatic) ===
        'mcp-hero': 'linear-gradient(135deg, #0A2540 0%, #FF5200 50%, #FF7A45 80%, #FFB088 100%)',
        // === MCP hero (light variant) ===
        'mcp-hero-light': 'linear-gradient(135deg, #F6F9FC 0%, #FF5200 50%, #FF7A45 80%, #FFD4BB 100%)',
        // === Warm mesh (kept for cards/accents) ===
        'mesh-warm':
          'radial-gradient(at 12% 18%, #FFB088 0px, transparent 45%), radial-gradient(at 80% 12%, #FF7A45 0px, transparent 50%), radial-gradient(at 70% 80%, #FF5200 0px, transparent 55%), linear-gradient(135deg, #FF5200 0%, #FF7A45 100%)',
        'shimmer': 'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in':       { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-in-up':    { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in-down':  { '0%': { opacity: '0', transform: 'translateY(-10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pop':           { '0%': { opacity: '0', transform: 'scale(0.94)' }, '60%': { transform: 'scale(1.02)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'float':         { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'float-slow':    { '0%, 100%': { transform: 'translateY(0) rotate(0)' }, '50%': { transform: 'translateY(-14px) rotate(4deg)' } },
        'shimmer':       { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-soft':    { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.65' } },
        'pulse-ring':    { '0%': { transform: 'scale(0.9)', opacity: '0.5' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
        'spin-slow':     { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        'confetti':      { '0%': { transform: 'translateY(0) rotate(0)', opacity: '1' }, '100%': { transform: 'translateY(-220px) rotate(540deg)', opacity: '0' } },
        'gradient-shift':{ '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
      animation: {
        'fade-in':       'fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-up':    'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-down':  'fade-in-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop':           'pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        'float':         'float 4s ease-in-out infinite',
        'float-slow':    'float-slow 6s ease-in-out infinite',
        'shimmer':       'shimmer 2.4s linear infinite',
        'pulse-soft':    'pulse-soft 2.5s ease-in-out infinite',
        'pulse-ring':    'pulse-ring 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        'spin-slow':     'spin-slow 18s linear infinite',
        'confetti':      'confetti 2.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'gradient-shift':'gradient-shift 8s ease infinite',
      },
    },
  },
  plugins: [],
};
