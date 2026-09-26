# Validation register

Status vocabulary: **OPEN** (not measured) · **MEASURED** (finding on file) ·
**N/A** (resolved as not applicable, with a reason) · **BLOCKED** (cannot be
attempted until a named prerequisite exists).

Nothing in this table may be marked MEASURED without a finding file in this
directory. See `README.md` for the standard a finding must meet.

## Blocking items

| ID | Question | Impact | Status | Owner | Notes |
|---|---|---|---|---|---|
| V-01 | Will Google confirm in writing that a multi-account personal file manager is a **permitted application type** for restricted Drive scopes? | **The product.** "No" or "unclear" re-scopes to a `drive.file` product (`PRD.md` §29.1) | **OPEN** | **UNASSIGNED** | Enquiry not sent. No engineering unblocks this. The single most important item in the repository |
| V-02 | Scope matrix: every requested scope justified against a shipping feature; no scope without one | OAuth compliance, Play review | **OPEN** | UNASSIGNED | Derivable from `PRD.md` §8, but needs sign-off |
| V-19 | Minimum security-assessment tier and its cost, from an empanelled assessor | Largest external cost; drives the client-only preference | **OPEN** | UNASSIGNED | Requires a third party, not engineering |
| V-16 | ≥5 of 5–8 users connect an account unaided | Onboarding viability | **OPEN** | UNASSIGNED | Needs the consent flow, so gated behind V-01 |
| V-17 | ≥80% of participants connect without confusion about what the app does with their files | Consent clarity; the anti-`AR-01` control | **OPEN** | UNASSIGNED | Same gate as V-16 |
| V-18 | Participants can state that the app **adds no storage** | The single most damaging possible misunderstanding | **OPEN** | UNASSIGNED | Directly tests `Rules.md` §1 |
| V-15 | No participant believes the app grants extra or pooled storage | Same, as a negative result | **OPEN** | UNASSIGNED | Same gate as V-18 |

## Architecture and provider behaviour

| ID | Question | Answers | Status | Owner | Notes |
|---|---|---|---|---|---|
| V-05 | Does `AuthorizationClient` yield a Drive-suitable **refresh token**, or only a short-lived credential? | The entire OAuth design (Q-01, ADR-03/05) | **BLOCKED** | UNASSIGNED | Needs a device, a real Google account, and the SDK |
| V-04 | Does Google's installed-app PKCE flow work on Android without a backend, and what redirect handling does it need? | Whether a backend exists at all (Q-02) | **BLOCKED** | UNASSIGNED | Same prerequisites as V-05 |
| V-14 | If a backend is required, what is the minimum it must store, and what assessment tier results? | Compliance budget, backend scope (Q-03) | **BLOCKED** | UNASSIGNED | Also depends on V-19 |
| V-06 | Real per-project Drive API quotas for this project | Fan-out sizing, cache policy, `QuotaGovernor` (Q-05) | **BLOCKED** | UNASSIGNED | Needs a live project; quotas are per-project, not per-app |
| V-07 | Real `files.list` result caps and `q` operator semantics | Whether search can be complete, and how `Completeness` is presented (Q-06) | **BLOCKED** | UNASSIGNED | High user impact: users conclude files are missing |
| V-08 | How long do `thumbnailLink` values remain valid? | Thumbnail cache policy; stale link must fall back to a type icon, never error (Q-07) | **BLOCKED** | UNASSIGNED | Also a security note: `thumbnailLink` is bearer-adjacent |
| V-09 | Can Google-native Docs/Sheets/Slides be exported, or only linked? | Preview and download behaviour (Q-08) | **BLOCKED** | UNASSIGNED | `CloudFile.isDownloadableAsBytes` already encodes the conservative answer |
| V-10 | Is resumable upload supported for Android clients, and does it survive process death? | Background upload strategy (Q-09) | **BLOCKED** | UNASSIGNED | Until answered, uploads are foreground-bound and the UI says so |
| V-11 | Drive's real semantics for duplicate names, versioning, and folder creation | Upload UI copy (Q-10) | **BLOCKED** | UNASSIGNED | Silent renaming is a data-integrity hazard; UI must not assume |
| V-12 | Does `openDocument` streaming survive large remote files in DocumentsUI? | `DocumentsProvider` design (Q-11) | **BLOCKED** | UNASSIGNED | Needs a real device with a real Drive file |
| V-13 | `DocumentsProvider` visibility and reliability across OEMs | Whether the provider ships in MVP (Q-11) | **BLOCKED** | UNASSIGNED | Needs an OEM device matrix |
| V-03 | Does the `drive.file` fallback product meet the PRD if V-01 fails? | The entire product shape | **OPEN** | UNASSIGNED | Cheap to write, and the thing to have ready if V-01 goes badly |

## Toolchain and build

| ID | Question | Answers | Status | Owner | Notes |
|---|---|---|---|---|---|
| — | Actual `minSdk` floor imposed by `androidx.credentials`, Compose, WorkManager, Room (Q-12, D-1.3) | Whether the audience is 8.0+ or narrower | **BLOCKED** | UNASSIGNED | Needs dependency resolution. `AR-12` rates this **High**. If the floor exceeds 26, raise `minSdk` — do not work around it |
| — | Does the pinned set (AGP 8.7.3 / Gradle 8.11.1 / Kotlin 2.0.21 / KSP 2.0.21-1.0.28) resolve cleanly? | Whether the build works at all | **BLOCKED** | UNASSIGNED | **The build has never been run.** Every version in `gradle/libs.versions.toml` is a pin, not a verified combination |
| — | Official SHA-256 of the Gradle 8.11.1 distribution | Wrapper integrity | **OPEN** | UNASSIGNED | Deliberately absent from `gradle-wrapper.properties` rather than fabricated. CI fails until it is added |
| — | `minSdk = 26` viability for `DocumentsProvider` and all-channels FGS on 8.0 | Foreground service behaviour | **OPEN** | UNASSIGNED | Documentation review, not measurement |

## Summary

Nothing is MEASURED. The single highest-value action is not an engineering task:
it is **assigning an owner and sending V-01**. Everything in the "BLOCKED" rows
above is blocked on tooling or credentials, both of which are obtainable this
week. Nothing in this register blocks the work already completed, because none of
that work depends on a measured claim.
