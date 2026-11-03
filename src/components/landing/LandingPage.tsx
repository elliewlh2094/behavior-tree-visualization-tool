import { useNavigate } from 'react-router-dom';
import { useSystemThemeClass } from '../../hooks/useTheme';
import { useLoadTemplate } from '../../hooks/useLoadTemplate';
import { TEMPLATES } from '../../templates';
import { useBTStore } from '../../store/bt-store';
import { createEmptyDocument } from '../../core/model/tree';

// 這裡沒有未存變更守衛：從 dirty 編輯器到達這個頁面的唯一方式，
// 是從編輯器導航離開，而編輯器自己的導航阻擋器（AD10）已經攔截這個動作。
// 在這裡再守衛一次會重複提示。

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
  const loadTemplate = useLoadTemplate();
  // 登陸頁只跟隨作業系統／瀏覽器的主題（這裡沒有使用者控制項）；
  // 登陸頁路由掛載期間，這個 hook 也負責套用 `dark` class。
  const resolvedTheme = useSystemThemeClass();

  return (
    <main className="min-h-screen w-screen overflow-y-auto bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 sm:py-24">
        {/* 主視覺區 */}
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
            onClick={() => {
              // 一律從頭開始：把 store 重設為只有一個 Root 的空白文件
              // （setDocument 也會把檔名固定為 Untitled.json 並清除歷史紀錄），
              // 讓 Go to Editor 永遠不會重新開啟先前載入的樹。
              useBTStore.getState().setDocument(createEmptyDocument());
              navigate('/editor');
            }}
            className="mt-8 rounded-lg bg-sky-700 px-6 py-3 text-base font-medium text-white shadow-subtle hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Go to Editor
          </button>
        </section>

        {/* 從範本開始 */}
        <section className="mt-16 w-full">
          <h2 className="text-center text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Or start from a template
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-6">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  loadTemplate(template);
                  navigate('/editor');
                }}
                className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-left transition hover:border-sky-400 hover:shadow-subtle focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-500"
              >
                <h3 className="text-lg font-semibold">{template.name}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {template.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* 產品截圖 */}
        <section className="mt-16 w-full">
          <img
            src={`${import.meta.env.BASE_URL}editor-overview.png`}
            alt="The BT Visualizer editor showing a behavior tree on the canvas with the node palette and property panel"
            width={2486}
            height={1327}
            className="w-full rounded-xl border border-slate-200 shadow-subtle dark:border-slate-700"
          />
        </section>

        {/* 功能重點 */}
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
