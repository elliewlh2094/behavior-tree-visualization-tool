import type { NodeKind } from '../../core/model/node';

// Tailwind hue families × ten shades. Users pick a family per node kind;
// usePreferencesSync resolves the right shade for each visual role (bg,
// border, accent text, accent bg, ring, selected border) using the helpers
// below. Light vs dark mode picks different shades from the same family,
// so a single user choice ("Sequence is cyan") keeps a coherent identity
// across themes without users editing colors twice.
//
// Values are the published Tailwind v3 hex codes; copied here so we don't
// reach into the package internals at runtime.

type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface ColorFamily {
  key: string;
  label: string;
  shades: Record<Shade, string>;
}

function family(
  key: string,
  label: string,
  s: readonly [string, string, string, string, string, string, string, string, string, string],
): ColorFamily {
  return {
    key,
    label,
    shades: {
      50: s[0], 100: s[1], 200: s[2], 300: s[3], 400: s[4],
      500: s[5], 600: s[6], 700: s[7], 800: s[8], 900: s[9],
    },
  };
}

export const COLOR_FAMILIES = {
  slate:   family('slate',   'Slate',   ['#f8fafc','#f1f5f9','#e2e8f0','#cbd5e1','#94a3b8','#64748b','#475569','#334155','#1e293b','#0f172a']),
  gray:    family('gray',    'Gray',    ['#f9fafb','#f3f4f6','#e5e7eb','#d1d5db','#9ca3af','#6b7280','#4b5563','#374151','#1f2937','#111827']),
  zinc:    family('zinc',    'Zinc',    ['#fafafa','#f4f4f5','#e4e4e7','#d4d4d8','#a1a1aa','#71717a','#52525b','#3f3f46','#27272a','#18181b']),
  neutral: family('neutral', 'Neutral', ['#fafafa','#f5f5f5','#e5e5e5','#d4d4d4','#a3a3a3','#737373','#525252','#404040','#262626','#171717']),
  stone:   family('stone',   'Stone',   ['#fafaf9','#f5f5f4','#e7e5e4','#d6d3d1','#a8a29e','#78716c','#57534e','#44403c','#292524','#1c1917']),
  red:     family('red',     'Red',     ['#fef2f2','#fee2e2','#fecaca','#fca5a5','#f87171','#ef4444','#dc2626','#b91c1c','#991b1b','#7f1d1d']),
  orange:  family('orange',  'Orange',  ['#fff7ed','#ffedd5','#fed7aa','#fdba74','#fb923c','#f97316','#ea580c','#c2410c','#9a3412','#7c2d12']),
  amber:   family('amber',   'Amber',   ['#fffbeb','#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706','#b45309','#92400e','#78350f']),
  yellow:  family('yellow',  'Yellow',  ['#fefce8','#fef9c3','#fef08a','#fde047','#facc15','#eab308','#ca8a04','#a16207','#854d0e','#713f12']),
  lime:    family('lime',    'Lime',    ['#f7fee7','#ecfccb','#d9f99d','#bef264','#a3e635','#84cc16','#65a30d','#4d7c0f','#3f6212','#365314']),
  green:   family('green',   'Green',   ['#f0fdf4','#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#16a34a','#15803d','#166534','#14532d']),
  emerald: family('emerald', 'Emerald', ['#ecfdf5','#d1fae5','#a7f3d0','#6ee7b7','#34d399','#10b981','#059669','#047857','#065f46','#064e3b']),
  teal:    family('teal',    'Teal',    ['#f0fdfa','#ccfbf1','#99f6e4','#5eead4','#2dd4bf','#14b8a6','#0d9488','#0f766e','#115e59','#134e4a']),
  cyan:    family('cyan',    'Cyan',    ['#ecfeff','#cffafe','#a5f3fc','#67e8f9','#22d3ee','#06b6d4','#0891b2','#0e7490','#155e75','#164e63']),
  sky:     family('sky',     'Sky',     ['#f0f9ff','#e0f2fe','#bae6fd','#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e']),
  blue:    family('blue',    'Blue',    ['#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a']),
  indigo:  family('indigo',  'Indigo',  ['#eef2ff','#e0e7ff','#c7d2fe','#a5b4fc','#818cf8','#6366f1','#4f46e5','#4338ca','#3730a3','#312e81']),
  violet:  family('violet',  'Violet',  ['#f5f3ff','#ede9fe','#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#4c1d95']),
  purple:  family('purple',  'Purple',  ['#faf5ff','#f3e8ff','#e9d5ff','#d8b4fe','#c084fc','#a855f7','#9333ea','#7e22ce','#6b21a8','#581c87']),
  fuchsia: family('fuchsia', 'Fuchsia', ['#fdf4ff','#fae8ff','#f5d0fe','#f0abfc','#e879f9','#d946ef','#c026d3','#a21caf','#86198f','#701a75']),
  pink:    family('pink',    'Pink',    ['#fdf2f8','#fce7f3','#fbcfe8','#f9a8d4','#f472b6','#ec4899','#db2777','#be185d','#9d174d','#831843']),
  rose:    family('rose',    'Rose',    ['#fff1f2','#ffe4e6','#fecdd3','#fda4af','#fb7185','#f43f5e','#e11d48','#be123c','#9f1239','#881337']),
} satisfies Record<string, ColorFamily>;

export type ColorFamilyKey = keyof typeof COLOR_FAMILIES;

export const COLOR_FAMILY_KEYS = Object.keys(COLOR_FAMILIES) as readonly ColorFamilyKey[];

export function isColorFamilyKey(value: string): value is ColorFamilyKey {
  return value in COLOR_FAMILIES;
}

// Default kind→family — preserves v1.2's visual identity.
export const DEFAULT_NODE_FAMILY_BY_KIND: Record<NodeKind, ColorFamilyKey> = {
  Root: 'slate',
  Sequence: 'cyan',
  Fallback: 'blue',
  Parallel: 'fuchsia',
  Decorator: 'orange',
  Action: 'emerald',
  Condition: 'yellow',
  Group: 'slate',
};

// Six visual roles map onto specific shades. Light/dark each pick the
// shade index that gives the right contrast for that role. Centralized
// here so any code that needs a node color (sync hook, tests, future
// preview components) reads from one source.
export const ROLE_SHADE_LIGHT: Record<NodeRole, Shade> = {
  bg: 50,
  border: 300,
  accent: 700,
  accentBg: 100,
  ring: 200,
  borderSelected: 600,
};

export const ROLE_SHADE_DARK: Record<NodeRole, Shade> = {
  bg: 900,
  border: 400,
  accent: 300,
  accentBg: 800,
  ring: 700,
  borderSelected: 300,
};

export type NodeRole = 'bg' | 'border' | 'accent' | 'accentBg' | 'ring' | 'borderSelected';
export const NODE_ROLES: readonly NodeRole[] = [
  'bg', 'border', 'accent', 'accentBg', 'ring', 'borderSelected',
];

const ROLE_TO_VAR_SUFFIX: Record<NodeRole, string> = {
  bg: 'bg',
  border: 'border',
  accent: 'accent',
  accentBg: 'accent-bg',
  ring: 'ring',
  borderSelected: 'border-selected',
};

// CSS variable name for a (role, kind) pair. Centralized so consumers and
// the sync hook can never drift.
export function nodeVar(role: NodeRole, kind: NodeKind): string {
  return `--bt-node-${ROLE_TO_VAR_SUFFIX[role]}-${kind.toLowerCase()}`;
}

// Resolve the hex value for a (family, role, theme) triple.
export function resolveNodeColor(
  family: ColorFamilyKey,
  role: NodeRole,
  theme: 'light' | 'dark',
): string {
  const shade = theme === 'dark' ? ROLE_SHADE_DARK[role] : ROLE_SHADE_LIGHT[role];
  return COLOR_FAMILIES[family].shades[shade];
}
