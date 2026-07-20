# Resonant Ruins balance changelog

## mvp-0.2 — Rat Combat & Kiting

Initial values are centralized in `apps/frontend/src/config/combat.ts`.

- Increased Rat telegraph from 300 ms to 425 ms so one 200 ms player repeat interval leaves a readable dodge/turn response window.
- Replaced the former 1,200 ms cooldown with a 100 ms visual lunge followed by 300 ms standard recovery.
- Added a 500 ms total perfect-block recovery and a final 125 ms perfect-block input window.
- Added 500 ms room-entry awareness grace, 7-tile path awareness, and 3-tile attacked-Rat alert propagation.
- Changed generated Rat minimum spawn path distance from 5 to 4, requiring `generator-2` so generated output provenance remains explicit.
- Preserved Rat health (2), damage (1), movement interval (333 ms), sword range/damage/timing, player invulnerability (500 ms), and existing Rat count caps.
- Added deterministic escape-tile reservation protection only when static geometry offers at least two choices.

### Remaining balance questions

- Is 425 ms readable without making one-Rat attacks trivial to dodge?
- Does 300 ms recovery reliably permit one counterattack with the existing 400 ms sword cooldown?
- Is the 125 ms perfect-block window achievable at normal keyboard latency without dominating dodging?
- Does 500 ms perfect recovery create enough reward without trivializing multi-Rat pressure?
- Does 7-tile awareness activate authored and generated encounters at an understandable distance?
- Does the 4-tile generated spawn minimum create early pressure without unfair room entry?
- How frequently does body-lock prevention activate in real three- and four-Rat play?

Use development-only Combat Debug counters and manual browser sessions for tuning. Do not treat these counters as research telemetry.
