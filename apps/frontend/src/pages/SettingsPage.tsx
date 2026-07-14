import { PageContainer } from '../components/layout/PageContainer';
import { useAdventure } from '../hooks/useAdventure';

export function SettingsPage() {
  const { settings, setSettings } = useAdventure();
  const toggle = (key: keyof typeof settings) => setSettings({ ...settings, [key]: !settings[key] });
  return (
    <PageContainer eyebrow="Local controls" title="Settings" intro="These preferences are stored in your browser and can be changed at any time.">
      <div className="settings-list">
        <label><span><strong>Ambient sound</strong><small>Reserved for future local audio. No sound file is included yet.</small></span><input type="checkbox" checked={settings.sound} onChange={() => toggle('sound')} /></label>
        <label><span><strong>Reduce motion</strong><small>Disables decorative transitions and pulses.</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={() => toggle('reducedMotion')} /></label>
        <label><span><strong>High contrast</strong><small>Strengthens text and interface borders.</small></span><input type="checkbox" checked={settings.highContrast} onChange={() => toggle('highContrast')} /></label>
      </div>
    </PageContainer>
  );
}
