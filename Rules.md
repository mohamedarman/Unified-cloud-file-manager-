# Rules - Unified Cloud File Manager

| Field | Value |
|---|---|
| Document | Binding Engineering Rules |
| Version | 1.0 |
| Status | Active. Binding on all code, copy, design, and review. |
| Written | 2026-09-26, Phase 1 |
| Related documents | `PRD.md`, `Architecture.md`, `Phases.md`, `Design.md`, `Memory.md` |

---

## How to read this document

A rule marked **ENFORCED** is checked mechanically in CI. A rule marked **REVIEW** is checked by a human at review. A rule marked **CONTRACTUAL** is a product commitment; violating it is a defect regardless of whether code ships.

Section numbers are load-bearing. `PRD.md` and `Architecture.md` cite specific sections of this file by number (§1, §5, §7, §23, §26, §32, §33, §34). **Do not renumber, reorder, or delete a section.** Add new rules as new sections at the end, or as sub-rules within an existing ID.

**This document was written after `PRD.md` and `Architecture.md`, from the constraints those two documents state.** It introduces no new product decisions. Where it is silent, those documents govern.

---

## 1. Language prohibition

**CONTRACTUAL. ENFORCED by CI (§23). This is the highest-priority rule in the repository.**

This product must never be described, in any surface, as:

- "unlimited Google storage"
- "free extra Google storage"
- "extra Google storage"
- "bypass Google Drive limits"
- "pooled storage"
- "combined quota"
- or any equivalent phrasing, in any language.

**The only permitted framing is:**

> "A unified interface for managing authorized files across multiple Google Accounts."

Storage remains owned, metered, and enforced by each respective Google Account. The product adds no bytes and creates no capacity. This is a factual statement about the architecture, not marketing restraint.

### 1.1 The non-goals this rule enforces

From `PRD.md` §5. All sixteen are contractual.

| ID | The product will NOT |
|---|---|
| N-01 | Create, add to, or imply additional Google storage quota. |
| N-02 | Merge Google Drive accounts into one actual Drive account. |
| N-03 | Bypass, evade, or work around Google storage limits, quotas, or fair-use policies. |
| N-04 | Shard, split, replicate, or clone files across accounts to work around a quota or per-account limit. |
| N-05 | Silently copy files between accounts, or perform any cross-account transfer without explicit, separately-confirmed intent. |
| N-06 | Access any account, file, or scope the user has not explicitly authorized. |
| N-07 | Collect, request, transmit, or store Google passwords or account credentials. |
| N-08 | Access files outside granted permissions, or enumerate unauthorized resources. |
| N-09 | Promise access to Google services or Drive features outside the granted scopes. |
| N-10 | Replace Google Drive, Google Photos, or the Google account system. |
| N-11 | Proxy or durably store user file contents on its own servers. |
| N-12 | Perform background access to user files without user-initiated or clearly-disclosed scheduled activity. |
| N-13 | Bypass, disable, or weaken Android platform permission models or scoped-storage rules. |
| N-14 | Present cached data as live data without qualification. |
| N-15 | Circumvent Google API rate limits or quotas. |
| N-16 | Offer, imply, or measure itself against an "extra storage" or "unlimited" value proposition. |

**Enforcement:** any pull request, string resource, store listing, release note, or analytics event name implying N-01…N-16 is rejected at review and fails CI (§23). Scope creep toward storage-pooling features is rated **product-killing** (`PRD.md` R-16, `Architecture.md` AR-20) - it is the single most likely way this project destroys itself.

---

## 2. Scope and precedence

1. `Rules.md` - binding rules. This document.
2. `Architecture.md` ADRs - decisions of record, with status.
3. `Architecture.md` / `PRD.md` - design and requirements.
4. `Design.md` - UI specification.
5. `Memory.md` - decisions, measurements, and rationale.

**ADRs marked `PROPOSED` are not settled.** Code may implement them, but the ADR status must not be upgraded to a decision without validation evidence recorded in `Memory.md` and a file in `docs/validation/`.

**A `REQUIRES VALIDATION` marker that is silently dropped is a defect.** It either ends with a `docs/validation/` file or remains a live open issue (`Architecture.md` §28).

---

## 3. The non-negotiable architectural constraint

**CONTRACTUAL.**

This system is a management and access layer over accounts the user has authorized. It:

- creates no storage,
- pools no quota,
- shards no files,
- clones nothing to work around a provider limit,
- and proxies no file bytes.

**File bytes travel directly between the device and Google, and nowhere else.** The backend, if one exists, never handles file content (`Architecture.md` B-2, N-11).

Any design that violates this is invalid regardless of its performance or convenience. There is no performance argument that overrides it.

---

## 4. Layering and dependency rules

**ENFORCED.** Dependencies point inward only.

```
Presentation  ──depends on──▶  Domain  ◀──implemented by──  Data
     │                            ▲                              │
     └──────────▶  UI State ◀─────┴──────────────────────────────┘
```

| # | Rule | Enforcement |
|---|---|---|
| L-1 | The domain layer contains **no Android framework imports** | `:domain` is a pure Kotlin JVM module; a compile error if violated (ADR-10) |
| L-2 | The domain layer does not know about Room, OkHttp, or Drive | Same |
| L-3 | The data layer does not import presentation types | Package check in CI |
| L-4 | Only the data layer knows about provider SDKs and Room | Same |
| L-5 | Dependencies point inward only | Same |
| L-6 | If a dependency forces Android types into `:domain`, **the dependency is wrong, not the rule** | Review |

**No speculative platform abstraction.** One provider exists. `feature/` modules are not created per screen (§5 note, `Architecture.md`).

---

## 5. The `CloudProvider` contract

**ENFORCED by tests.**

The interface lives in `domain/` so both the app and the data layer depend on it, and neither depends on a concrete provider (`Architecture.md` §6.1).

| # | Rule |
|---|---|
| PC-1 | **Every operation requires an explicit `accountId`.** There is no overload without it, and no ambient "current account". |
| PC-2 | Every returned `CloudFile` carries the `accountId` it came from. |
| PC-3 | Implementations **MUST NOT** cache across accounts. |
| PC-4 | Implementations **MUST NOT** automatically retry non-idempotent operations. |
| PC-5 | All failures **MUST** be mapped to `AppError`. Raw provider exceptions **MUST NOT** escape. |
| PC-6 | The provider returns only domain models. No provider types cross into the domain. |
| PC-7 | The UI renders available actions from `capabilities()`, never from a hardcoded list. |
| PC-8 | `openContent` streams. It never buffers a whole file. The caller must close it. |

**PC-7 is what makes a scope downgrade survivable.** If Google grants `drive.readonly` instead of `drive`, capabilities shrink and the UI degrades rather than breaks (`PRD.md` R-03).

---

## 6. Account isolation invariants

**ENFORCED.** These are the highest-severity defect class in the product (`PRD.md` R-04, `Architecture.md` AR-04). They are **designed out by the type system, then tested** (§26).

| # | Invariant | Enforcement |
|---|---|---|
| I-1 | Every provider call receives a non-null, resolvable `accountId` | No interface overload without it; Kotlin has no optional parameters here |
| I-2 | The token for a call is resolved from `accountId` alone, inside the auth client | Exactly one function: `tokenFor(accountId)`. No other token lookup exists. |
| I-3 | No `ThreadLocal` or singleton "current account" in production code | Review + a lint rule banning mutable global account state |
| I-4 | Every database row carries a non-null `accountId`; every query is account-scoped | `accountId` is `NOT NULL` and part of every listing index. A repository method without an account parameter does not exist. |
| I-5 | Cache keys include `accountId` | `CacheKey(accountId, kind, id)`; a constructor without `accountId` does not exist |
| I-6 | A failure in one account never aborts another account's operation | Fan-out uses structured concurrency with per-child error capture, not `awaitAll` on a single failing child |
| I-7 | The `DocumentsProvider` validates every document ID's account against the connected-account set | `DocumentIdCodec.decode` + a membership check before any provider call |
| I-8 | Disconnecting account A alters nothing about account B - not tokens, cache, workers, or roots | Disconnect is scoped by `accountId` at every step; verified by automated test |

---

## 7. File identity authority

**ENFORCED.**

```
FileRef = ( provider : ProviderId, accountId : LocalAccountId, fileId : ProviderFileId )
```

`FileRef` is the **only** accepted currency for provider operations, deep links, and cache keys.

| # | Rule | Detail |
|---|---|---|
| FI-01 | **Google Drive is the source of truth** | For file existence, name, size, MIME, dates, and capabilities. |
| FI-02 | The local cache is advisory | It may be stale and must never be presented as current without qualification (N-14). |
| FI-03 | A destructive operation requires fresh provider confirmation | Never executed from cache alone. |
| FI-04 | If a provider fetch reports the file no longer exists | Mark `syncState = REMOVED` and surface it. Do not silently delete the user's local record. |
| FI-05 | **Provider IDs are opaque** | Never parse them, infer structure, or generate them. They are not small, sequential, or meaningful. |
| FI-06 | **Cache keys must include `accountId`** | A cache key without an account component is a defect. |
| FI-07 | The same provider file shared with two accounts is **two distinct `FileRef`s** | They must never be merged. Guaranteed by the `UNIQUE(accountId, fileId)` constraint. |

**No local integer primary key may address a provider resource.** `localId` is internal and is never sent to a provider.

---

## 8. Caching and freshness

| # | Rule |
|---|---|
| CA-1 | The local database is a **cache, not a mirror**. It is always evictable. |
| CA-2 | Cache-first rendering is the default; network is the fallback (ADR-08). |
| CA-3 | Staleness is always explicit. Every list and detail surface can show its `fetchedAt`. |
| CA-4 | The app never downloads a full file library's metadata to pre-warm. That is a privacy and quota cost the product does not pay. |
| CA-5 | `thumbnailLink` is treated as **ephemeral and bearer-adjacent**. Never logged. Never treated as a durable URL. |
| CA-6 | A stale page token is **detected and the listing restarted**, never trusted blindly. |

---

## 9. Token handling

**CONTRACTUAL. Release blockers** (`PRD.md` §16.1).

| # | Rule |
|---|---|
| TK-1 | OAuth only. A Google password is never requested, entered, transmitted, or stored (SEC-01, N-07). |
| TK-2 | No client secret is embedded in the APK (SEC-02). Enforced by APK scan in CI. |
| TK-3 | Access tokens, refresh tokens, authorization codes, and ID tokens never appear in logs, crash reports, analytics, or the UI (SEC-04). |
| TK-4 | Refresh tokens never leave the device except through the minimal backend's encrypted transport, if one is ever built (SEC-07). |
| TK-5 | Request only scopes justified per feature. No speculative scopes "for later" (SEC-08). |
| TK-6 | **A refresh is attempted at most once per operation. Never in a loop.** (SM-1) |
| TK-7 | `ReauthRequired` is terminal for that account until the user acts. It never degrades into silent retries (SM-2). |
| TK-8 | Entering `ReauthRequired` for account A does not change account B's state (SM-3). |
| TK-9 | Cancellation never transitions account state (SM-5). |
| TK-10 | Transition to `Connected` requires a **live verification call**, not merely a received token. An unexercised token is not proof of a working account (SM-6). |

---

## 10. Secure storage and disconnect

| # | Rule |
|---|---|
| ST-1 | Tokens are stored using platform secure storage (Keystore-backed) with the narrowest practical access (SEC-03). |
| ST-2 | Raw `EncryptedSharedPreferences` is **not** used for the token store. Its deletion does not remove the underlying key material, which would break the disconnect guarantee (ADR-04, AR-15). A Keystore-wrapped file is used instead. |
| ST-3 | The deletion path is **verified by test**, not assumed (AR-15 is rated **Critical**). |
| ST-4 | Disconnect is complete: revoke + delete tokens + purge metadata + purge thumbnails + stop workers + drop document-provider roots (SEC-09). |
| ST-5 | The token store is excluded from Android backup. |
| ST-6 | A Keystore key invalidated by a lock-screen change is detected explicitly and surfaced as a clear re-auth prompt - never a silent failure (AR-14). |

---

## 11. Backend rules

**The backend is planned for but its necessity is not established** (Q-02). Per `Architecture.md` §10.1:

> If Phase 0 shows a client-only PKCE flow is fully supported, **the backend is deleted, not kept "just in case."**

| # | Rule | Property |
|---|---|---|
| BE-1 | Stateless. No database. No token persistence. | B-1 |
| BE-2 | No user file data, ever. Enforced by content-type rejection. | B-2 |
| BE-3 | No logging of request bodies, codes, verifiers, or tokens. | B-3 |
| BE-4 | TLS only. HSTS. No CORS - there is no browser client. | B-4 |
| BE-5 | The `redirect_uri` allowlist is **exact-match**, not prefix-match. | B-5 |
| BE-6 | Aggressively rate limited. A code-exchange endpoint can be used as an oracle. | B-6 |
| BE-7 | The client secret lives only in a managed secret store - never in source, never in an image layer, never in an env file in the repo. | B-7 |
| BE-8 | Deployable as one small instance or a serverless function. It is not a distributed system and must not become one. | B-8 |
| BE-9 | Health/metrics endpoints are authenticated or not publicly exposed. | B-9 |
| BE-10 | Region and retention documented for the privacy policy. | B-10 |

---

## 12. Logging and redaction

**ENFORCED.**

| # | Rule |
|---|---|
| LG-1 | Structured logging only. One redacting logger, used everywhere. |
| LG-2 | A prohibited-properties list defines what is redacted. Redaction logic is unit-testable in isolation. |
| LG-3 | **Filenames are treated as sensitive and excluded from all telemetry** (SEC-10). |
| LG-4 | No file contents in logs, ever. |
| LG-5 | Debug logging is compiled out of release builds (SEC-14). |
| LG-6 | No stack trace ever reaches the UI. |
| LG-7 | A token pattern must never reach a log. Asserted by an automated log-scanning test. |
| LG-8 | Logs are stripped from release builds and verified after stripping. |

---

## 13. Telemetry rules

| # | Rule |
|---|---|
| TM-1 | **No third-party telemetry SDK until Phase 17** (ADR-11). The default is none. |
| TM-2 | If a SDK is ever approved, its **actual outbound payload is inspected** before adoption. |
| TM-3 | Analytics is implemented as a thin auditable wrapper over the `PRD.md` §20.1 allow-list, as sealed types. No free-form event names. |
| TM-4 | File names, tokens, account emails, and file contents are **prohibited** in analytics (`PRD.md` §20.2). |
| TM-5 | Firebase Analytics is not used. Firebase/Crashlytics is not added without privacy review. |

---

## 14. Error handling rules

| # | Rule |
|---|---|
| ER-1 | Every provider, transport, and platform failure is normalised into exactly one `AppError`. Raw exceptions never reach the presentation layer. |
| ER-2 | **One `AppError` value, three renderings**: user message, developer log, analytics code. Copy lives in one mapping, never scattered through the UI. |
| ER-3 | Every `AppError` renders a user message and a recovery action. |
| ER-4 | `Cancelled` is a **first-class member of the taxonomy, not an exception**. This is what prevents showing an error after a deliberate cancellation (EH-07). |
| ER-5 | A `403` is ambiguous with rate limiting. Read the reason; never infer from the status code alone. |

---

## 15. Retry rules

| # | Rule |
|---|---|
| RT-1 | **Non-idempotent operations - upload, rename, move, trash, create folder - are never retried automatically.** Retry is user-initiated. |
| RT-2 | An upload retry **reconciles first**. An uncertain network failure can hide a committed upload; a naive retry duplicates the file (AR-18). |
| RT-3 | Idempotent network/timeout failures use bounded exponential backoff with jitter. |
| RT-4 | `RateLimited` honours retry guidance, caps attempts, then surfaces. |
| RT-5 | `AuthenticationFailed` is retried exactly once - one refresh - then becomes `AuthorizationRequired`. |
| RT-6 | `AuthorizationRequired`, `PermissionDenied`, `FileNotFound`, `InsufficientDeviceStorage`, `ProviderQuotaExhausted`, `UnsupportedFileType`, `FileTooLarge`, `Cancelled`, and `IntegrityFailure` are **never** retried. |
| RT-7 | **No silent retry loops, ever.** |

---

## 16. Cancellation rules

| # | Rule |
|---|---|
| CN-1 | Cancellation is cooperative and structured, not best-effort. |
| CN-2 | A cancelled operation never transitions account state (SM-5). |
| CN-3 | A cancelled transfer is reported as `Cancelled`, never as success (AR-17). |
| CN-4 | Closing a `ContentSource` is the caller's responsibility and is always safe to do twice. |

---

## 17. Quota discipline

| # | Rule |
|---|---|
| QD-1 | Real quotas are **read from the Cloud Console and measured** - never hard-coded from memory or guessed (`Architecture.md` §33.5.6). |
| QD-2 | `fields` is always explicit on every Drive call. Over-fetching wastes quota and latency. |
| QD-3 | Pages are bounded. `listFiles` never requests an unbounded result. |
| QD-4 | Fan-out is parallel-with-cap, per-account and globally (`QuotaGovernor`). |
| QD-5 | **No polling.** Debounce instead. |
| QD-6 | Quota alerts fire at a defined fraction of the real quota. |
| QD-7 | Rate limits are never circumvented (N-15). |
| QD-8 | `corpora` and `spaces` are constrained explicitly per call. Shared drives are out of MVP scope; leakage is tested for (R-22). |

---

## 18. Pagination and merge rules

| # | Rule |
|---|---|
| PG-1 | Merge order across accounts is **deterministic** (§12.2). |
| PG-2 | Merge stability holds across pagination boundaries. |
| PG-3 | Global pagination across independently paged accounts is **approximate** and must be disclosed in the UI (§24.2). A globally-ordered merge is not achievable. |
| PG-4 | The same file name in two accounts yields two distinct rows, each correctly attributed, never merged. |
| PG-5 | The same provider `fileId` presented for two accounts yields two distinct rows (FI-07). |

---

## 19. Search completeness

| # | Rule |
|---|---|
| SC-1 | Results are **never** rendered without a `Completeness` value. |
| SC-2 | Partial results are **never** presented as complete. |
| SC-3 | When one account fails, the others' results are still returned and the notice **names** the failing account. |
| SC-4 | Real result caps and `q` operator semantics are measured, not assumed (Q-06). `PRD.md` R-08 is rated **High** probability: users conclude files are missing. |
| SC-5 | `q` construction escapes adversarial input - quotes, backslashes, `%`. |

---

## 20. Android platform claims

**CONTRACTUAL.** The product must not overstate what the platform does.

| # | Rule |
|---|---|
| AP-1 | A `DocumentsProvider` does **not** make the app the system file manager. It never will. |
| AP-2 | A `DocumentsProvider` is **manually enabled by the user** and is visible only to SAF-aware apps. |
| AP-3 | Google Docs/Sheets/Slides cannot be previewed in-app - there is no general binary export. Fall back to `webViewLink`. |
| AP-4 | Platform permission models and scoped-storage rules are never bypassed or weakened (N-13). |
| AP-5 | Photo Picker and SAF behaviour varies by OEM and is tested, not assumed. |
| AP-6 | A per-account usage figure is never summed into a combined total. Quotas are per account. |

---

## 21. Document provider rules

| # | Rule |
|---|---|
| DP-1 | **Zero roots when no account is connected.** |
| DP-2 | One root per connected account. |
| DP-3 | Every document ID encodes `(accountId, fileId)` and is validated against the connected-account set before any provider call (I-7). |
| DP-4 | A document ID for a disconnected account is **refused**. Nothing about that account is exposed. |
| DP-5 | A document ID presented with a mismatched claimed account is **refused** (AC-12.5). |
| DP-6 | The provider is exported with minimal required protection and every caller-supplied ID is validated (SEC-12). |
| DP-7 | If `openDocument` streaming times out for large remote files, cache-then-serve with clear messaging (Q-11, AR-08). |

---

## 22. Deep link and intent security

| # | Rule |
|---|---|
| DL-1 | Deep links are authenticated and parameterised **only by opaque IDs** - never raw file paths, never tokens (SEC-11). |
| DL-2 | Deep-link parameters are validated before use. |
| DL-3 | Exported components are minimal and each is justified. |
| DL-4 | Intent redirection is validated. |
| DL-5 | No custom `TrustManager`. Platform-trusted CAs only (SEC-05). |
| DL-6 | Certificate pinning is used **only** for Google's documented hosts, and **only** if a rotation process is owned. Otherwise not used. |

---

## 23. Prohibited-phrasing scan

**ENFORCED in CI.**

| # | Rule |
|---|---|
| PS-1 | A scan runs over string resources, store listings, release notes, and analytics event names, rejecting anything implying N-01…N-16 (§1). |
| PS-2 | The scan runs in CI and **blocks the build**. It is not a review checklist item. |
| PS-3 | The banned-term list is derived from the prohibited framings in §1, not maintained ad hoc. |
| PS-4 | The same scan is applied to the Play store listing and release notes at Phase 19 (`Architecture.md` §27.4). |
| PS-5 | Feature names, analytics event names, and internal identifiers are held to the same standard as user-facing copy. A banned term in an event name is still a banned term. |

---

## 24. Branching and review

| # | Rule |
|---|---|
| BR-1 | Trunk-based, short-lived branches. `main` is always releasable. |
| BR-2 | Branch naming: `feature/<short-description>`, `fix/<short-description>`, `spike/<question>`. |
| BR-3 | A `spike/` branch is throwaway Phase 0 work and **must never merge**. Findings go to `docs/validation/`, not production code. |
| BR-4 | A release branch is cut only for a release and deleted afterwards. |
| BR-5 | Phase transitions are a **human** decision recorded in `Phases.md`. No agent or tool may advance a phase status. |

---

## 25. Pull request gates

**ENFORCED.** All must pass (`Architecture.md` §27.2).

| # | Gate |
|---|---|
| PR-1 | `./gradlew assembleDebug` succeeds |
| PR-2 | All unit tests pass |
| PR-3 | **Multi-account isolation matrix passes - blocks merge** (§26) |
| PR-4 | Lint + Detekt with zero new violations |
| PR-5 | Gradle dependency verification passes |
| PR-6 | APK secret scan: no client secret, no token pattern |
| PR-7 | Log scan: no prohibited log calls introduced |
| PR-8 | Formatting: ktlint / Spotless |
| PR-9 | Migration check: any schema change has a migration and a test |
| PR-10 | **Prohibited-phrasing scan** (§23) |
| PR-11 | **Domain-purity check**: `:domain` has no Android imports (§4) |
| PR-12 | If architecture or an ADR changed, the docs changed in the same PR |

---

## 26. Multi-account isolation matrix

**ENFORCED. A failure BLOCKS THE BUILD. This is the single most important rule in the repository.**

This is the most important test suite in the project (`PRD.md` R-04, `Architecture.md` AR-04, §23.2).

| # | Scenario | Assertion |
|---|---|---|
| M1 | Two accounts, each with distinct files | `listFiles(A)` returns only A's files; `listFiles(B)` only B's |
| M2 | Five accounts | Every one lists only its own files; the merged unified view contains all five, correctly attributed |
| M3 | Same file name in A and B | Two distinct rows; each carries the correct `accountId`; neither is merged |
| M4 | Same provider `fileId` presented for two accounts (simulated) | Two distinct rows; never merged (FI-07) |
| M5 | Disconnect A, then list | A returns nothing; no A rows in any cache, recent, favourite, or search result; B unaffected |
| M6 | Disconnect A, then search unified | Only B's results; A contributes nothing |
| M7 | A's token fails (`invalid_grant`) | A goes to `AuthorizationRequired`; B continues fully; A's failure never propagates to B |
| M8 | A's token fails during unified search | B's results still returned; a partial-failure notice names A |
| M9 | Concurrent operations across A and B | Each request carries the correct token. **Asserted on the auth header per request, not on the outcome.** |
| M10 | Concurrent operations **within** A | Exactly one token refresh occurs (per-account mutex) |
| M11 | Disconnect A while an A operation is in flight | The operation is cancelled; no post-disconnect write to A's data; B unaffected |
| M12 | Document provider: A's document id requested while A is disconnected | Refused; nothing about A is exposed |
| M13 | Document provider: A's document id presented with a claimed account of B | Refused (AC-12.5) |
| M14 | Cache: write a row for A, query the cache for B | No A row returned (AC-03.4) |
| M15 | Upload to A, verify the request's auth header | Carries A's token |
| M16 | Rename in A while B has a file with the same name | Only A's file is modified |

**M9, M10, and M16 are the ones most likely to be skipped and most likely to hide a real defect.** They assert on **the request that was made**, not the visible outcome, because a correct outcome can be produced by an incorrect request when only one account is involved.

**This suite is active from the first commit**, even while it is trivial. Adding it later is how it becomes incomplete.

---

## 27. Database and migration rules

| # | Rule |
|---|---|
| DB-1 | No schema change ships without a `Migration` and a tested `MigrationTestHelper` case (MIG-1). |
| DB-2 | `fallbackToDestructiveMigration()` is **banned in release builds**. Destructive migration requires an explicit product decision and a user-visible warning (MIG-2). |
| DB-3 | A migration that cannot preserve cache data must say so, and **must never touch `ConnectedAccount` or `TokenSet`** - losing a token forces an unnecessary re-authorization (MIG-3, AR-16). |
| DB-4 | Every migration is tested **with data present**, not only on an empty database (MIG-4). |
| DB-5 | Schema version is asserted in a test against a constant, so an un-migrated entity fails CI rather than production (MIG-5). |
| DB-6 | `UNIQUE(accountId, fileId)` on file metadata is what makes FI-07 hold. It is not removable for performance. |
| DB-7 | A folder is a `FileMetadata` row with `isFolder = true`. There is no separate folder table. Rationale is recorded so it is not re-litigated (§9.3). |

---

## 28. Test requirements

| # | Rule |
|---|---|
| TS-1 | `FakeCloudProvider` with **per-account failure injection** is how the isolation matrix is written. It is a required deliverable, not a convenience. |
| TS-2 | Hand-written fakes only. No MockK, no Turbine (`Architecture.md` §4.2). |
| TS-3 | Provider tests run against recorded/sanitised responses and scripted failures. **The live Drive API is never called in CI.** |
| TS-4 | Integration tests against real Google accounts are **manual**, run before each phase gate and before release. They are **never** faked into a green CI. |
| TS-5 | Every screen's loading, empty, error, offline, stale, and permission states are tested. |
| TS-6 | OAuth tests cover every token state transition, refresh mutual exclusion, `invalid_grant`, and cancellation. |

---

## 29. Accessibility requirements

| # | Rule |
|---|---|
| AC-1 | TalkBack verified on every screen. |
| AC-2 | Verified at 200% font scale. |
| AC-3 | Contrast meets requirement in **both** themes. |
| AC-4 | Touch targets are at least 48 dp. |
| AC-5 | **No information is conveyed by colour alone.** Every account badge has a text or shape channel, not just a hue. |

AC-5 is not only an accessibility rule. In this product, colour-coded accounts are the primary mechanism for preventing a user from acting on the wrong account (`PRD.md` UP-05), so colour-only attribution is also a **correctness** defect.

---

## 30. Copy and naming rules

| # | Rule |
|---|---|
| CP-1 | Account identity is visible wherever a file is actionable. The user must never be unsure which account owns a file. |
| CP-2 | UI copy is written to match **measured** provider behaviour, not assumed behaviour (Q-10, R-21). |
| CP-3 | Quota figures are never summed across accounts. |
| CP-4 | Partial search results are disclosed in the copy, not only in an icon. |
| CP-5 | Error copy comes from the single `AppError` mapping, so the same error never reads differently on two screens. |
| CP-6 | Naming distinguishes `LocalAccountId` (ours) from `ProviderFileId` (theirs, opaque) in code, so FI-05 is visible at every call site. |

---

## 31. Documentation rules

| # | Rule |
|---|---|
| DC-1 | If architecture or an ADR changed, the docs changed in the same PR (PR-12). |
| DC-2 | Every `REQUIRES VALIDATION` marker ends with a `docs/validation/` file, or remains an explicitly accepted live open issue. A silently dropped marker is a defect. |
| DC-3 | Measured values are recorded in `Memory.md` and **hard-coded nowhere**. |
| DC-4 | An ADR status is not upgraded from `PROPOSED` without validation evidence. |
| DC-5 | Section numbers in this document are stable. Citations to §1, §5, §7, §23, §26, §32, §33, §34 must keep resolving. |

---

## 32. Compliance claims

**CONTRACTUAL.**

| # | Rule |
|---|---|
| CC-1 | **No document, status field, README, commit message, store listing, or UI string may state that OAuth verification is approved, granted, in progress, submitted, or expected.** It is a multi-week review with a real chance of refusal or forced downscoping. |
| CC-2 | No claim of Google endorsement, partnership, or approval. |
| CC-3 | Google OAuth verification is **not** a formality and **not** automatic. |
| CC-4 | The annual security assessment is **annual**, not a one-off cost. |
| CC-5 | If verification is not granted at release, the release is **limited to the internal test track** and the unverified-app warning is understood (`Architecture.md` §27.4). |
| CC-6 | The privacy policy and data-safety declaration must match actual app behaviour, and the in-app version must match the published policy. |
| CC-7 | `drive.file` is **not** an equivalent, cheaper alternative to be proposed as one. It cannot browse an account. It is a different, smaller product. |

---

## 33. Future providers

**ProviderRegistry supports multiple providers structurally, but:**

| # | Rule |
|---|---|
| FP-1 | **No interface stub, mock implementation, or speculative data model for OneDrive or Dropbox may be added** before one is actually being built. |
| FP-2 | A speculative provider abstraction layer is how YAGNI violations become permanent architecture. |
| FP-3 | Non-Google providers are out of MVP scope (`PRD.md` §30.3). |
| FP-4 | If a provider is ever added, the cost is one directory under `cloud/`, one registration line, and a capability mapping. **No UI, domain, or database changes.** If adding a provider requires changing any of those three, the abstraction has leaked and is fixed first. |

---

## 34. Infrastructure prohibition

**The following are not built. None has a driver in this product** (`Architecture.md` §24.3).

| # | Not built |
|---|---|
| IN-1 | Microservices |
| IN-2 | Kubernetes |
| IN-3 | Event-driven infrastructure |
| IN-4 | A message bus |
| IN-5 | A service mesh |
| IN-6 | A distributed cache |
| IN-7 | Server-side search |
| IN-8 | A server-side metadata index - it would require uploading the user's file metadata to our servers, worsening the privacy story and the assessment burden for no MVP benefit (§33.4) |
| IN-9 | File proxying - permanently rejected (N-11) |

**The only server-side component is a stateless token-exchange endpoint, and the most likely end state is that even that is deleted** once Q-02 is answered.

This architecture is intentionally small. The complexity that genuinely exists here - account isolation, token lifecycle, quota discipline, and provider incompleteness - is handled explicitly and tested, rather than absorbed by infrastructure.

---

## Appendix A - Dependencies explicitly not added

| Not added | Reason |
|---|---|
| Hilt / Koin | The object graph is small. A hand-written `AppContainer` is ~50 lines, has no codegen cost, and is trivially greppable. Revisit only if the graph becomes genuinely large. |
| Retrofit | Only the Drive API and one token endpoint are consumed. OkHttp + Kotlin serialization avoids annotation processing. |
| Firebase / Crashlytics | Adds a data transfer surface requiring privacy justification. Decided at Phase 17 (§13). |
| AppAuth-Android | Only if **both** Q-01 and Q-02 resolve against a custom flow. |
| MockK / Turbine | Hand-written fakes (§28). |
| Firebase Analytics | The allow-list is small enough for a thin auditable wrapper. |
| Any JSON-schema or DI codegen plugin | Not needed at this size. |
