# Validation register

This directory is where claims get closed. Every `REQUIRES VALIDATION` marker in
`PRD.md` and `Architecture.md` points here, and every entry here states one of
three things: **measured**, **not applicable**, or **open** — with a named owner
and a date.

## The rule this directory exists to enforce

`PRD.md` §29 and `Architecture.md` §3.3 mark a number of assumptions that are
plausible, widely repeated, and wrong often enough to matter. The failure mode
they guard against is not ignorance; it is a plausible-sounding number reaching
the UI. A "5,000 files per query" limit or a "6 hours" thumbnail lifetime that
was never measured is indistinguishable from a measured one once it is in a
string resource.

So:

- **Nothing is marked validated on the basis of a web page, a forum post, a
  Stack Overflow answer, or a changelog.** Those are leads, not findings.
- **A finding records what was measured, how, on what date, and by whom.** A
  measurement that cannot be repeated is not a measurement.
- **An open item stays open.** It is never quietly closed because a phase needed
  to move.
- **A negative finding is a finding.** "Drive caps `files.list` at 1,000" is more
  valuable than a guess, because it changes the design.

## Why several items are still open

Most of this register is unfilled, and the reason is structural rather than
disinterest:

| Blocker | Effect |
|---|---|
| No JDK, no Android SDK | The build has never run, so no version, floor, or capability in the version catalogue is verified |
| No live Google account authorised for testing | Every Drive-semantics question (Q-05…Q-11) is unmeasurable |
| V-01 not sent | The one question that can invalidate the product has no answer and no owner |

Engineering proceeded anyway on the parts that do not depend on those answers —
the domain layer, the build gates, the error taxonomy. None of that work encodes
a measured claim, which is why it was safe to do and why the register is
legitimately sparse.

## Files

- `register.md` — the V-01…V-20 validation items, their status, and owners.
- `open-questions.md` — the Q-01…Q-12 architectural questions and what each one
  would change.

## Naming

Findings are `V-NN-short-slug.md` (for example `V-06-files-list-cap.md`). A
finding file must contain: the question, the method, the environment, the raw
result, the conclusion, the date, and the author. A finding without raw data is
an assertion, and assertions do not close a validation item.

Spikes used to produce a finding are throwaway and live under `spike-*/`, which
is git-ignored. They must never merge; the finding is the deliverable.
