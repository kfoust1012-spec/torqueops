# Scheduling / Dispatch Board Integration Notes

## Files Added

- `supabase/migrations/0039_company_timezone_and_dispatch_blocks.sql`
- `supabase/migrations/0040_dispatch_block_rls.sql`
- `packages/types/src/dispatch.ts`
- `packages/validation/src/dispatch.ts`
- `packages/core/src/dispatch/scheduling.ts`
- `packages/api-client/src/repositories/dispatch.ts`
- `apps/web/app/dashboard/dispatch/page.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-board.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-job-card.tsx`
- `apps/web/app/dashboard/dispatch/_components/availability-block-form.tsx`

## Required Follow-Up

1. Run `pnpm db:reset` or apply the new Supabase migrations in your normal development flow.
2. If you regenerate Supabase types separately in this repo, run `pnpm db:types` and reconcile any generated artifacts you keep checked in.
3. Run `pnpm typecheck` after the database layer is current.

## Scope Implemented

- Web/admin-only dispatch board under `/dashboard/dispatch`
- Day and week views
- Jobs grouped by technician
- Unassigned scheduled jobs and unscheduled backlog sections
- Quick assign controls
- Quick reschedule controls
- Visible status badges
- Simple technician availability blocks with create and delete actions

## Not Included

- Route optimization
- Travel-time intelligence
- Drag-and-drop calendar interactions
- Customer portal scheduling
- Mobile scheduling UI