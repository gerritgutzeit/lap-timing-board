/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          red: '#e10600',
          dark: '#0a0a0a',
          panel: '#15151a',
          border: '#2a2a32',
          muted: '#6b7280',
          text: '#e5e7eb',
        },
        techie: {
          bg: '#0d0d0d',
          surface: '#141414',
          embed: '#1a1a1a',
          text: '#d8d8d8',
          dim: '#888888',
          accent: '#c0c0c0',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-up-fade': 'slideUpFade 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'data-in': 'dataIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'time-flash': 'timeFlash 0.6s ease-out forwards',
        'status-in': 'statusIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'content-in': 'contentIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'waiting-pulse': 'waitingPulse 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUpFade: {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        dataIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        timeFlash: {
          '0%': { backgroundColor: 'rgba(192, 192, 192, 0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        statusIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        contentIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        waitingPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
