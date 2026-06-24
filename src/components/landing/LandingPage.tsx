import { useNavigate } from 'react-router-dom';
import { useSystemThemeClass } from '../../hooks/useTheme';

interface Feature {
  title: string;
  description: string;
}

const FEATURES: readonly Feature[] = [
  {
    title: 'Author visually',
    description:
      'Drag nodes from the palette, connect them on an infinite canvas, and edit properties in a side panel — no JSON by hand.',
  },
  {
    title: 'Validate as you go',
    description:
      'Structural rules (single root, arity, no cycles) are checked live so malformed trees surface before you export.',
  },
  {
    title: 'Multi-tree tabs',
    description:
      'Keep related subtrees in one workspace, switch between them in tabs, and lay each out automatically.',
  },
  {
    title: 'Yours, offline',
    description:
      'Open and save plain JSON files, theme the editor light or dark, and keep working offline as an installable PWA.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  // Landing follows the OS/browser theme only (no user control here); this also
  // applies the `dark` class while the landing route is mounted.
  const resolvedTheme = useSystemThemeClass();

  return (
    <main className="min-h-screen w-screen overflow-y-auto bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 sm:py-24">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <img
            src={`${import.meta.env.BASE_URL}${resolvedTheme === 'dark' ? 'icon-dark.svg' : 'icon.svg'}`}
            alt=""
            width={72}
            height={72}
          />
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            BT Visualizer
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
            Author, visualize, and validate behavior trees in your browser.
          </p>
          <button
            type="button"
            onClick={() => navigate('/editor')}
            className="mt-8 rounded-lg bg-sky-700 px-6 py-3 text-base font-medium text-white shadow-subtle hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Go to Editor
          </button>
        </section>

        {/* Product screenshot */}
        <section className="mt-16 w-full">
          <img
            src={`${import.meta.env.BASE_URL}editor-overview.png`}
            alt="The BT Visualizer editor showing a behavior tree on the canvas with the node palette and property panel"
            width={2486}
            height={1327}
            className="w-full rounded-xl border border-slate-200 shadow-subtle dark:border-slate-700"
          />
        </section>

        {/* Feature highlights */}
        <section className="mt-16 grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
            >
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
