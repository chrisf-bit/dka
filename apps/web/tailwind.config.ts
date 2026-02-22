import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nhs: {
          blue: '#005EB8',
          darkBlue: '#003087',
          brightBlue: '#0072CE',
          lightBlue: '#41B6E6',
          aqua: '#00A9CE',
          green: '#009639',
          warmYellow: '#FFB81C',
          emergency: '#DA291C',
          orange: '#ED8B00',
          pink: '#AE2573',
          darkGrey: '#425563',
          midGrey: '#768692',
          paleGrey: '#E8EDEE',
        },
        sim: {
          bg: '#0f172a',
          surface: '#1e293b',
          surfaceLight: '#334155',
          border: '#475569',
          text: '#f8fafc',
          textMuted: '#94a3b8',
          stable: '#22c55e',
          concerning: '#f59e0b',
          critical: '#ef4444',
          collapsed: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-alert': 'pulseAlert 1s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        pulseAlert: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        slideIn: {
          from: { transform: 'translateY(-10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
