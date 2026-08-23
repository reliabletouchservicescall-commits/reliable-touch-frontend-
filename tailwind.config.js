/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#F95C4B',
          hover: '#E84B3A',
          'dark-hover': '#FF7060',
        },
        neutral: {
          bg: '#FAFAF9',
          card: '#FFFFFF',
          muted: '#F5F5F4',
          text: '#111111',
          secondary: '#6B7280',
          border: '#E5E7EB',
          'dark-bg': '#0B0B0B',
          'dark-secondary-bg': '#121212',
          'dark-card': '#181818',
          'dark-elevated': '#202020',
          'dark-text': '#FFFFFF',
          'dark-secondary': '#A1A1AA',
          'dark-border': '#2A2A2A',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 30px rgba(249,92,75,0.12)',
        'card-hover-dark': '0 8px 30px rgba(249,92,75,0.18)',
        'btn': '0 4px 16px rgba(249,92,75,0.30)',
        'btn-hover': '0 6px 24px rgba(249,92,75,0.42)',
      },
    },
  },
  plugins: [],
}
