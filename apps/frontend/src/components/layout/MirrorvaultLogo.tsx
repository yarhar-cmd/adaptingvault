import { Link } from 'react-router-dom';

export function MirrorvaultLogo() {
  return (
    <Link className="brand" to="/" aria-label="Mirrorvault home">
      <span className="brand__mark" aria-hidden="true">
        M
      </span>
      <span>MIRRORVAULT</span>
    </Link>
  );
}
