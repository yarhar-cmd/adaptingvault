# Mirrorvault Codex Rules

- Inspect existing code before changing it.
- Preserve the Mirrorvault visual identity: dark vault green, parchment, oxidized red, brass, and restrained geometric ornament.
- Reuse components instead of duplicating markup.
- Keep frontend and backend responsibilities separate.
- Centralize frontend API access in `apps/frontend/src/services`.
- Never commit secrets or real `.env` files.
- Do not remove accessibility features, keyboard controls, or reduced-motion handling.
- Update documentation whenever commands, environment variables, or architecture change.
- Run type checking and production builds after meaningful changes.
- Do not claim tests passed unless they were actually run.
