# AI Development Rules & Discipline

This repository strictly enforces architectural boundaries, code formatting, security rules, and test integrity.

## Strict Rules for AI Assistants & Engineers

1. **Android / Kotlin / Gradle Focus**:
   - Do NOT add web frameworks, React, Node server proxies, or npm dependencies to Kotlin/Android modules.
   - All production Android code lives in Kotlin modules (`:app`, `:cloud`, `:core`, `:data`, `:domain`).

2. **Detekt & Code Style**:
   - Maintain zero Detekt violations.
   - Do NOT disable rules in `config/detekt/detekt.yml`, add broad `@Suppress`, or use detekt baseline files.
   - Respect function return count limits (maximum 4 return statements in any function).
   - Do NOT use magic numbers; extract constants into private companion objects or top-level constants.

3. **Test Integrity**:
   - Do NOT modify tests to bypass failures unless a test assertion is mathematically or logically incorrect.
   - Always fix production code before changing tests.
   - For `withPermit` in coroutines, run test blocks cleanly with `runTest`.

4. **Security & Redaction**:
   - Never log access tokens, refresh tokens, client secrets, file names, or unredacted URIs.
   - Always use `Redactor` utilities for sanitising logged data.

5. **CI / CD Pipeline**:
   - All GitHub Actions jobs must run on `ubuntu-24.04` and JDK 17 (`actions/setup-java@v5`).
   - Keep Room schema files committed and synchronized with Entity models.
