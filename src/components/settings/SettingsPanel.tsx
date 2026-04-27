import { useState } from 'react';
import { usePreferencesStore } from '../../store/preferences-store';
import { NODE_KINDS } from '../../core/model/node';
import { ColorPicker } from './ColorPicker';

// Settings tab body inside the right Sidebar. v1.3 Phase 2.6 dropped the
// slide-out drawer treatment: Settings is informational, not action-like,
// so it lives alongside Properties as a peer tab rather than behind a
// gear button. Phase 2.5's narrow surface stays — users only customize
// node color families and theme/grid, while canvas/edge/chrome colors
// remain designer-owned.
export function SettingsPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 px-4 py-4">
        <NodesSection />
        <ThemeSection />
        <GridSection />
      </div>
      <div
        className="border-t px-4 py-3"
        style={{ borderColor: 'var(--bt-border)' }}
      >
        <ResetSection />
      </div>
    </div>
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
    <Section title="Node Color">
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
  return (
    <Section title="Theme">
      <SegmentedPill
        ariaLabel="Theme"
        value={theme}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ]}
        onChange={(value) => setPreference('theme', value)}
      />
    </Section>
  );
}

// Binary on/off pill, same visual language as the Theme three-way.
// Replaces the previous iOS-style switch in the toolbar — grid show/hide
// is a *display* preference, so it lives next to Theme in the Settings
// tab rather than alongside one-shot actions like Undo/Validate/Layout.
function GridSection() {
  const showGrid = usePreferencesStore((s) => s.showGrid);
  const setPreference = usePreferencesStore((s) => s.setPreference);
  return (
    <Section title="Grid Background">
      <SegmentedPill
        ariaLabel="Grid background"
        value={showGrid ? 'on' : 'off'}
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ]}
        onChange={(v) => setPreference('showGrid', v === 'on')}
      />
    </Section>
  );
}

interface SegmentedPillProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function SegmentedPill<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: SegmentedPillProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg bg-slate-100 p-1"
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
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
        className="w-full rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
