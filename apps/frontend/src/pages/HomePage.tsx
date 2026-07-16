import { Link } from 'react-router-dom';

const signals = [
  [
    'A',
    'Skill signal',
    'Completion time, damage, and retries estimate how much pressure feels manageable.',
    'hazard density and route width',
  ],
  [
    'B',
    'Playstyle signal',
    'Attacks, shields, movement, and exits reveal aggressive, defensive, or exploratory tendencies.',
    'room shape and traversal',
  ],
  [
    'C',
    'Route signal',
    'Floor coverage and directional choices estimate whether direct or optional space feels satisfying.',
    'room size and exits',
  ],
];

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero__seal" aria-hidden="true">
          R
        </div>
        <p className="eyebrow">An adaptive dungeon experiment</p>
        <h1>
          The dungeon is <em>watching how you play.</em>
        </h1>
        <p className="hero__intro">
          Cross five Awakening Chambers. Resonant Ruins reads your pace, tactics, and appetite for
          risk, then builds an endless dungeon around you.
        </p>
        <Link className="button button--primary" to="/dungeon">
          Start Run ↓
        </Link>
        <div className="experiment-summary" aria-label="Experiment summary">
          <div>
            <strong>05</strong>
            <span>Awakening Chambers</span>
          </div>
          <div>
            <strong>∞</strong>
            <span>generated rooms</span>
          </div>
          <div>
            <strong>00</strong>
            <span>data sent away</span>
          </div>
        </div>
      </section>

      <section className="home-intake">
        <div>
          <p className="section-number">01 / LIVE PROTOTYPE</p>
          <h2>Enter the experiment</h2>
          <p>Everything runs in this browser. Refresh or reset whenever you want to begin again.</p>
        </div>
        <div className="vault-preview" aria-hidden="true">
          <span className="vault-preview__player" />
          <span className="vault-preview__rune" />
          <span className="vault-preview__enemy vault-preview__enemy--one" />
          <span className="vault-preview__enemy vault-preview__enemy--two" />
          <span className="vault-preview__door" />
        </div>
      </section>

      <section className="method-section">
        <header>
          <p className="section-number">02 / THE METHOD</p>
          <h2>
            Same rules. <em>Different dungeon.</em>
          </h2>
          <p>The prototype changes room composition, not the physics underneath your feet.</p>
        </header>
        <div className="signal-grid">
          {signals.map(([letter, title, copy, change]) => (
            <article key={letter}>
              <span className="signal-letter">{letter}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <small>CHANGES → {change}</small>
            </article>
          ))}
        </div>
        <div className="constants">
          <span>Always constant</span>
          <ul>
            {[
              'collision physics',
              'player speed',
              'moveset',
              'attack cooldown',
              'environment rules',
            ].map((item) => (
              <li key={item}>◇ {item}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
