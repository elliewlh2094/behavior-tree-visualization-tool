// Curated palette: 6 columns x 4 rows. Row 1 neutrals (white → near-black);
// rows 2–3 mid-saturation accents; row 4 the soft pastels that match the
// node-bg defaults. Compact grid keeps each picker a single block in the
// settings panel rather than a popover dance.
const PALETTE: readonly string[] = [
  // neutrals
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#0f172a',
  // mid pastels
  '#fee2e2', '#fed7aa', '#fef3c7', '#dcfce7', '#cffafe', '#dbeafe',
  // accents
  '#fda4af', '#fdba74', '#fde68a', '#86efac', '#67e8f9', '#93c5fd',
  // node-bg defaults
  '#ecfeff', '#eff6ff', '#fdf4ff', '#fff7ed', '#ecfdf5', '#fefce8',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const normalized = value.toLowerCase();
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="min-w-[5.5rem] text-sm text-slate-700">{label}</span>
      )}
      <div
        role="radiogroup"
        aria-label={label ? `${label} color` : 'Color'}
        className="grid grid-cols-6 gap-1"
      >
        {PALETTE.map((color) => {
          const selected = color.toLowerCase() === normalized;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              onClick={() => onChange(color)}
              className={`h-5 w-5 rounded-sm border border-slate-300 transition-shadow focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                selected ? 'ring-2 ring-sky-600 ring-offset-1' : ''
              }`}
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
    </div>
  );
}

export const COLOR_PICKER_PALETTE = PALETTE;
