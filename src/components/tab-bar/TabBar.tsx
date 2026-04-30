import { useBTStore } from '../../store/bt-store';

export function TabBar() {
  const trees = useBTStore((s) => s.document.trees);
  const mainTreeId = useBTStore((s) => s.document.mainTreeId);
  const activeTreeId = useBTStore((s) => s.activeTreeId);
  const setActiveTreeId = useBTStore((s) => s.setActiveTreeId);

  return (
    <div
      role="tablist"
      aria-label="Trees"
      className="flex items-stretch"
      style={{
        backgroundColor: 'var(--bt-panel-bg)',
        borderBottom: '1px solid var(--bt-border)',
      }}
    >
      {trees.map((t) => (
        <TreeTab
          key={t.id}
          name={t.name}
          isMain={t.id === mainTreeId}
          isActive={t.id === activeTreeId}
          onClick={() => setActiveTreeId(t.id)}
        />
      ))}
      <button
        type="button"
        aria-label="Create new tree"
        title="Create a new tree (coming soon)"
        disabled
        className="flex items-center px-3 text-lg leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 disabled:cursor-not-allowed"
        style={{
          color: 'var(--bt-text-secondary)',
        }}
      >
        +
      </button>
    </div>
  );
}

interface TreeTabProps {
  name: string;
  isMain: boolean;
  isActive: boolean;
  onClick: () => void;
}

function TreeTab({ name, isMain, isActive, onClick }: TreeTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      title={name}
      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500"
      style={{
        minWidth: 140,
        maxWidth: 180,
        backgroundColor: isActive
          ? 'var(--bt-panel-bg)'
          : 'var(--bt-tab-inactive-bg)',
        color: isActive ? 'var(--bt-text-primary)' : 'var(--bt-text-secondary)',
      }}
    >
      {isMain && <HomeIcon />}
      <span className="truncate">{name}</span>
    </button>
  );
}

function HomeIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 7l6-5 6 5v7H2z" />
    </svg>
  );
}
