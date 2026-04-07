# Architecture Snapshot

This document is the current-state map for the workspace. Update it when responsibilities move or new cross-cutting systems are introduced.

## Applications

### `apps/web`

- Next.js office/admin surface
- Hosts operational workflows such as dispatching, estimates, invoices, and customer communication triggers
- Contains server-side processing paths for communication delivery and internal operational routes

### `apps/mobile`

- Expo mobile app for field technicians
- Consumes shared domain logic and API-facing packages
- Should stay focused on technician workflows rather than office administration

## Shared packages

### `packages/api-client`

- Shared repository functions and Supabase-facing data access
- Preferred entry point for application-level reads and writes

### `packages/core`

- Pure or mostly pure business logic
- Scheduling logic currently lives here and should remain UI-agnostic

### `packages/types`

- Shared TypeScript domain types
- Includes generated database types from local Supabase schema

### `packages/validation`

- Shared validation schemas and request-shape enforcement

## Database and platform

### `supabase/migrations`

- Source of truth for local schema evolution
- Contains table definitions, policies, guards, triggers, and workflow constraints
- Drift risk is highest here when schema changes are not reflected in shared types, repositories, or operational docs

## Current cross-cutting systems

### Dispatch board

- Office/admin workflow under `/dashboard/dispatch`
- Supports day and week scheduling views, technician grouping, unscheduled backlog, and availability blocks
- Follow-up details live in `tooling/dispatch-board-integration.md`

### Customer communications

- Durable communication outbox and delivery processing around estimates, invoices, reminders, and job updates
- Uses repository-layer enqueue functions plus a server-side processor
- Follow-up details live in `tooling/customer-communication-layer-integration.md`

## Drift-sensitive rules

- New database migrations should usually trigger review of `packages/types`, `packages/api-client`, and any affected docs
- New workflow-triggered sends should go through the communication enqueue/process flow rather than direct provider calls
- Shared business rules should move into `packages/core` or `packages/validation` instead of duplicating logic across apps
- Technician-only behavior belongs in mobile or explicitly scoped APIs, not mixed into office-only web flows without a clear boundary

## Known documentation gaps

- No deployment runbook yet