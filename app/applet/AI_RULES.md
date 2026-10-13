# AI & Developer Coding Rules (Unified Cloud File Manager)

Every future AI or human edit must strictly follow these rules:
- **Complexity**: Maximum cyclomatic complexity of 15 per function.
- **Return Count**: Maximum 4 return statements per function.
- **Magic Numbers**: Extract numeric literals into named `const val` declarations.
- **Unused Code**: No unused private members or private properties.
- **Declaration Names**: File name must match its single top-level declaration (or be organised accordingly).
- **Whitespace**: No trailing spaces or consecutive blank lines.
- **Tests**: All unit and instrumented tests must pass. Never weaken, skip, or `@Ignore` tests.
- **Room Schema**: Room schemas under `data/schemas/` must be committed whenever entities change. Bump version and add migration.
- **Web Tooling**: NEVER add or change Vite, React, Tailwind, npm, or any web tooling files. Android/Kotlin/Gradle stack only.
- **Preflight**: Run `scripts/verify.sh` (or `./gradlew preflight`) before every push.
