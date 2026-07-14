# Future backend plan

Mirrorvault should evolve in stages. Each stage should add one operational responsibility without coupling the React interface to infrastructure details.

## 1. Durable saved adventures

Introduce a relational database such as PostgreSQL. Add repository interfaces behind the adventure service, create migration scripts, and store run configuration, room events, decisions, timestamps, and adaptation summaries. Keep raw interaction events separate from display-ready run summaries.

## 2. User accounts

Use a well-supported authentication provider or a carefully audited server-side session implementation. Store only a stable external user identifier and profile preferences. Protect saved-run routes with authentication middleware. Add account export and deletion before collecting meaningful player histories.

## 3. AI-generated adventures

Create a provider-neutral `AdventureGenerator` interface inside the backend service layer. Feed it a validated, bounded adaptation profile rather than unrestricted browser text. Require structured output, validate every generated room, and fall back to authored templates when validation fails. Keep provider keys on the server and label generated content honestly.

## 4. Safety and moderation

Limit free-text inputs, normalize and validate all configuration fields, and moderate user-supplied character or story content before generation. Define prohibited-content behavior and age-appropriate defaults. Never place private account data inside model prompts unless the feature explicitly requires it and the user understands the use.

## 5. Rate limiting and abuse controls

Apply per-account and per-IP limits to generation and contact routes. Set body limits, request timeouts, concurrency caps, and idempotency keys for expensive requests. Track quota decisions separately from story content.

## 6. Error monitoring

Add structured request IDs and a privacy-aware error-monitoring service. Redact tokens, email addresses, prompt bodies, and adventure text by default. Measure API latency, provider failures, validation failures, and fallback rates.

## 7. Production deployment

Containerize or otherwise package the frontend and API independently. Use managed HTTPS, a private secret store, database backups, migration gates, health/readiness endpoints, and separate staging and production environments. Restrict CORS to the deployed frontend origin and add a Content Security Policy.

## Suggested data model

- `users`: account identifier, display preferences, timestamps
- `characters`: owner, name, archetype, safe structured attributes
- `adventures`: owner, configuration, mode, status, timestamps
- `rooms`: adventure, order, stable mechanics version, generated composition
- `events`: room, event type, bounded payload, timestamp
- `adaptation_profiles`: adventure, calculated weights, explanation

## Recommended first production feature

Build durable saved adventures before AI generation. It exercises authentication, authorization, migrations, repositories, data deletion, and history UI with deterministic content, creating a reliable foundation for later generation work.
