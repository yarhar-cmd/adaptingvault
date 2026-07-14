import { Outlet } from 'react-router-dom';
import { useAdventure } from '../../hooks/useAdventure';
import { useApiHealth } from '../../hooks/useApiHealth';
import { Footer } from './Footer';
import { Header } from './Header';
import { MobileNavigation } from './MobileNavigation';

export function AppShell() {
  const apiOnline = useApiHealth();
  const { settings } = useAdventure();

  return (
    <div
      className={`app-shell ${settings.highContrast ? 'is-high-contrast' : ''} ${settings.reducedMotion ? 'reduce-motion' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <MobileNavigation />
      <div className={`api-status ${apiOnline ? 'is-online' : ''}`} title="Local API status">
        <span aria-hidden="true" />
        {apiOnline === null ? 'API checking' : apiOnline ? 'Local API linked' : 'Demo-only mode'}
      </div>
    </div>
  );
}
