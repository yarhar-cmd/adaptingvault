import { Link } from 'react-router-dom';

export function MirrorvaultLogo() {
  return (
    <Link className="brand" to="/" aria-label="Resonant Ruins home">
      <span className="brand__mark" aria-hidden="true">
        R
      </span>
      <span>RESONANT RUINS</span>
    </Link>
  );
}
