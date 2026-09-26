# Phases - Unified Cloud File Manager

| Field | Value |
|---|---|
| Document | Delivery Phases |
| Version | 0.1 - **RECONSTRUCTED** |
| Status | **Phase 1 IN PROGRESS by human decision (2026-09-26). Phases 3 and 5 also begun. Phase 0 exit criteria remain UNMET.** |
| Reconstructed on | 2026-09-26 |
| Reconstructed from | `PRD.md` v1.0 (2055 lines), `Architecture.md` v1.0 (2558 lines) |
| Related documents | `PRD.md`, `Architecture.md`, `Rules.md`, `Design.md`, `Memory.md` |

---

## 0. Provenance - read this before using this document

**This document is a reconstruction, not a record.**

The original `Phases.md` for this project did not exist when this file was written. `Rules.md`, `Design.md`, and `Memory.md` do not exist either. All four are referenced by name from `PRD.md` and `Architecture.md`, so they were planned and never written.

This file was derived by reading `PRD.md` and `Architecture.md` in full and extracting the phase structure they imply. It contains **no knowledge of what was actually done, decided, or discussed.** Where those two documents specify a phase number, that number is reproduced and cited. Where they imply a phase exists but never name it, the phase has been **inferred** to fill the gap and is marked as such.

| Marker | Meaning |
|---|---|
| **ANCHORED** | The source documents explicitly name this phase number. The citation is given. Treat the phase *number and purpose* as sourced. |
| **INFERRED** | The source documents reference neighbouring phase numbers but never define this one. The phase's position and purpose were derived from layer ordering and feature dependencies. **Confirm or correct before relying on it.** |
| **NOT STARTED** | No work has begun. This is the only status any phase is permitted to carry until a human updates this file. |

**No status in this document may be advanced by an agent or a tool.** Phase transitions are a human decision recorded here.

**What this document is not:** it is not a substitute for `Memory.md`. It carries no decision log, no dead ends, no measured results, and no rationale for choices made in conversation. Those are unrecoverable from the current repository state.

### 0.1 Human decisions recorded here

| Date | Decision | Recorded by |
|---|---|---|
| 2026-09-26 | The **inferred** phases 3, 5, 6, 7, 8, 9, 13, 16 are **confirmed** as correct and retained. | Human |
| 2026-09-26 | **Phase 1 is opened** despite Phase 0 exit criteria being unmet. See the note below. | Human |

### 0.2 Phase 1 was opened ahead of Phase 0 — an accepted deviation

Phase 0 exit criteria (§2.5) are **not met**. V-01 is unanswered and unowned; no
`docs/validation/` finding exists; the toolchain is not installed.

A human opened Phase 1 anyway, on 2026-09-26, with the instruction to proceed on
everything that does not depend on the missing answers and to record the rest as
blockers. This is a **deliberate, recorded deviation** from the phase ordering,
not an oversight.

**What it is safe to do under this deviation.** Engineering that encodes no
measured claim: the module graph, the build configuration, the domain model, the
error taxonomy, the CI gates, and the documentation set. None of it asserts a
Drive behaviour, a quota figure, a scope outcome, or a `minSdk` floor. If V-01
fails and the product re-scopes to `drive.file`, **this work survives intact**,
because none of it depends on holding the restricted scope.

**What remains genuinely blocked,** and must not be presented as ready:

- Anything requiring a build (no JDK, no SDK) — including every claim that the
  configuration *works*.
- Anything depending on the `drive` scope being granted (Phase 14 write
  operations are conditional on it, `PRD.md` §30.2).
- Anything depending on measured Drive behaviour (Q-05…Q-11).
- Product decisions, consent flows, and anything a user would see
  (`Design.md` does not exist).

The distinction that keeps this deviation honest: **the work is sequenced so that
the parts that are cheap to do are also the parts that are cheap to throw away.**
If V-01 goes badly, the correct response is to re-scope, not to unpick a domain
layer that was never coupled to the answer.

---

## 1. Phase index

| Phase | Name | Provenance | Purpose in one line | Status |
|---|---|---|---|---|
| **0** | Validation | **ANCHORED** - `PRD.md` §29, §29.1; `Architecture.md` §3.3 | Resolve whether this product is permitted to exist, before writing product code | NOT STARTED |
| **1** | Foundation | **ANCHORED** - `PRD.md` §28 R-20, §8.6, §10.2; `Architecture.md` §32 AR-12, AR-19, §33.5.8 | Install and pin the toolchain; fix the build configuration | **IN PROGRESS** - pins authored, **build never run** (B-1) |
| **2** | UX validation | **ANCHORED** - `PRD.md` §29 V-16, V-17 | Prototype the connect flow and test the unified model with real users | NOT STARTED |
| **3** | Skeleton and CI | **INFERRED** | Module graph, version catalogue, CI gates green on an empty app | **AUTHORED, UNVERIFIED** - config exists, no stage has run |
| **4** | OAuth and account connection | **ANCHORED** - `PRD.md` §29 V-03, §28 R-05 | Connect one account, then a second, correctly isolated | NOT STARTED - **blocked on V-01, Q-01** |
| **5** | Domain core | **INFERRED** | Pure-Kotlin models, error taxonomy, repository interfaces, provider interface | **AUTHORED, UNVERIFIED** - written, never compiled |
| **6** | Local database | **INFERRED** | Account-scoped Room schema, migrations, cache repository | **SCHEMA AUTHORED, UNVERIFIED** - 8 entities, 3 DAOs, no `Migration` (v1) |
| **7** | Drive provider | **INFERRED** | `GoogleDriveProvider`, explicit `fields`, `QuotaGovernor`, error mapping | NOT STARTED |
| **8** | Account management | **INFERRED** | Token state machine, Keystore storage, account screens, disconnect | NOT STARTED |
| **9** | Browsing and index | **INFERRED** | Unified + per-account browser, deterministic merge, cache-first render | NOT STARTED |
| **10** | Search | **ANCHORED** - `PRD.md` §29 V-07, §28 R-08 | Cross-account fan-out with mandatory completeness disclosure | NOT STARTED |
| **11** | Gallery | **ANCHORED** - `PRD.md` §29 V-08, V-09 | Photo/video grid, thumbnail policy, account badge on every cell | NOT STARTED |
| **12** | Transfers | **ANCHORED** - `PRD.md` §29 V-10 | Upload and download with progress, cancel, retry, quota handling | NOT STARTED |
| **13** | Preview and details | **INFERRED** | File details, open, preview, open-with, copy link | NOT STARTED |
| **14** | Write operations | **ANCHORED** - `PRD.md` §29 V-11, §30.2 | Rename, move, trash, create folder - **conditional on `drive` scope** | NOT STARTED |
| **15** | Android integration | **ANCHORED** - `PRD.md` §29 V-12, V-13, §28 R-10 | `DocumentsProvider`, `FileProvider`, OEM device matrix | NOT STARTED |
| **16** | Offline, errors, accessibility, privacy | **INFERRED** | Error matrix, offline behaviour, a11y, analytics wrapper, settings | NOT STARTED |
| **17** | Security review | **ANCHORED** - `PRD.md` §29 V-15, V-20; `Architecture.md` §32 AR-10/11/14/15 | Independent review; token deletion proof; telemetry SDK decision | NOT STARTED |
| **18** | Performance and load | **ANCHORED** - `PRD.md` §29 V-18; `Architecture.md` §32 AR-09 | 10k-item gallery, cold start, search latency, memory ceiling | NOT STARTED |
| **19** | Beta and release | **ANCHORED** - `PRD.md` §28 R-19; `Architecture.md` §27.4 | Internal track, closed beta, release checklist | NOT STARTED |

**Phase 0 is the only phase whose internal structure is fully specified by the source documents.** Phases 1, 2, 4, 10, 11, 12, 14, 15, 17, 18, 19 have a known number, purpose, and owning validation items, but their entry and exit criteria are not written down anywhere. Phases 3, 5, 6, 7, 8, 9, 13, 16 are inferred in their entirety.

---

## 2. Phase 0 - Validation

**Provenance: ANCHORED.** `PRD.md` §29 (validation plan, V-01…V-20), §29.1 (sequence), `Architecture.md` §3.3 (Q-01…Q-12).

Phase 0 exists because the product's core feature cannot be delivered on a non-sensitive OAuth scope. `drive.readonly` and `drive` are **restricted**; `drive.file` cannot enumerate an account (`PRD.md` §9.2, §1.7). Restricted scopes require OAuth verification, an annual third-party security assessment, and justification as a permitted application type. Whether a multi-account file manager qualifies is **unestablished**. This is a commercial and schedule risk before it is a technical one, and it is resolved here or not at all.

### 2.1 What Phase 0 produces

A `docs/validation/` directory (`Architecture.md` §28) containing one file per validated item. Per `Architecture.md` §28: every `REQUIRES VALIDATION` marker in the documents should end with a file there, or remain a live open issue. **A `REQUIRES VALIDATION` marker that is silently dropped is a defect.**

Measured values are recorded here and hard-coded nowhere (`PRD.md` §29 V-06; `Architecture.md` §33.5.6).

### 2.2 Blocking questions (`Architecture.md` §3.3)

| # | Question | Blocks | Validation ID |
|---|---|---|---|
| Q-04 | Is a multi-account personal file manager a **permitted application type** for restricted scopes? | **The product** | V-01 |
| Q-02 | Does Google's installed-app PKCE flow work for Android without a backend? | Whether a backend exists at all | V-04, V-14 |
| Q-01 | Does `AuthorizationClient` yield a Drive-suitable **refresh token**, or only a short-lived credential? | The entire OAuth design (ADR-03, ADR-05) | V-05 |
| Q-03 | If a backend is used, what is the minimum it must store, and what assessment tier results? | Compliance budget, backend design | V-14, V-19 |
| Q-12 | What `minSdk` do the chosen dependencies impose? | Build configuration | - (Phase 1) |
| Q-05 | Real per-project Drive API quotas | Fan-out sizing, cache policy | V-06 |
| Q-06 | Real `files.list` result caps and `q` operator semantics | Completeness disclosure | V-07 |
| Q-07 | How long do `thumbnailLink` values stay valid? | Thumbnail cache policy | V-08 |
| Q-08 | Can Google-native Docs/Sheets/Slides be exported, or only linked? | Preview behaviour | V-09 |
| Q-09 | Is resumable upload supported, and does it survive process death? | Background upload strategy | V-10 |
| Q-10 | Drive's real semantics for duplicate names, versioning, folder creation | Upload UI copy | V-11 |
| Q-11 | Does `openDocument` streaming survive large remote files? | Document provider design | V-12, V-13 |

### 2.3 Required sequence (`PRD.md` §29.1)

The order is a dependency chain, not a preference.

```
V-01 permitted app type?  ── no/unclear ──▶ STOP, re-scope to drive.file
        │ yes
        ▼
V-19 cost of verification + assessment
        ▼
V-02 scope matrix + justification
        ▼
V-04 / V-05 OAuth spike: client-only vs backend
        ▼
V-14 backend decision
        ▼
V-06 / V-07 / V-08 / V-09 / V-11 live API behaviour
        ▼
V-10 resumable upload
        ▼
V-16 / V-17 UX prototypes
        ▼
V-12 / V-13 DocumentsProvider device matrix
        ▼
V-18 load + performance
        ▼
V-15 security review
        ▼
Phase 1 - commit to build
```

**Gate rule (`PRD.md` §29.1, non-negotiable):** if V-01 returns "no" or "unclear", the project does not proceed to Phase 1 on the restricted-scope architecture. It stops and re-scopes to a `drive.file`-based product - a different, smaller product that cannot browse an account (`Architecture.md` §33.7).

**Spike discipline:** Phase 0 work uses the `spike/<question>` branch prefix and **must never merge** (`Architecture.md` §27.1). Findings are recorded in `docs/validation/`, not in production code.

### 2.4 Non-Phase-0 obligations that start here

These are not spikes. They are documents Google requires, and they are written *alongside* the scope justification so the wording is reused (`PRD.md` §28 R-14):

- Privacy policy.
- Data-safety declarations for Play.
- Per-scope justification for every requested scope (V-02).
- Demonstration video of the consent flow, unlisted (`PRD.md` §9.3).

**No document in this repository may state that verification is approved or in progress** (`PRD.md` §9.3, `Rules.md` §32).

### 2.5 Phase 0 exit criteria

- [ ] V-01 answered **in writing** by Google. Not inferred, not assumed.
- [ ] V-19 cost figure obtained from an empanelled assessor and recorded.
- [ ] V-02 scope matrix complete; every scope justified against a feature; no scope without one.
- [ ] Q-01, Q-02, Q-03 resolved; the backend is either designed minimally or **deleted**.
- [ ] Q-05…Q-11 measured and recorded; nothing hard-coded from memory.
- [ ] V-16, V-17 usability testing passed (≥5 of 5–8 unaided; ≥80% connect without confusion).
- [ ] V-18, V-15 passed.
- [ ] Every `REQUIRES VALIDATION` in `PRD.md` / `Architecture.md` is either closed by a `docs/validation/` file or is an explicitly accepted live open issue.
- [ ] `Rules.md`, `Design.md`, `Memory.md` written (see §5 below).
- [ ] Human decision recorded in this file to open Phase 1.

---

## 3. Phase 1 - Foundation

**Provenance: ANCHORED** as to purpose. `PRD.md` §28 R-20, §8.6, §10.2 MA-01; `Architecture.md` §32 AR-12, AR-19, §33.5.8.

### 3.1 Environment blocker - confirmed still present

`PRD.md` R-20 and `Architecture.md` AR-19 record that the build toolchain was absent. **Verified on 2026-09-26: still absent.**

| Component | Status |
|---|---|
| `java` / `javac` | **Not installed** |
| `JAVA_HOME` | **Unset** |
| `gradle` | **Not installed** (expected - use the Gradle wrapper) |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | **Unset** |
| `~/AppData/Local/Android/Sdk` | **Does not exist** |
| `C:\Android\Sdk` | **Does not exist** |

Phase 1 cannot start until a JDK and Android SDK are installed and **pinned to agreed versions**. Version numbers are a decision, not a guess (`PRD.md` §8.6: `targetSdk`/`compileSdk` "must be decided at Phase 1, not guessed").

### 3.2 Decisions due in this phase

| # | Decision | Source |
|---|---|---|
| D-1.1 | `minSdk`, `targetSdk`, `compileSdk` | `PRD.md` §8.6; Q-12 |
| D-1.2 | JDK and Android SDK versions, pinned | R-20, AR-19 |
| D-1.3 | Dependency audit - does the chosen set force `minSdk` up and shrink the audience? | AR-12 |
| D-1.4 | MA-01 maximum accounts for MVP. The documents propose **5** and mark it "Proposed - confirm at Phase 0". **Unconfirmed.** | `PRD.md` §10.2 |
| D-1.5 | The exact `email` / userinfo scope string | `PRD.md` §9.2 |
| D-1.6 | Whether `.../auth/drive` is granted, or the app is downscoped to `drive.readonly` | `PRD.md` §9.2, R-03 |

**D-1.6 is a fork, not a parameter.** If the scope is downscoped, every write feature is replaced by capability flags derived from granted scopes so the downgrade degrades rather than breaks (R-03), and Phase 14 is cancelled rather than re-planned.

### 3.3 Exit criteria

- [ ] `./gradlew assembleDebug` succeeds on a fresh clone.
- [ ] Toolchain versions pinned in a committed document.
- [ ] D-1.1 … D-1.6 recorded in `Memory.md`.
- [ ] Domain-purity enforcement mechanism chosen (`:domain` as a pure Kotlin JVM module - `Architecture.md` §4.3).

---

## 4. Phases 2, 4, 10, 11, 12, 14, 15, 17, 18, 19 - anchored phases

Each has a known number, a known purpose, and known owning validation items. **Entry and exit criteria are not specified in the source documents and must be written before the phase opens.**

### Phase 2 - UX validation
Owns V-16, V-17. Prototype the two-step connect flow and the unified model; moderated testing with 5–8 multi-account users. R-18: two OAuth grants before value is visible is an activation risk; measure drop-off per step.
*Note: this phase needs the Phase 1 toolchain to build a prototype, which is why it follows Phase 1 despite being validation work.*

### Phase 3 - Skeleton and CI  **(INFERRED)**
Module graph per `Architecture.md` §5 and §33.3: `:app`, `:domain` (pure Kotlin), `:data`, `:cloud`, `:core`. Hand-written `AppContainer`, no DI framework. CI green on an empty app with every gate in `Architecture.md` §27.2 and §27.3 active, including the domain-purity package check and the multi-account isolation harness (initially trivial, but **blocking from day one** so it can never be added late).

### Phase 4 - OAuth and account connection
Owns V-03. Connect account A, then account B; each lists independently with correct attribution. Token state machine (`Architecture.md` §7.3) with SM-1…SM-6, including SM-6: `Connected` requires a **live verification call**, not merely a received token. From this phase onward, R-05 requires a device test matrix - Custom Tabs, redirect handling, and back-stack behaviour vary across Android versions and OEMs.

### Phase 5 - Domain core  **(INFERRED)**
Pure-Kotlin models (`FileRef`, `AccountRef`, `Capabilities`, `Page`, `TransferState`), the `AppError` taxonomy (§21), repository interfaces, the `CloudProvider` interface (§6), and use cases. No Android imports - enforced by the build (ADR-10).

### Phase 6 - Local database  **(INFERRED)**
Room schema per §9. Invariant I-4: every row carries a non-null `accountId`, and every query is account-scoped. Migrations must never touch accounts or tokens (AR-16); every migration is tested with data present.

### Phase 7 - Drive provider  **(INFERRED)**
`GoogleDriveProvider`, `DriveApi` with an explicit `fields` policy (§11.1.1), `q` construction and escaping, mappers, `403`/`429` error mapping by reason rather than by code. `QuotaGovernor` with per-account and global caps, bounded exponential backoff with jitter. `corpora`/`spaces` constrained explicitly on every call - R-22: shared-drive and domain content leaking into unified results is a real risk, and shared drives are out of scope.

### Phase 8 - Account management  **(INFERRED)**
Account list, status, details, add, reconnect, disconnect. Keystore-backed token storage with a deletion path that is *verified*, not assumed (ADR-04; AR-15: raw `EncryptedSharedPreferences` deletion does not remove key material, which would break the disconnect guarantee). Complete disconnect sequence per §20.3. Max-account enforcement at the repository boundary, not the UI (§7.4).

### Phase 9 - Browsing and index  **(INFERRED)**
Unified and per-account browsers, folders, categories, recent, pagination, sort/filter, grid/list. `Unifier` with deterministic merge order (§12.2) and I-6: a failure in one account never aborts another's operation. Cache-first rendering with explicit staleness (ADR-08). N-14: cached data is never presented as live.

### Phase 10 - Search
Owns V-07. Cross-account fan-out with a global cap, debounce, per-account failure isolation, and **mandatory completeness disclosure** (SRCH-09, SRCH-12, R-08, AR-06). R-08 is rated **High** probability: users will conclude files are missing. Partial results are never rendered as complete.

### Phase 11 - Gallery
Owns V-08, V-09. Photo and video grid, full-screen viewer, date grouping, account badge on every cell (GAL-03). Thumbnail cache sized to the measured `thumbnailLink` lifetime from V-08; links are ephemeral and bearer-adjacent - never logged (`Architecture.md` §33.7). V-09 determines preview behaviour: no general binary export for Google-native types, so fall back to `webViewLink`.

### Phase 12 - Transfers
Owns V-10. Upload and download with progress, cancel, and bounded retry. Reconcile-before-retry (§13; AR-18): an uncertain network failure can hide a committed upload, and a naive retry duplicates the file. `Cancelled` is a first-class `AppError` - never reported as success (AR-17). Quota-exhaustion handling per AC-07.4. Background continuation via WorkManager only if V-10 shows it survives process death.

### Phase 13 - Preview and details  **(INFERRED)**
File details with source account and provider ID, open, preview for supported media, Open-with via `FileProvider`, copy link. Provider IDs are opaque (F-14) - never parsed or inferred. Preview falls back to `webViewLink` for Google-native types per V-09.

### Phase 14 - Write operations
Owns V-11. **Conditional on the `drive` scope being granted** (`PRD.md` §30.2: "if and only if"). Rename, move within an account, trash, create folder. UI copy is written to match measured Drive semantics, not assumed ones (Q-10, R-21). Cross-account move/copy stays out of scope permanently (N-05, §30.3).

### Phase 15 - Android integration
Owns V-12, V-13. `DocumentsProvider` exposing one root per connected account, **zero roots when disconnected**. Account-validated document IDs: `DocumentIdCodec.decode` plus a membership check before any provider call (I-7, AC-12.5). V-12 requires the provider to work on **≥3 OEM builds**, with failures documented and worked around. V-13 determines whether large remote files stream or require cache-then-serve (R-10, AR-08). The provider is **not** the system file manager and is visible only to SAF-aware apps - the app must not claim otherwise (`Architecture.md` §33.7).

### Phase 16 - Offline, errors, accessibility, privacy  **(INFERRED)**
Complete error matrix (§19) - every `AppError` renders a message and a recovery action; `Cancelled` renders nothing; no stack trace reaches the UI. Offline behaviour (§18): browse cached, search labelled cached-only, mutations disabled. Accessibility (§21): TalkBack on every screen, 200% font scale, contrast in both themes, ≥48 dp targets, no colour-only information. Analytics restricted to the §20.1 allow-list as sealed types. Privacy & Security surfaces, settings, clearable search history.

### Phase 17 - Security review
Owns V-15, V-20. Independent review of the token flow, storage, logging, and provider. Pass condition: **no Critical or High findings unresolved.** Also closes: AR-15 (verified token deletion), AR-14 (Keystore key invalidated by a lock-screen change - detect and prompt, never fail silently), AR-10 (log redaction, CI log scan, release log stripping), AR-11 (backend token custody, if a backend exists). Decide here, and only here, whether to add a crash-reporting or analytics SDK (ADR-11, `Architecture.md` §4.2, §22.3) - and if added, inspect the SDK's actual outbound payload.

### Phase 18 - Performance and load
Owns V-18. Gallery scroll over 10k items with no OOM (AR-09), cold start, search latency, memory ceiling, on low/mid-range hardware. Load test with accounts containing 10k+ files. If the PF targets (§17) are not met, **revise them honestly** rather than lowering the bar silently.

### Phase 19 - Beta and release
Establish a support channel with an SLA before this phase (R-19). Then `Architecture.md` §27.4 release gates: OAuth verification status recorded - **if verification is not granted, the release is limited to the internal test track** and the unverified-app warning is understood; privacy policy published and matching the in-app version; data-safety declaration matching actual behaviour; **zero occurrences of banned storage claims** in the listing, release notes, and in-app copy; crash-free rate met on the internal track; no open Critical or High security findings; document provider verified on the OEM matrix or disabled for that build.

---

## 5. Missing documents - required before Phase 0 can close

Three referenced documents do not exist. `PRD.md` and `Architecture.md` cite them by **section number**, so their required structure is known. They cannot be reconstructed as authoritatively as this file was, because they encode decisions rather than describing a system - but the citations below define their mandatory contents.

### 5.1 `Rules.md` - binding constraints

| Cited section | Must contain | Referenced from |
|---|---|---|
| §1 | Language prohibition. N-01…N-16 as contractual non-goals. No "unlimited Google storage", "free extra storage", "extra storage", "bypass Drive limits", "pooled storage", "combined quota", or equivalent. Sole permitted framing: "A unified interface for managing authorized files across multiple Google Accounts." | `PRD.md` §238, R-16; `Architecture.md` AR-20 |
| §5 | (Unidentified - referenced once) | `Architecture.md` §426 |
| §7 | File identity authority rules | `PRD.md` §1091 |
| §23 | Prohibited-phrasing CI scan over string resources, store listings, analytics event names | `PRD.md` §238; `Architecture.md` AR-20 |
| §26 | The multi-account isolation matrix M1…M16 **blocks the build**. The most important rule in the project. | `PRD.md` R-04, T-?; `Architecture.md` §23.2 |
| §32 | No document may state that OAuth verification is approved or in progress | `PRD.md` §9.3 |
| §33 | Future providers are not implemented | `Architecture.md` §6.4 |
| §34 | No microservices, Kubernetes, event-driven infrastructure, message bus, service mesh, distributed cache, or server-side search | `Architecture.md` §24.3 |

### 5.2 `Design.md` - UI specification

| Cited section | Must contain | Referenced from |
|---|---|---|
| §8 | Shared component inventory - `AccountBadge`, `FileRow`, `FileCard`, `StateViews` (loading/empty/error/offline/stale), `ConfirmDialogs` | `Architecture.md` §305 |
| §12 | Gallery screen specification | `PRD.md` §370 |
| §24 | Design tokens - colour, type, shape, spacing, motion - as the source for the Compose theme | `Architecture.md` §302, ADR-01 |

### 5.3 `Memory.md` - decision and measurement log

Must carry: the real Drive API quota values read from the Cloud Console (V-06 - "recorded in `Memory.md` and hard-coded nowhere", `PRD.md` §29); every decision taken in each phase, including D-1.1…D-1.6; measured results from every validation item; and the rationale for choices that the architecture documents record only as conclusions.

**This is the document whose loss is most costly.** `Memory.md` is the only place where "what we tried and why we chose this" survives. It cannot be reconstructed from `PRD.md` and `Architecture.md`, and this reconstruction does not attempt to fake it.

---

## 6. Constraints binding on every phase

These are not phase tasks. They apply from the first commit.

| # | Constraint | Source |
|---|---|---|
| K-1 | N-01…N-16 are contractual. Any pull request, string resource, store listing, or analytics event name implying one is rejected at review. | `PRD.md` §5, §238 |
| K-2 | `AccountId` is a required parameter on every provider operation. No ambient "current account", no `ThreadLocal`, no mutable global account state. | `Architecture.md` I-1…I-3 |
| K-3 | The domain layer contains no Android framework imports, and knows nothing about Room, OkHttp, or Drive. | `Architecture.md` §4.3, ADR-10 |
| K-4 | The isolation matrix M1…M16 runs in CI and a failure blocks the build. | `Architecture.md` §23.2, `Rules.md` §26 |
| K-5 | File bytes go directly between the device and Google. The backend never handles file content. | `Architecture.md` §2.2, B-2, N-11 |
| K-6 | No third-party telemetry SDK until Phase 17. | ADR-11 |
| K-7 | No Hilt/Koin, Retrofit, Firebase, Crashlytics, MockK, or Turbine. Hand-written fakes and a hand-written `AppContainer`. | `Architecture.md` §4.2 |
| K-8 | No non-Google provider is implemented. | `PRD.md` §30.3, `Rules.md` §33 |
| K-9 | Provider quotas, result caps, and `q` semantics are read from the Cloud Console and measured - never hard-coded from memory. | `Architecture.md` §33.5.6 |
| K-10 | Cached data is never presented as live without qualification. | N-14, ADR-08 |
| K-11 | If architecture or an ADR changes, the documents change in the same PR. | `Architecture.md` §27.2 |
| K-12 | No document may state that OAuth verification is approved or in progress. | `PRD.md` §9.3, `Rules.md` §32 |

---

## 7. Open items requiring a human decision

| # | Question | Why it cannot be answered here |
|---|---|---|
| O-1 | Are the **INFERRED** phases (3, 5, 6, 7, 8, 9, 13, 16) correct in position and purpose? | Derived from layer ordering, not from any source statement. |
| O-2 | Were the original four documents ever written, and does a copy exist elsewhere? | If so, this file should be discarded, not merged. |
| O-3 | Who owns the V-01 written enquiry to Google, and by when? | The entire project is blocked on it. Nothing else can start. |
| O-4 | Is D-1.4 (max accounts = 5) confirmed? | `PRD.md` marks it "Proposed - confirm at Phase 0". |
| O-5 | Should Phase 3 (skeleton/CI) precede Phase 2 (UX prototypes)? | This reconstruction puts UX validation first because V-16/V-17 can de-risk scope cheaply before any module is written. A reasonable person could put scaffolding first. |
| O-6 | Has any prototype or spike code ever been written and lost? | The repository has **zero commits**. Nothing can be recovered from git. |

---

## 8. Current state of this repository

Verified 2026-09-26.

| Item | State |
|---|---|
| Git repository | Initialised, branch `master`, **zero commits** |
| Tracked files | None |
| Untracked files | `PRD.md`, `Architecture.md` |
| Source code | **None** |
| Gradle project | **None** |
| JDK / Android SDK | **Not installed** |
| Documents present | `PRD.md`, `Architecture.md` |
| Documents missing | `Phases.md` (this file, reconstructed), `Rules.md`, `Design.md`, `Memory.md` |

The working directory previously in use, `C:\$WinREAgent`, is a Windows Recovery Environment servicing folder and contains nothing belonging to this project.
