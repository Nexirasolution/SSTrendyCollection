/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      animation: {
        marquee: 'marquee 22s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      // Palette (SS Trendy Shopee logo theme)
      //   Primary    #A67C00  deep gold: buttons on hover, badges, links, savings, active states
      //   Secondary  #D4AF37  metallic gold: thin rings and dividers (decorative only)
      //   Background #FFFBF0  logo cream: soft bands (pages themselves are pure white)
      //   Text       #1A1A1A  logo black: headings + body, dark buttons
      //   Accent     #F3E5B5  pale gold: washes, focus rings, soft badges
      //
      // The original key names are kept so any existing `bg-brand-*` /
      // `text-brand-*` classes keep working and pick up the new palette.
      colors: {
        brand: {
          // ── New semantic names (use these in new code) ──
          primary: '#A67C00',
          secondary: '#D4AF37',
          background: '#FFFBF0',
          text: '#1A1A1A',
          accent: '#F3E5B5',

          // ── Original keys, remapped ──
          pink: '#A67C00',       // primary
          magenta: '#A67C00',    // primary brand color (wordmark, CTAs, prices)
          rose: '#1A1A1A',       // hover/secondary tone — deep text colour
          green: '#F3E5B5',      // neutral accent slot is now the pale gold accent
          deepgreen: '#1A1A1A',  // darkest tone
          gold: '#D4AF37',       // secondary — decorative rings and dividers only
          cream: '#FFFBF0',      // soft band background
          ink: '#1A1A1A',        // text color

          // ── Helpers carried over from the earlier theme ──
          navy: '#A67C00',       // primary
          navydark: '#1A1A1A',   // text colour
          goldpale: '#F3E5B5',   // accent
          goldwash: '#FFFBF0',   // tint for hovers and placeholders
          inksoft: 'rgba(26, 26, 26, 0.72)', // secondary text
          line: 'rgba(26, 26, 26, 0.12)'     // hairline borders
        }
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)']
      },
      boxShadow: {
        soft: '0 8px 30px -8px rgba(26, 26, 26, 0.15)',
        card: '0 18px 36px rgba(26, 26, 26, 0.12)',
        glow: '0 10px 24px rgba(166, 124, 0, 0.25)'
      },
      borderRadius: {
        xl2: '1.25rem',   // 20px — cards
        xl3: '1.5rem'     // 24px — summary cards, form cards
      }
    }
  },
  plugins: []
};