import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './components/landing/LandingPage';
import { EditorRoute } from './routes/EditorRoute';
import { usePreferencesSync } from './hooks/usePreferencesSync';
import { useTheme } from './hooks/useTheme';

export function App() {
  // Mirror the preferences store onto :root and own the `dark` class for BOTH
  // routes (landing + editor) so customized colors and theme apply before the
  // first tree opens and on the landing page too. Hoisted here from EditorRoute
  // because the landing page renders without that route mounted.
  usePreferencesSync();
  useTheme();

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
