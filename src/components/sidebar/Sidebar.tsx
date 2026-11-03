import { useState } from 'react';
import { PropertyPanel } from '../property-panel/PropertyPanel';
import { SettingsPanel } from '../settings/SettingsPanel';

type Tab = 'properties' | 'settings';

// 有兩個分頁的右側側邊欄。取代 v1.3 Phase 2 的滑出式設定抽屜與齒輪按鈕：
// Settings 不再是「執行某件事」的動作，而是與 Properties 並列的
// 資訊性同層檢視。
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

// 使用中的分頁與內容背景相同（--bt-panel-bg，slate-50），看起來是
// 連續的介面；非使用中的分頁使用 --bt-tab-inactive-bg（slate-300），
// 以清楚區隔。
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
