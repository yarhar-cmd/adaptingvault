import { PageContainer } from '../components/layout/PageContainer';

export function AboutPage() {
  return (
    <PageContainer eyebrow="The method" title="Same rules. Different dungeon." intro="Mirrorvault is an interaction-design experiment: procedural generation becomes legible when players can compare a stable ruleset against changing room composition.">
      <div className="prose-grid">
        <article><span>01</span><h2>Observe</h2><p>Assessment rooms record simple local signals: pace, damage, attacks, defensive actions, route choice, and appetite for optional risk.</p></article>
        <article><span>02</span><h2>Interpret</h2><p>The prototype translates those signals into plain playstyle weights. It does not diagnose skill or personality.</p></article>
        <article><span>03</span><h2>Recompose</h2><p>Adaptive rooms alter encounter density, puzzle emphasis, and reward placement without changing player physics.</p></article>
      </div>
      <aside className="note-panel"><strong>Prototype boundary</strong><p>This local edition uses deterministic mock scenes. It does not call an AI model, authenticate users, or persist data outside the browser.</p></aside>
    </PageContainer>
  );
}
