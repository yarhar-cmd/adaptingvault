import { NavLink } from 'react-router-dom';
import { MirrorvaultLogo } from './MirrorvaultLogo';

const links = [
  ['/', 'Home'],
  ['/dungeon', 'Dungeon'],
  ['/characters', 'Characters'],
  ['/history', 'History'],
  ['/about', 'Method'],
  ['/settings', 'Settings'],
];

export function Header() {
  return (
    <header className="site-header">
      <MirrorvaultLogo />
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
      </nav>
      <span className="local-badge">LOCAL ONLY</span>
    </header>
  );
}
