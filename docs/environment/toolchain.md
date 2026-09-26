# Toolchain - Unified Cloud File Manager

| Field | Value |
|---|---|
| Document | Pinned Build Toolchain |
| Version | 1.0 |
| Status | **Versions decided and pinned. NOT INSTALLED. Phase 1 build verification is BLOCKED.** |
| Decided | 2026-09-26, Phase 1, decisions D-1.1 / D-1.2 / D-1.3 |
| Related documents | `Phases.md` §3, `Memory.md`, `Architecture.md` §4.1, §5 |

---

## 1. BLOCKER - toolchain absent

`PRD.md` R-20 and `Architecture.md` AR-19 record that the build toolchain was missing. **Re-verified 2026-09-26: still missing.**

| Component | Probe | Result |
|---|---|---|
| `java` | `java -version` | **NOT FOUND** |
| `javac` | `javac -version` | **NOT FOUND** |
| `JAVA_HOME` | env | **UNSET** |
| `gradle` | `gradle -v` | **NOT FOUND** (expected - the wrapper is used instead) |
| `ANDROID_HOME` | env | **UNSET** |
| `ANDROID_SDK_ROOT` | env | **UNSET** |
| SDK (default) | `%LOCALAPPDATA%\Android\Sdk` | **DOES NOT EXIST** |
| SDK (alt) | `C:\Android\Sdk` | **DOES NOT EXIST** |

**Consequence.** The Phase 1 exit criterion *"`./gradlew assembleDebug` succeeds on a fresh clone"* **cannot be evaluated** in this environment. Every other Phase 1 deliverable is complete. This is recorded as an open blocker, not silently skipped.

**No Gradle build in this repository has ever been executed.** There are zero git commits. Nothing has been compiled, and nothing in `build.gradle.kts` or `libs.versions.toml` has been validated by a build. Treat those files as authored, not verified.

---

## 2. Pinned versions (D-1.2, D-1.3)

| Component | Pinned | Rationale |
|---|---|---|
| **JDK** | **17 (Eclipse Temurin 17 LTS)** | AGP 8.x requires JDK 17 as its floor. 17 is the current LTS and avoids the JDK 21/25 toolchain-maturity risk on a fresh machine. Do not use a newer JDK without re-checking AGP compatibility. |
| **Gradle** | **8.11.1** | Required by AGP 8.7.x. Pinned via `gradle/wrapper/gradle-wrapper.properties`; the distribution SHA-256 is **not yet** set (B-8). |
| **Android Gradle Plugin** | **8.7.3** | Stable at time of decision; requires Gradle 8.9+ and JDK 17. |
| **Kotlin** | **2.0.21** | Compose compiler ships as a Kotlin plugin from 2.0 onward, so no separate `composeOptions` block and no version skew between compiler and Kotlin. |
| **KSP** | **2.0.21-1.0.28** | Must match the Kotlin version exactly. Room is processed by KSP, not kapt. |
| **compileSdk / targetSdk** | **35** (PROVISIONAL) | See D-1.1 below. |
| **minSdk** | **26** (PROVISIONAL) | See D-1.1 below. |
| **Gradle dependency verification** | enabled | `Architecture.md` §27.2 requires it. |

### 2.1 D-1.1 - SDK levels (PROVISIONAL, verify before first build)

`PRD.md` §8.6 requires `targetSdk`/`compileSdk` to be *decided at Phase 1, not guessed*. The decision is made here; the **verification step is not yet performed**, because no SDK is installed to verify against.

| Level | Value | Reasoning |
|---|---|---|
| `minSdk` = 26 | Android 8.0 | Hardware-backed Keystore keys, adaptive icons, and scoped-storage-era APIs are all available. Below 21, Compose is unsupported. `AuthorizationClient` (ADR-01) is the binding constraint and **has not been audited** - see the open item below. |
| `compileSdk` = 35 | Android 15 | Compiles against the newest stable platform API. |
| `targetSdk` = 35 | Android 15 | Behaviour-targets the same platform. |

**These are reasoned pins from compatibility constraints, not values read from a current release listing.** Before the first successful build:

- [ ] Confirm the newest stable `compileSdk`/`targetSdk` and raise them if higher. (`Architecture.md` AR-12, and the `PRD.md` §8.6 instruction to use "current stable at implementation time".)
- [ ] **D-1.3 dependency audit:** resolve Q-12 - the actual `minSdk` floor imposed by `androidx.credentials`, `DocumentsProvider`, Compose, and WorkManager. If the floor exceeds 26, **raise `minSdk` and accept the smaller audience**; do not work around it. AR-12 rates this **High** probability.
- [ ] Confirm AGP 8.7.3 / Kotlin 2.0.21 / Gradle 8.11.1 are still a mutually compatible triple. Newer AGP will be available; adopting it is a deliberate upgrade, not a default.

---

## 3. Install procedure

Run in order. Steps 1-3 are the blocker; 4-6 are verification.

### 3.1 JDK 17

```powershell
winget install --id EclipseAdoptium.Temurin.17.JDK -e
```

Then set for the session (persist via System Properties, not a repo file):

```powershell
$env:JAVA_HOME = (Split-Path -Parent (Split-Path -Parent (Get-Command java).Source))
```

### 3.2 Android SDK

```powershell
winget install --id Google.AndroidStudio -e
```

Then via `sdkmanager` (Android Studio's SDK Manager, or command-line tools):

```
platform-tools
platforms;android-35
build-tools;35.0.0
```

Set, and persist in the user environment:

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
```

### 3.3 Accept licences

```powershell
sdkmanager --licenses
```

An unaccepted licence blocks the first build with an unhelpful error. Accept all.

### 3.4 Gradle wrapper — INCOMPLETE

`gradle/wrapper/gradle-wrapper.properties` **is** committed. The following are
**not yet present** and must not be assumed to exist:

| Missing | Why | How to produce it |
|---|---|---|
| `gradle/wrapper/gradle-wrapper.jar` | A binary. It cannot be hand-authored, and authoring a fake one would be worse than its absence | `gradle wrapper` (needs a JDK) |
| `gradlew` / `gradlew.bat` | Generated alongside the jar | same |
| `distributionSha256Sum` | No hash was available to write, and inventing one would be a supply-chain hazard disguised as a security control | `gradle wrapper --gradle-distribution-sha256-sum <hash>` from `gradle.org/release-checksums/` |

Until the jar and the scripts exist, **`./gradlew` will not run in this
repository**, and the Phase 1 exit criterion cannot be evaluated by anyone, not
just in this environment. This is B-8 in `Memory.md` §4.

After a JDK is installed:

```powershell
gradle wrapper --gradle-version 8.11.1 --gradle-distribution-sha256-sum <hash>
git add gradle/wrapper gradlew gradlew.bat
```

### 3.5 First build

```powershell
.\gradlew.bat assembleDebug
```

### 3.6 Local SDK path

`local.properties` is **gitignored** and machine-specific. It is created by the IDE or manually:

```properties
sdk.dir=C\:\\Users\\<user>\\AppData\\Local\\Android\\Sdk
```

---

## 4. What is blocked until this is installed

This table is by **build criterion** — what must be demonstrated — and is a
subset of the canonical blocker register in `Memory.md` §4, which is keyed by
**root cause**. Cite a `Memory.md` ID when recording a blocker; use this table to
see which criterion a given root cause is holding up.

| Criterion | Phase | Blocked by | Note |
|---|---|---|---|
| `./gradlew assembleDebug` on a fresh clone | 1 | B-1, B-2, B-3 | The Phase 1 exit criterion. |
| Domain-purity enforcement actually failing on a bad import | 3, 5 | B-1 | The Gradle config is authored; it has never executed. An unexecuted gate is a hope, not a guarantee. |
| KSP / Room schema generation | 6 | B-1, B-2 | No generated schema has ever been produced. |
| The CI pipeline running any stage | 3 | B-1 | `ci.yml` is authored; no stage has ever executed. |
| Detekt / lint / ktlint baselines | 3 | B-1 | No analysis has ever run, so there is no baseline. |
| Gradle dependency verification hashes | 3 | B-1 | Verification metadata is produced by a first successful resolution. |
| Wrapper distribution checksum | 3 | B-8 | `distributionSha256Sum` is deliberately absent. CI fails while it is. |

**Nothing in the repository has ever been compiled.** This is stated plainly so
that no later reader mistakes authored configuration for a build that passed.

---

## 5. Reproducibility

- `gradle/wrapper/gradle-wrapper.properties` pins the Gradle distribution URL. It does **not** yet pin a SHA-256: the value is absent rather than invented, and CI fails until it is added (B-8). Complete it with `gradle wrapper --gradle-distribution-sha256-sum <hash>` using the hash from `gradle.org/release-checksums/`.
- `gradle/verification-metadata.xml` is generated on first resolution and then committed. Until it exists, dependency verification is **not** enforced — a real gap, recorded in B-5.
- All dependency versions are declared in `gradle/libs.versions.toml` only. No version literal appears in any module build file.
- **The pinned combination is unverified.** AGP 8.7.3 / Gradle 8.11.1 / Kotlin 2.0.21 / KSP 2.0.21-1.0.28 have never been resolved together. A pin is a decision, not a validated set.
