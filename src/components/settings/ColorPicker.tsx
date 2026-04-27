import { useState } from 'react';
import {
  COLOR_FAMILIES,
  COLOR_FAMILY_KEYS,
  type ColorFamilyKey,
} from '../canvas/color-families';

interface ColorPickerProps {
  value: ColorFamilyKey;
  onChange: (family: ColorFamilyKey) => void;
  label: string;
}

// Click-to-expand row: collapsed shows the kind label + a small swatch
// previewing the picked family; expanded reveals a 22-swatch grid (one
// per Tailwind hue family). Picking a family auto-collapses.
//
// Each row owns its own expanded state — multiple kinds can be open at
// once if the user wants to compare. Tested in unit tests.
export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const current = COLOR_FAMILIES[value];

  return (
    <div className="rounded-md border border-slate-200 px-2 py-1.5 dark:border-slate-700">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
      >
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{label}</span>
        <span
          aria-hidden
          className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
          style={{ backgroundColor: current.shades[300] }}
        />
        <span className="w-14 text-right text-xs text-slate-500 dark:text-slate-400">
          {current.label}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          role="radiogroup"
          aria-label={`${label} color family`}
          className="mt-2 grid grid-cols-8 gap-1"
        >
          {COLOR_FAMILY_KEYS.map((key) => {
            const f = COLOR_FAMILIES[key];
            const selected = key === value;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={f.label}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`h-6 w-6 rounded border border-slate-300 transition-shadow focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:ring-offset-slate-800 ${
                  selected ? 'ring-2 ring-sky-600 ring-offset-1 dark:ring-sky-400' : ''
                }`}
                style={{ backgroundColor: f.shades[300] }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={`text-slate-400 transition-transform dark:text-slate-500 ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
