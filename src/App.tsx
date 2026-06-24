import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './components/landing/LandingPage';
import { EditorRoute } from './routes/EditorRoute';

export function App() {
  // Theming is owned per-route, not globally: the landing page follows the
  // OS/browser only (useSystemThemeClass — no user control), while the editor
  // honors the saved preference (useTheme + usePreferencesSync in EditorRoute).
  // Hoisting it here would force one shared theme on both routes.

  // HashRouter (AD7): GitHub Pages is static hosting, so BrowserRouter deep
  // links (e.g. /editor) would 404 on refresh. The hash keeps routing fully
  // client-side and is invisible to the PWA service worker.
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/editor" element={<EditorRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
