import { Link } from 'react-router-dom';
import { MirrorvaultLogo } from './MirrorvaultLogo';

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <MirrorvaultLogo />
        <p>A local-first proof of concept for adaptive procedural generation.</p>
      </div>
      <div className="footer-links">
        <Link to="/about">About the method</Link>
        <Link to="/contact">Contact</Link>
        <span>AI ENGINEERING &amp; INNOVATION · 2026</span>
      </div>
    </footer>
  );
}
