# Issues

This is the current list of known project-level gaps. Implementation tasks belong
in `WORKPLAN.md`; architectural decisions belong in `docs/decisions/`.

## Open

### I-001 — Experimental animations lack end-to-end browser tests

- **Severity:** Medium
- **Evidence:** Unit tests validate finite pure poses, but selector navigation and
  rendered motion are currently checked manually in the browser.
- **Risk:** A tile can disappear, target the wrong ID, or fail to reach the live
  avatar while the pose tests stay green.
- **Done when:** Automated browser coverage verifies the experimental page,
  selector count, every visible ID, and selected-state updates.

### I-002 — New behavioural ADRs have structural but not dedicated semantic tests

- **Severity:** Medium
- **Evidence:** ADR 0013–0017 are linked and the broad suite passes, but only some
  rules are asserted directly.
- **Risk:** Mood deposition, autonomous trace isolation, reduced-motion policy, or
  gaze fixation could regress without a test naming the broken contract.
- **Done when:** Each ADR has at least one focused test that fails when its central
  decision is reversed.

### I-003 — Experimental catalogue stability is not declared

- **Severity:** Low
- **Evidence:** Experimental animations are public `MoteAnimation` IDs but appear
  on a page labelled `New animations`; no versioning policy says whether those IDs
  are stable.
- **Risk:** Integrators may persist an ID that is later renamed or removed.
- **Done when:** README and release policy classify experimental IDs as stable or
  explicitly provisional.

## Closed

### I-004 — Decision documentation was not discoverable

- **Closed:** 2026-08-24
- **Resolution:** Added `docs/decisions/README.md`, ADR 0013–0017, inline citations,
  and repository planning/status documents.
