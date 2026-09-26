# Open questions

The Q-01…Q-12 set from `Architecture.md` §3.3, with what each answer would change.
The point of recording the *consequence* of each question is that these are not
research tasks — each one is a fork in the design, and several are cheap to
resolve.

Status is uniformly **OPEN**. None has been answered, and none is estimated
anywhere in this repository.

## Architecture-changing

| ID | Question | What each answer changes |
|---|---|---|
| **Q-01** | Does `AuthorizationClient` yield a Drive-suitable **refresh token** for direct Drive REST calls, or only a short-lived credential? | **Yes** → the current Credential Manager design holds. **No** → the whole OAuth design changes: custom flow or AppAuth-Android, and `AuthorizationClient` is removed. ADR-03, ADR-05, `AR-03` |
| **Q-02** | Does Google's installed-app PKCE flow work on Android without a backend, and what redirect handling does it require? | **Yes** → **the backend is deleted, not kept "just in case."** **No** → a stateless token-exchange endpoint is designed, and the security assessment in Q-03 applies. ADR-06, `AR-02` |
| **Q-03** | If a backend is used, what is the minimum it must store, and what security-assessment tier results? | Sets the compliance budget and the largest external cost. A "no tokens stored" answer collapses the backend to a code exchanger. `AR-02`, `AR-11` |
| **Q-04** | Is a multi-account personal file manager a **permitted application type** for restricted scopes? | **The product.** "No" or "unclear" stops the project and re-scopes it to `drive.file`. `AR-01`, `PRD.md` §29.1. **This is V-01 and it requires a human to send an email to Google** |

## Design-affecting

| ID | Question | What the answer changes |
|---|---|---|
| **Q-05** | What are the real per-project Drive API quotas for this project? | Fan-out sizing and cache policy; the `QuotaGovernor` design. Quotas are per-project, so this cannot be known in advance. `AR-05` |
| **Q-06** | What are the real `files.list` result caps and `q` operator semantics? | Whether search results can ever be complete, and how `Completeness` is presented to the user. `AR-06` rates misjudging this **High**: users conclude their files are missing. `Completeness` is already modelled in the domain so the answer is presentable when it arrives |
| **Q-07** | How long do `thumbnailLink` values stay valid? | Thumbnail cache policy. A stale link must produce a type-icon fallback, never an error. Note `thumbnailLink` is bearer-adjacent: logging one is equivalent to logging a credential |
| **Q-09** | Is resumable upload supported for Android clients, and does it survive process death? | Background upload strategy. WorkManager cannot resume an in-flight request body. Until answered, uploads are foreground-bound and the UI says so honestly rather than promising continuation |
| **Q-11** | Does `openDocument` streaming survive large remote files in DocumentsUI, or is cache-then-serve required? | `DocumentsProvider` design, and whether the provider ships in MVP. `AR-07`, `AR-08` |
| **Q-12** | What `minSdk` constraints does the dependency set impose? | Build configuration and the size of the addressable audience. `AR-12` rates this **High**. Answering it requires resolving the real dependency graph, which requires a JDK and an Android SDK. If the floor exceeds 26, **raise `minSdk` and accept the smaller audience** — do not work around it |

## Content and semantics

| ID | Question | What the answer changes |
|---|---|---|
| **Q-08** | Can Google-native Docs/Sheets/Slides be exported, or only linked? | Preview and download behaviour. `CloudFile.isDownloadableAsBytes` currently encodes the conservative answer: native documents are not downloadable as bytes, and `EXPORT` is the separate action for them |
| **Q-10** | What are Drive's real semantics for duplicate names, versioning, and folder creation? | Upload UI copy. Silent renaming is a data-integrity hazard, so the UI must report Drive's actual behaviour rather than assume a convenient one |

## Notes on ownership

None of these has an owner. Q-04 is the one that matters most and the one no
amount of engineering will move: it needs a written enquiry sent by a person, and
a person who owns the answer.

`Architecture.md` §3.3 records the same set. This file adds the consequence
column, because the useful question is not "what do we not know" but "what would
we have to undo."
