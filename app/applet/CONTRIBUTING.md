# Contributing to Unified Cloud File Manager

Before every push, run `scripts/verify.sh` (or `./gradlew preflight`) to ensure detekt, unit tests, and Room schema checks pass successfully and prevent CI failures.

To set up the local git pre-push hook automatically:
```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-push gradlew scripts/verify.sh
```

## Definition of Done Checklist
- [ ] Code follows all guidelines in `AI_RULES.md`.
- [ ] `./gradlew detekt --auto-correct` and `./gradlew detekt lint testDebugUnitTest :data:kspDebugKotlin` pass cleanly.
- [ ] Room schemas (`data/schemas/`) are updated and committed if any entities changed (with version bump and migration).
- [ ] `git status --porcelain data/schemas` shows no uncommitted schema drift.
- [ ] `./scripts/verify.sh` exits with 0.
