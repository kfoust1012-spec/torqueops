# ADR 0001: Documentation And Drift Control

## Status

Accepted

## Context

The workspace has grown into a multi-app, multi-package system with a nontrivial Supabase migration history, operational workflows, and external-provider integrations. Without a maintained documentation contract, knowledge drifts into chat history, local memory, and scattered feature notes.

That creates predictable failure modes:

- New contributors do not know which documents matter
- Schema and environment changes ship without matching operational docs
- Deferred follow-up work disappears after a feature is considered done
- Architectural boundaries blur across apps and shared packages

## Decision

The repo will maintain a small set of living documents with distinct responsibilities:

- `README.md`: orientation, workspace layout, core commands, and documentation expectations
- `docs/architecture.md`: current structure, responsibilities, and drift-sensitive rules
- `docs/environment.md`: required and optional runtime configuration by app and subsystem
- `docs/work-log.md`: dated milestone ledger with shipped scope and deferred follow-up
- `tooling/*.md`: focused implementation notes for larger feature milestones
- `docs/adr/*.md`: decisions that are architectural, policy-level, or expensive to reverse

## Consequences

### Positive

- Important context is stored with the code instead of outside it
- Feature work has an obvious place to record follow-up and operational impact
- Environment and architecture changes become easier to review for completeness
- Drift becomes visible because there is a known document set that should move with the code

### Negative

- Developers must spend a small amount of time updating docs as part of feature work
- Stale docs become more obvious, which means the team has to either maintain or remove them

## Rules

- If a change affects setup, routing, architecture boundaries, schema expectations, or external providers, update the relevant document in the same change
- If a milestone ships with known unfinished follow-up, record that follow-up in `docs/work-log.md`
- If a decision is likely to constrain later work, add an ADR instead of burying the rationale in code comments or chat
- If a document stops being useful, delete or replace it; do not keep decorative documentation

## Review trigger

Create another ADR when the team changes the documentation contract itself, adds a release process, or introduces a new subsystem large enough to deserve its own persistent documentation class.