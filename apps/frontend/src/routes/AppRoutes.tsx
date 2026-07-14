import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AboutPage } from '../pages/AboutPage';
import { CharactersPage } from '../pages/CharactersPage';
import { ContactPage } from '../pages/ContactPage';
import { DungeonPage } from '../pages/DungeonPage';
import { HistoryPage } from '../pages/HistoryPage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SettingsPage } from '../pages/SettingsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="dungeon" element={<DungeonPage />} />
        <Route path="characters" element={<CharactersPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
