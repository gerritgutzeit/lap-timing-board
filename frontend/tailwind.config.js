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
        'carousel-in': 'carouselIn 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'carousel-in-fast': 'carouselIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'carousel-card': 'carouselCard 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'cards-scroll-in': 'cardsScrollIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'carousel-driver': 'carouselDriver 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'carousel-row': 'carouselRow 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'carousel-outline': 'carouselOutline 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'carousel-dot': 'carouselDot 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'telemetry-in': 'telemetryIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'telemetry-time-in': 'telemetryTimeIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both',
        'telemetry-glow': 'telemetryGlow 2.5s ease-in-out infinite',
        'telemetry-live-pulse': 'telemetryLivePulse 1.5s ease-in-out infinite',
        'record-celebration': 'recordCelebration 10s ease-out forwards',
        'record-celebration-text': 'recordCelebrationText 10s ease-out forwards',
        'last-lap-fullscreen-in': 'fadeIn 0.4s ease-out forwards',
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
        carouselIn: {
          '0%': { opacity: '0', transform: 'translateX(32px) scale(0.98)' },
          '60%': { opacity: '1', transform: 'translateX(-2px) scale(1.005)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        carouselCard: {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.96)', boxShadow: '0 0 0 rgba(255,255,255,0)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' },
        },
        cardsScrollIn: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        carouselDriver: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        carouselRow: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        carouselOutline: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '0.55', transform: 'scale(1)' },
        },
        carouselDot: {
          '0%': { transform: 'scaleX(0.25)', opacity: '0.5' },
          '100%': { transform: 'scaleX(1)', opacity: '1' },
        },
        telemetryIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)', filter: 'blur(8px)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'blur(0)' },
        },
        telemetryTimeIn: {
          '0%': { opacity: '0', transform: 'scale(0.6) translateY(20px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        telemetryGlow: {
          '0%, 100%': { textShadow: '0 0 20px rgba(192,192,192,0.15), 0 0 40px rgba(225,6,0,0.08)' },
          '50%': { textShadow: '0 0 32px rgba(192,192,192,0.35), 0 0 60px rgba(225,6,0,0.12)' },
        },
        telemetryLivePulse: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(225, 6, 0, 0.4)' },
          '50%': { opacity: '0.9', boxShadow: '0 0 0 8px rgba(225, 6, 0, 0)' },
        },
        recordCelebration: {
          '0%': { opacity: '0' },
          '2%': { opacity: '1' },
          '92%': { opacity: '1' },
          '100%': { opacity: '0.97' },
        },
        recordCelebrationText: {
          '0%': { opacity: '0', transform: 'scale(0.5) translateY(12px)' },
          '8%': { opacity: '1', transform: 'scale(1.08) translateY(0)' },
          '15%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '25%': { opacity: '1', transform: 'scale(1.02) translateY(0)' },
          '35%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '50%': { opacity: '1', transform: 'scale(1.02) translateY(0)' },
          '65%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '80%': { opacity: '1', transform: 'scale(1.02) translateY(0)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
