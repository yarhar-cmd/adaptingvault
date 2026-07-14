import { NavLink } from 'react-router-dom';

const links = [
  ['/', 'Home'],
  ['/dungeon', 'Play'],
  ['/characters', 'Heroes'],
  ['/history', 'Runs'],
  ['/settings', 'Settings'],
];

export function MobileNavigation() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {links.map(([to, label]) => (
        <NavLink key={to} to={to} end={to === '/'}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
