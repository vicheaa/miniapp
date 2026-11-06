const plugin = require('tailwindcss/plugin');
const animate = require('tailwindcss-animate');

const variableColor = (name) => ({ opacityValue }) => opacityValue === undefined
  ? `var(--${name})`
  : `rgba(var(--${name}-rgb), calc(var(--${name}-alpha, 1) * ${opacityValue}))`;

/** Keep generated CSS usable without cascade layers, @property or color-mix. */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Kantumruy Pro', 'sans-serif'], heading: ['Kantumruy Pro', 'sans-serif'] },
      colors: {
        'sidebar-ring': variableColor('sidebar-ring'),
        'sidebar-border': variableColor('sidebar-border'),
        'sidebar-accent-foreground': variableColor('sidebar-accent-foreground'),
        'sidebar-accent': variableColor('sidebar-accent'),
        'sidebar-primary-foreground': variableColor('sidebar-primary-foreground'),
        'sidebar-primary': variableColor('sidebar-primary'),
        'sidebar-foreground': variableColor('sidebar-foreground'),
        'sidebar': variableColor('sidebar'),
        'chart-5': variableColor('chart-5'),
        'chart-4': variableColor('chart-4'),
        'chart-3': variableColor('chart-3'),
        'chart-2': variableColor('chart-2'),
        'chart-1': variableColor('chart-1'),
        'ring': variableColor('ring'),
        'input': variableColor('input'),
        'border': variableColor('border'),
        'destructive': variableColor('destructive'),
        'accent-foreground': variableColor('accent-foreground'),
        'accent': variableColor('accent'),
        'muted-foreground': variableColor('muted-foreground'),
        'muted': variableColor('muted'),
        'secondary-foreground': variableColor('secondary-foreground'),
        'secondary': variableColor('secondary'),
        'primary-foreground': variableColor('primary-foreground'),
        'primary': variableColor('primary'),
        'popover-foreground': variableColor('popover-foreground'),
        'popover': variableColor('popover'),
        'card-foreground': variableColor('card-foreground'),
        'card': variableColor('card'),
        'foreground': variableColor('foreground'),
        'background': variableColor('background'),
        gray: {"50": "#f9fafb", "100": "#f3f4f6", "150": "#ededf0", "200": "#e5e7eb", "300": "#d1d5db", "400": "#9ca3af", "450": "#858c99", "500": "#6b7280", "600": "#4b5563", "650": "#404754", "655": "#3b424f", "700": "#374151", "800": "#1f2937", "900": "#111827"},
        blue: {"50": "#eff6ff", "100": "#dbeafe", "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8", "800": "#1e40af", "900": "#1e3a8a"},
        emerald: {"50": "#ecfdf5", "100": "#d1fae5", "500": "#10b981", "600": "#059669", "700": "#047857"},
        amber: {"50": "#fffbeb", "100": "#fef3c7", "500": "#f59e0b", "600": "#d97706", "700": "#b45309"},
        red: {"50": "#fef2f2", "100": "#fee2e2", "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c"},
      },
      borderRadius: {
        sm: 'calc(var(--radius) * .6)', md: 'calc(var(--radius) * .8)',
        lg: 'var(--radius)', xl: 'calc(var(--radius) * 1.4)',
        '2xl': 'calc(var(--radius) * 1.8)', '3xl': 'calc(var(--radius) * 2.2)',
        '4xl': 'calc(var(--radius) * 2.6)',
      },
      ringWidth: { 3: '3px' },
      boxShadow: { xs: '0 1px 2px 0 rgb(0 0 0 / .05)' },
      backdropBlur: { xs: '4px', sm: '8px' },
    },
  },
  plugins: [animate, plugin(({ addVariant, addUtilities }) => {
    for (const state of ['open', 'closed', 'checked', 'unchecked', 'active']) {
      addVariant(`data-${state}`, [`&[data-state="${state}"]`, `&[data-${state}]:not([data-${state}="false"])`]);
    }
    addVariant('data-disabled', ['&[data-disabled]:not([data-disabled="false"])', '&[data-disabled="true"]']);
    addVariant('data-inset', '&[data-inset]:not([data-inset="false"])');
    addVariant('data-popup-open', '&[data-popup-open]:not([data-popup-open="false"])');
    addUtilities({
      '.no-scrollbar': { '-ms-overflow-style': 'none', 'scrollbar-width': 'none', '&::-webkit-scrollbar': { display: 'none' } },
    });
  })],
};
