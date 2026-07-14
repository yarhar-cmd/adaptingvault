import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="not-found">
      <span>404</span><p className="eyebrow">Unmapped chamber</p><h1>The vault has no memory of this path.</h1><Link className="button button--primary" to="/">Return to the entrance</Link>
    </section>
  );
}
