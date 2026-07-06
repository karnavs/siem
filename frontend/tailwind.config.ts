import type { Config } from 'tailwindcss';

// SentryGrid design tokens — a SOC console, not a generic admin dashboard.
// Dark base because that's domain-authentic (analysts run dark consoles for
// long shifts), but restrained: two deliberate accents, not a flood of neon.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#0C0F16', // page background
          panel: '#131826', // card/panel surface
          raised: '#1A2133', // hover/raised surface
          border: '#232B3D',
        },
        ink: {
          DEFAULT: '#E8EAED', // primary text
          muted: '#8B93A7', // secondary text
          faint: '#5B6478',
        },
        signal: {
          amber: '#F5A623', // active threat / attention accent
          cyan: '#3FA9F5', // informational / link accent
        },
        severity: {
          critical: '#EF4444',
          high: '#F5A623',
          medium: '#EAB308',
          low: '#3FA9F5',
        },
        status: {
          resolved: '#4ADE80',
        },
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
