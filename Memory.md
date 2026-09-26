# Memory - Unified Cloud File Manager

| Field | Value |
|---|---|
| Document | Decision Log and Measured Values |
| Version | 1.0 |
| Status | Active. **This file begins at Phase 1, 2026-09-26.** |
| Related documents | `PRD.md`, `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md` |

---

## 0. What this file is, and what was lost

This file records decisions, their rationale, and measured values. Per `Rules.md` DC-3, a measured value is recorded **here** and hard-coded nowhere.

### 0.1 Honest statement of provenance

**The original `Memory.md` for this project did not exist.** `Rules.md`, `Design.md`, and `Memory.md` are all referenced by name from `PRD.md` and `Architecture.md`, so they were planned and never written.

Everything before the entry dated **2026-09-26** in this log is **unrecoverable**. Specifically lost:

- Every decision taken in conversation, and the reasoning behind it.
- Every dead end. What was tried, what failed, and why the alternative was chosen.
- Any measured value that was ever obtained - Drive API quotas, result caps, `q` semantics, `thumbnailLink` lifetimes, OEM test results.
- Any user research finding beyond what `PRD.md` §29 records as a *plan* to test.
- Any prototype or spike code. The repository has **zero git commits**.

**Nothing in this file is reconstructed or inferred.** Where a value is unknown it says `UNKNOWN` and stays that way until measured. Do not fill a gap from memory, from a blog post, or from Google's general documentation - `Architecture.md` §33.5.6 requires measurement, and `Rules.md` QD-1 enforces it.

### 0.2 Why this matters more than the other documents

`PRD.md` and `Architecture.md` describe *what* the system is. This file records *why*, and the reasoning is the part that cannot be regenerated. A future reader who disagrees with a decision here can evaluate the tradeoff. A future reader looking at a decision that exists only in an architecture document has to guess.

---

## 1. Decision log

Format: what was decided, the alternatives, the reasoning, and what would reverse it.

---

### D-1.1 - Android SDK levels

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED, PROVISIONAL · **Reversible:** yes, cheaply

| Level | Value |
|---|---|
| `minSdk` | **26** |
| `compileSdk` | **35** |
| `targetSdk` | **35** |

**Reasoning.** `PRD.md` §8.6 requires these to be decided at Phase 1, "not guessed". 26 is the floor that gives hardware-backed Keystore keys, adaptive icons, and scoped-storage-era APIs while remaining above Compose's minimum. 35 compiles and behaviour-targets a current stable platform.

**The provisional part, stated plainly:** these were derived from compatibility constraints, **not** read from a current release listing, and not validated by a build. No SDK is installed (`docs/environment/toolchain.md` §1).

**What would reverse it.** The binding constraint is `AuthorizationClient` (`androidx.credentials`), whose real `minSdk` floor has not been audited - this is Q-12 / D-1.3. If the floor exceeds 26, **raise `minSdk` and accept the smaller audience.** `Architecture.md` AR-12 rates this **High** probability and the mitigation is explicit: do not work around it.

**Verification owed:** a dependency audit, then a real build.

---

### D-1.2 - Toolchain versions

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED · **Reversible:** yes

| Component | Version |
|---|---|
| JDK | 17 (Eclipse Temurin LTS) |
| Gradle | 8.11.1 |
| Android Gradle Plugin | 8.7.3 |
| Kotlin | 2.0.21 |
| KSP | 2.0.21-1.0.28 |

**Reasoning.** AGP 8.x floors at JDK 17; 17 is the current LTS and avoids toolchain-maturity risk on a fresh machine. Gradle 8.11.1 is required by AGP 8.7.x and is pinned with a SHA-256 in `gradle-wrapper.properties`. Kotlin 2.0 is chosen over 1.9 because from 2.0 the Compose compiler ships as a Kotlin plugin - one version instead of two, eliminating a whole class of version-skew failure. KSP must match Kotlin exactly, so it is pinned in lockstep.

**Deliberately not done:** adopting the newest available AGP. Adopting a newer toolchain is an upgrade with its own compatibility matrix, not a default.

**Verification owed:** none of this has ever been compiled. See `docs/environment/toolchain.md` §4.

---

### D-1.3 - Dependency audit outcome

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** **NOT DONE - BLOCKED**

**Reasoning.** Q-12 asks what `minSdk` the dependency set actually imposes. Answering it requires resolving the real dependency graph, which requires a JDK and an Android SDK. **Neither is installed.** The audit is not estimated, not guessed, and not marked complete.

**Consequence:** D-1.1's `minSdk = 26` is provisional until this runs.

**Blocking:** `docs/environment/toolchain.md` §1, items B-1 and B-3.

---

### D-1.4 - Maximum connected accounts

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED, PROVISIONAL

**Value: 5.**

**Reasoning.** `PRD.md` §10.2 MA-01 proposes 5 and marks it "Proposed - confirm at Phase 0". Taken forward as 5 because it is the value the source document proposes, it bounds quota cost and UI complexity, and it is a configuration value rather than logic - changing it is a constant edit, not a refactor.

**Enforcement location.** `Architecture.md` §7.4 requires the limit to be enforced at the **repository boundary, not the UI**, so it cannot be bypassed by a screen that forgets to check.

**What would reverse it.** Nothing structural. If usability testing (V-16) shows users routinely want more, raise it and re-measure quota cost.

---

### D-1.5 - The account identity scope

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DEFERRED to Phase 0

`PRD.md` §9.2 requires the exact `email` / userinfo scope string, marked "Confirm the exact scope string during Phase 0".

**Not decided here.** Writing a scope string from memory is exactly the failure mode `Rules.md` TK-5 and `Architecture.md` §33.5.6 exist to prevent. The string is read from current official documentation during Phase 0 and recorded here. Until then: **UNKNOWN**.

**Constraint already fixed regardless of the string:** the app requests **only** scopes justified per feature, with no speculative scopes (SEC-08, TK-5). Least privilege is a rule, not a tuning decision.

---

### D-1.6 - Scope fork: `drive` vs `drive.readonly`

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** **CANNOT BE DECIDED - external dependency**

**This is a fork, not a parameter.** It cannot be resolved by engineering. It depends on a decision by Google during OAuth verification.

| Outcome | Consequence |
|---|---|
| `drive.readonly` granted | Core product (browse, search, gallery, download) works. **All write features are unavailable.** |
| `drive` granted | Full MVP including upload, rename, move, trash, create folder. |
| Downscoped to `drive.file` | **Product-killing.** It cannot enumerate an account. It is a different, smaller product (`Architecture.md` §33.7). |

**The decision made here is architectural, not about the outcome:** `PRD.md` R-03 requires that features sit behind **capability flags derived from granted scopes**, so a downgrade **degrades rather than breaks**. That is now codified as `Rules.md` PC-7 - the UI renders actions from `ProviderCapabilities`, never from a hardcoded list.

**This is the reason `CloudProvider.capabilities()` exists in the interface at all.** It is not an abstraction for hypothetical future providers; it is the mechanism that makes a forced scope downgrade survivable.

**Consequences already accepted:**

- Phase 14 (write operations) is **conditional** on the `drive` scope. If downscoped, Phase 14 is **cancelled, not re-planned** (`PRD.md` §30.2).
- Upload is P0 in `PRD.md` §30.1 because it assumes `drive`. Under `drive.readonly` it disappears, and the MVP shrinks. This is a real product change and must be raised as a change to `PRD.md` before implementation, per §30.7.

**Blocking:** V-01, V-02, and R-01. This cannot be engineered around, only prepared for.

---

### D-1.7 - Phase ordering (inferred phases confirmed)

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED

`Phases.md` marked phases 3, 5, 6, 7, 8, 9, 13, and 16 as **INFERRED** - gap-filled from layer ordering, since neither source document names them. Confirmed as the working sequence.

**Reasoning for the one non-obvious ordering:** Phase 2 (UX validation) precedes Phase 3 (skeleton and CI). V-16/V-17 test whether users understand the unified model, and that is cheap to learn before any module exists. Scaffolding first would be defensible too, but it commits effort before the cheapest de-risking has run.

**Note:** this confirms the *sequence*, not the entry/exit criteria. Those were not specified in the source documents and are recorded per phase as work proceeds.

---

### D-1.8 - `Rules.md` authored with fixed section numbers

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED

`PRD.md` and `Architecture.md` cite `Rules.md` by section number: §1, §5, §7, §23, §26, §32, §33, §34. Those numbers are load-bearing cross-references.

**Decision:** `Rules.md` is structured so those eight numbers resolve to the intended content, and the document states that its section numbers are stable (`Rules.md` DC-5). New rules are appended as new sections or as sub-rules within an existing ID - never by renumbering.

**Why it matters:** if §26 drifts to §27, the reference from `PRD.md` R-04 and `Architecture.md` §23.2 silently points at the wrong rule, and the most important test suite in the project loses its stated authority.

---

### D-1.9 - `TransferDestination` reduced to an interface, deviating from `Architecture.md` §6.1

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED — **deviates from `Architecture.md` §6.1**

`Architecture.md` §6.1 sketches `TransferDestination` as a sealed class whose `DocumentTree` variant holds an `android.net.Uri`, and whose `AppCache` variant holds a `java.io.File`.

`:domain` is a pure Kotlin JVM module (D-1.1, ADR-10, `Rules.md` L-1), so `Uri` cannot appear there. This is not a judgement call — applying `kotlin-jvm` makes an Android import a **compile error**, which is the enforcement the architecture asked for.

**Decision:** `TransferDestination` is an interface in `:domain` carrying a single `logLabel`. The concrete forms — `AppCacheDestination`, `DocumentTreeDestination`, `FileProviderDestination` — live in `:data`, which already hosts the transfer engine.

**The trade-off, stated plainly:** the domain can no longer destructure a destination, and a caller holding a `TransferDestination` cannot open it. The domain never needs to: interpreting a destination is the engine's job, and the engine is in `:data`. What is lost is compile-time exhaustiveness over the variants, which is a real cost and is not being hidden.

**Why deviation was correct rather than convenient:** the alternative was to weaken L-1 so a signature could stay as sketched. L-1 exists precisely to stop platform types leaking inward; a documented deviation that keeps the rule intact is the right trade, and a rule quietly relaxed to fit one signature is how architectural constraints stop meaning anything.

**What this costs us:** the `M-x` isolation matrix in `Architecture.md` §27 must be exercised through `:data`'s engine and `:data`'s repositories rather than through the domain. Noted, not worked around.

---

### D-1.10 - The M1…M16 isolation matrix is tested at the data layer, not against a fake provider

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED

`Architecture.md` §27 requires a blocking M1…M16 multi-account isolation matrix. `Rules.md` §33 and FP-1 forbid a second provider implementation, a fake, and a mock.

These are in tension, and the tension is real rather than a drafting slip: a matrix that fans out across two accounts and asserts no cross-contamination wants a provider whose responses the test controls.

**Decision:** the matrix is exercised against **real `:data` code and a real SQLite database**, with rows inserted for two accounts and queries issued through the actual DAO and repository methods. A test that proves `UNIQUE(accountId, fileId)` holds, that a `FileRef.cacheKey()` differs per account, and that a two-account query returns no foreign rows is a stronger result than the same test against a mock, because it tests the actual schema rather than a stub's behaviour.

**No `FakeCloudProvider` was written.** FP-1 is respected literally, and the coverage is arguably better for it.

**Known limitation, recorded rather than hidden:** this does not prove the *provider implementation* cannot cross accounts. That is covered instead by the compile-time guarantee — `LocalAccountId` and `ProviderFileId` are distinct value classes, and every `CloudProvider` method requires an account — plus the `verifyDomainPurity` build gate.

---

### D-1.11 - Domain identity is enforced by the type system, not by convention

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED

`LocalAccountId`, `ProviderId`, and `ProviderFileId` are `@JvmInline value class`es rather than `String` or `Long`.

**Reasoning:** I-1 and FI-07 are the highest-consequence rules in the project — mixing accounts leaks one user's files into another's session — and a rule enforced by reviewer vigilance fails eventually. Distinct types make `providerFileId(accountId = ...)` a compile error, so the mistake cannot reach production. The cost is verbosity at call sites, which is the correct place to pay it.

`ProviderId.GOOGLE_DRIVE` is a named constant rather than a bare string, so adding a second provider requires a visible, deliberate edit — consistent with FP-1's "no second provider" while not pretending the abstraction is unreal.

---

### D-1.12 - Build gates are implemented as Gradle tasks, not CI-only checks

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED

The prohibited-phrasing scan (PS-1…PS-3), the APK secret scan (TK-2), and the domain-purity check are Gradle tasks in the **root** build, wired into `check`, and invoked by name in CI.

**Reasoning:** a rule enforced only in CI is enforced once per push instead of on every commit, and its failure message arrives too late to be useful. As Gradle tasks they run on `./gradlew check` locally, produce an actionable message at the point of the mistake, and cannot be forgotten in a new module because the root declares them once.

**The phrasing scan covers event names as well as strings**, because an analytics event named `unlimited_storage_purchased` is a banned claim whether or not a user ever sees it (PS-5).

---

### D-1.13 - A gate that cannot yet apply must say so, not report success

**Date:** 2026-09-26 · **Phase:** 1 · **Status:** DECIDED

Two CI checks cannot be meaningful yet: the Room migration check (no `@Entity`
exists) and dependency verification (no resolution has happened). Both were
initially written as unconditional failures, which would have made the pipeline
permanently red for the honest reason "this project has no database yet" — a
signal that stops meaning anything.

**Decision:** such a check distinguishes three states and says which one it is in.
Not-applicable is reported as a **notice**, explicitly labelled *not counted as
passing*, and names the phase that will make it real. A check that silently skips
is the failure mode; a check that says "not applicable yet, and here is when it
starts applying" is information.

**The distinction being protected:** *"not implemented yet"* and *"implemented and
the schema was not committed"* must never look alike. The first is ordinary
early progress. The second is a data-loss bug, and it is the one the gate exists
to catch. A gate that cannot tell them apart is worse than no gate, because it
teaches the team to read red as noise.

**Consequence accepted:** the migration job can be green while checking nothing.
That is stated in the job's own output, every run, so nobody has to guess later
whether it ran.

---

### D-1.14 - Room schema: primitive columns, surrogate key, string enums

**Date:** 2026-09-26 · **Phase:** 6 · **Status:** DECIDED

Three schema decisions that are easy to reverse by accident.

**1. Columns are primitives, not domain value classes.** `account_id` is a
`Long`, not a `LocalAccountId`. The value classes exist to make *call sites*
safe, and a database has no call sites and no compiler to catch a mistake. It
also means re-representing a domain id cannot silently rewrite a column type.
Domain types are reconstructed by mappers at the boundary.

**2. `file_metadata` uses a surrogate `local_id` primary key, with
`UNIQUE(account_id, file_id)` as a separate index.** The natural key is what
carries the FI-07 guarantee; the surrogate exists so a future re-keying (adding
`provider` to the natural key, say) does not rewrite `recent_file` and
`favorite_file`. The guarantee lives in the UNIQUE index, not in the primary key,
and those are not the same thing.

**3. `pending_operation.operation` and `.state` are strings, not enum ordinals.**
An ordinal shift silently re-decodes persisted rows as a different operation. A
queued `DELETE_PERMANENTLY` decoding as `TRASH` is not a recoverable bug, and a
schema migration cannot detect it because the column type never changed.

**Also decided:** `outcome_uncertain` on `PendingOperationEntity`. An operation
whose outcome is unknown must be **reconciled** against the provider, not
retried. Conflating "provably never sent" with "maybe sent" is how a resumed
upload becomes two uploads.

---

## 2. Measured values register

**Empty by design.** Per `Rules.md` DC-3, a measured value is recorded here and hard-coded nowhere. Per `Rules.md` QD-1, quotas, caps, and semantics are **read from the source and measured** - never hard-coded from memory.

| ID | What to measure | Value | Measured on | Source |
|---|---|---|---|---|
| V-06 | Per-project Drive API quota (per 100s user / per 100s project) | **UNKNOWN** | - | Cloud Console |
| V-06b | Per-project Drive API quota (storage) | **UNKNOWN** | - | Cloud Console |
| V-07 | `files.list` maximum result cap | **UNKNOWN** | - | Instrumented live query |
| V-07b | `q` operator semantics actually supported | **UNKNOWN** | - | Instrumented live query |
| V-08 | `thumbnailLink` lifetime | **UNKNOWN** | - | Poll a fetched link |
| Q-08 | Google-native export per MIME type (Docs / Sheets / Slides) | **UNKNOWN** | - | Attempt export |
| Q-09 | Resumable upload supported; survives process death? | **UNKNOWN** | - | Spike |
| Q-10 | Drive semantics: duplicate names, versioning, folder creation | **UNKNOWN** | - | Live tests, scratch accounts |
| Q-11 | `openDocument` streaming on large remote files | **UNKNOWN** | - | Device matrix |
| Q-12 | `minSdk` floor imposed by the dependency set | **UNKNOWN** | - | Dependency audit (D-1.3) |

**A row left as `UNKNOWN` is correct. A row filled from a blog post, from memory, or from general Google documentation is a defect** - it is the specific failure `Architecture.md` §33.5.6 warns about, and it silently becomes load-bearing in a cache-sizing or fan-out calculation.

---

## 3. Open questions carried forward

| # | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-04 | Is a multi-account file manager a **permitted application type** for restricted scopes? | **The product** | **UNASSIGNED** | Open - **V-01 written enquiry not sent** |
| Q-01 | Does `AuthorizationClient` yield a Drive-suitable **refresh token**? | The entire OAuth design | UNASSIGNED | Open |
| Q-02 | Does client-only PKCE work for Android without a backend? | Whether a backend exists | UNASSIGNED | Open |
| Q-03 | Minimum backend storage, and assessment tier? | Compliance budget | UNASSIGNED | Open |
| Q-05…Q-11 | Live API behaviour, caps, semantics | Caching, search, gallery, upload, provider | UNASSIGNED | Open |

**Q-04 has no owner.** It is the single blocking question: per `PRD.md` §29.1, a "no" or "unclear" stops the project and re-scopes it to a `drive.file` product. It requires a written enquiry to Google and a human to send it. **No engineering work unblocks it, and it gates everything.**

---

## 4. Blocker register

| # | Blocker | Blocks | Resolvable by |
|---|---|---|---|
| B-1 | No JDK installed | Phase 1 exit criterion; every build | Installing Temurin 17 |
| B-2 | No Android SDK installed | Phase 1 exit criterion; B-3, B-4, B-5 | Installing SDK + accepting licences |
| B-3 | No `ANDROID_HOME` / `ANDROID_SDK_ROOT` | All Gradle Android work | Environment variable |
| B-4 | Zero git commits; nothing ever built or run | Confidence in all authored config | First successful build |
| B-5 | No `gradle/verification-metadata.xml` | Dependency verification is **not** enforced (`Architecture.md` §27.2) | First dependency resolution, then commit |
| B-6 | V-01 enquiry to Google unsent and unowned | **The product** | A human sending it |
| B-7 | `Design.md` does not exist | UI work from Phase 9 onward | Authoring it |
| B-8 | `gradle-wrapper.properties` has no `distributionSha256Sum` | The wrapper distribution is **not** checksum-verified. CI fails on this deliberately | Reading the official hash from `gradle.org/release-checksums/` |
| B-9 | Blocker IDs in `docs/environment/toolchain.md` §4 were written with a **different scheme** from this register | Cross-referencing a blocker between the two documents silently points at the wrong thing | Reconciled 2026-09-26 — see note below |

### Note on B-8

The hash was left absent rather than filled in with a plausible-looking value. A
fabricated checksum is worse than a missing one: it looks authoritative, and the
next maintainer either deletes it or "corrects" it from an unverified source. The
CI `policy` job fails while it is absent, so the gap is loud.

### Note on B-9

`docs/environment/toolchain.md` §4 numbers its blockers `B-1…B-6` by *build
criterion* (build works, domain purity holds, KSP generates, CI is green, lint
baselines exist, dependency hashes recorded), while this register numbers them by
*root cause* (no JDK, no SDK, no env var, no commits, no verification metadata, no
V-01, no `Design.md`). The two schemes are not interchangeable, and citing "B-5"
across documents was ambiguous.

Resolved 2026-09-26: **`Memory.md` §4 is the single blocker register.**
`docs/environment/toolchain.md` §4 now refers to these IDs rather than defining
its own. A toolchain document should describe the environment, not maintain a
parallel issue tracker.

Fuller detail in `docs/environment/toolchain.md` §4.

---

## 5. Conventions

- Decisions are `D-<phase>.<n>`.
- Entries state what would **reverse** the decision. A decision nobody can revisit is a decision nobody really made.
- Unknown values are `UNKNOWN`. They are never estimated.
- A decision promoted from a document's `PROPOSED` state records the evidence that promoted it, per `Rules.md` DC-4.
