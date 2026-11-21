/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Host Grotesk"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'sans-serif'],
        body: ['"Host Grotesk"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        paper: {
          DEFAULT: 'var(--color-paper)',
          2: 'var(--color-paper-2)',
          3: 'var(--color-paper-3)',
          glass: 'var(--color-paper-glass)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          2: 'var(--color-ink-2)',
          muted: 'var(--color-muted)',
          subtle: 'var(--color-subtle)',
        },
        rule: {
          DEFAULT: 'var(--color-rule)',
          2: 'var(--color-rule-2)',
          subtle: 'var(--color-rule-subtle)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          ink: 'var(--color-accent-ink)',
          soft: 'var(--color-accent-soft)',
        },
        cool: {
          DEFAULT: 'var(--color-cool)',
          soft: 'var(--color-cool-soft)',
        },
        ok: {
          DEFAULT: 'var(--color-ok)',
          soft: 'var(--color-ok-soft)',
        },
        bad: {
          DEFAULT: 'var(--color-bad)',
          soft: 'var(--color-bad-soft)',
        },
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
