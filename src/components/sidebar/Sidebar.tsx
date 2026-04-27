import { useState } from 'react';
import { PropertyPanel } from '../property-panel/PropertyPanel';
import { SettingsPanel } from '../settings/SettingsPanel';

type Tab = 'properties' | 'settings';

// Right-side sidebar with two tabs. Replaces v1.3 Phase 2's slide-out
// settings drawer and gear-button affordance: Settings is no longer a
// "do something" action — it's an informational surface that lives
// alongside Properties as a peer view.
export function Sidebar() {
  const [active, setActive] = useState<Tab>('properties');

  return (
    <aside
      className="flex h-full w-64 flex-col border-l"
      style={{ borderColor: 'var(--bt-border)' }}
    >
      <div
        role="tablist"
        aria-label="Sidebar"
        className="flex"
        style={{ borderBottom: '1px solid var(--bt-border)' }}
      >
        <SidebarTab
          label="Properties"
          active={active === 'properties'}
          onClick={() => setActive('properties')}
        />
        <SidebarTab
          label="Settings"
          active={active === 'settings'}
          onClick={() => setActive('settings')}
        />
      </div>
      <div
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: 'var(--bt-panel-bg)' }}
      >
        {active === 'properties' ? <PropertyPanel /> : <SettingsPanel />}
      </div>
    </aside>
  );
}

interface SidebarTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

// Active tab matches the body bg (--bt-panel-bg, slate-50) so it reads
// as a continuous surface; inactive tab uses --bt-tab-inactive-bg
// (slate-300) for clear separation.
function SidebarTab({ label, active, onClick }: SidebarTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex-1 px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500"
      style={{
        backgroundColor: active
          ? 'var(--bt-panel-bg)'
          : 'var(--bt-tab-inactive-bg)',
        color: active ? 'var(--bt-text-primary)' : 'var(--bt-text-secondary)',
      }}
    >
      {label}
    </button>
  );
}
