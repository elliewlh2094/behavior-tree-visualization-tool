import { useEffect, useRef, useState } from 'react';
import { usePreferencesStore } from '../../store/preferences-store';
import { NODE_KINDS } from '../../core/model/node';
import { ColorPicker } from './ColorPicker';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

// Slide-out drawer from the right edge (per plan D2: 320px wide; backdrop
// click and ESC dismiss). Fixed-positioned so its DOM location does not
// matter — App mounts it as a sibling to the editor layout.
//
// v1.3 Phase 2.5 narrows the user-customizable surface to *node colors only*
// (one family per kind) plus the theme toggle. Canvas/grid/edge/border
// thicknesses are designer-owned via tailwind.css tokens with light/dark
// overrides, preserving overall design consistency.
export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          data-testid="settings-backdrop"
          className="fixed inset-0 z-40 bg-transparent"
        />
      )}
      <aside
        role="dialog"
        aria-label="Settings"
        aria-hidden={!open}
        data-testid="settings-panel"
        className={`fixed right-0 top-0 z-50 flex h-full w-80 flex-col overflow-hidden border-l shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--bt-panel-bg)',
          borderColor: 'var(--bt-border)',
        }}
      >
        <header
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--bt-border)' }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--bt-text-primary)' }}
          >
            Settings
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            style={{ color: 'var(--bt-text-secondary)' }}
          >
            <svg
              viewBox="0 0 16 16"
              width={16}
              height={16}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden
            >
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <NodesSection />
          <ThemeSection />
        </div>

        <footer
          className="border-t px-4 py-3"
          style={{ borderColor: 'var(--bt-border)' }}
        >
          <ResetSection />
        </footer>
      </aside>
    </>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-5">
      <h3
        className="mb-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--bt-text-secondary)' }}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function NodesSection() {
  const nodeFamilyByKind = usePreferencesStore((s) => s.nodeFamilyByKind);
  const setNodeFamily = usePreferencesStore((s) => s.setNodeFamily);
  return (
    <Section title="Nodes">
      {NODE_KINDS.map((kind) => (
        <ColorPicker
          key={kind}
          label={kind}
          value={nodeFamilyByKind[kind]}
          onChange={(family) => setNodeFamily(kind, family)}
        />
      ))}
    </Section>
  );
}

function ThemeSection() {
  const theme = usePreferencesStore((s) => s.theme);
  const setPreference = usePreferencesStore((s) => s.setPreference);
  const options: Array<{ value: 'light' | 'dark' | 'system'; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];
  return (
    <Section title="Theme">
      <div role="radiogroup" aria-label="Theme" className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {options.map((o) => {
          const selected = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreference('theme', o.value)}
              className={`flex-1 rounded-md px-2 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                selected
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

// Click "Reset to Defaults" → in-place confirmation row replaces it; Yes wipes
// every preference back to baseline, No reverts the row. Avoids a modal for
// what is conceptually a single, undoable click.
function ResetSection() {
  const [confirming, setConfirming] = useState(false);
  const resetAll = usePreferencesStore((s) => s.resetAll);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
        style={{
          borderColor: 'var(--bt-border)',
          color: 'var(--bt-text-primary)',
          backgroundColor: 'var(--bt-panel-bg)',
        }}
      >
        Reset to Defaults
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm" style={{ color: 'var(--bt-text-primary)' }}>
        Reset all settings?
      </span>
      <button
        type="button"
        onClick={() => {
          resetAll();
          setConfirming(false);
        }}
        className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        No
      </button>
    </div>
  );
}
