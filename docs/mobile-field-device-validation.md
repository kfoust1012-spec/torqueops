# Mobile Field Device Validation

Run this on one iPhone and one Android device after a fresh native rebuild.

This is the real-device validation pass for the compressed field workflow:
- current assignment priority
- stop-console execution flow
- navigation and call handoffs
- inspection speed path
- photo and video evidence
- estimate, parts, invoice, and payment flow
- closeout gating
- dictation

## Build Prerequisite

1. Regenerate native builds:
   - `pnpm --filter @mobile-mechanic/mobile android`
   - `pnpm --filter @mobile-mechanic/mobile ios`
2. Install the new build on one Android phone and one iPhone.
3. Sign in with a technician account that has at least one assigned stop.
4. Use a stop that has:
   - customer phone
   - service address
   - draft inspection
   - draft estimate or no estimate yet
   - at least one draft part line
   - draft or unpaid invoice

## Core Stop Flow

1. App open and queue priority
   - Open the app fresh.
   - Confirm `Current assignment` appears before workday tracking.
   - Confirm the primary action is effectively `Resume current stop` or `Open next stop`.

2. Navigation handoff
   - From a scheduled or dispatched stop, tap `Navigate`.
   - Confirm the stop moves to `en_route` automatically or clearly queues that state offline.
   - Return from Maps.
   - Confirm the `Back from navigation` sheet appears.
   - Confirm the primary next move is `Mark arrived` when appropriate.

3. Customer call handoff
   - Tap `Call customer`.
   - Return from the phone app.
   - Confirm the `Customer call follow-up` sheet appears.
   - Save one call outcome with a quick chip.
   - Save one call outcome with dictation.
   - Confirm the saved outcome appears in technician notes.

4. Stop-console interruption recovery
   - Start one quick estimate line.
   - Leave the app and return.
   - Confirm `Resume where you left off` appears.
   - Repeat for:
     - part sourcing
     - evidence capture
     - quick payment

## Inspection Flow

1. Section progression
   - Open inspection.
   - Confirm the next section CTA is obvious.

2. Quick pass path
   - In one section, use `Pass now` on at least three untouched items.
   - Confirm each item saves in one action.
   - Confirm the next unchecked item is scrolled into view and marked `Next up`.

3. Compact pass rows
   - After quick-pass saves, confirm simple passed items collapse into compact `Saved pass` summaries.
   - Confirm `Adjust result` reopens one compact row correctly.

4. Attention / fail path
   - Mark one item `attention`.
   - Mark one item `fail`.
   - Confirm severity is required.
   - Confirm note/recommendation chips work.
   - Confirm dictation works for note and recommendation fields.

5. Offline queue behavior
   - Disable connectivity.
   - Save at least one inspection item.
   - Confirm the inspection queue notice appears.
   - Reconnect and confirm the queue clears.

## Evidence Flow

1. Stop-native evidence sheet
   - From the stop console, tap `Add evidence` or `Capture evidence`.
   - Confirm the evidence sheet opens without leaving the stop.

2. Photo capture
   - Take one photo.
   - Confirm it appears in the recent evidence list.

3. Video capture
   - Record one short video.
   - Confirm it appears in the recent evidence list.

4. Sticky category
   - Change evidence category.
   - Capture another asset.
   - Confirm the category stays selected.

5. Offline evidence queue
   - Disable connectivity.
   - Capture one photo or video.
   - Confirm the upload is queued and clearly labeled.
   - Reconnect and confirm it uploads.

## Estimate And Parts Flow

1. Inline estimate start
   - If no estimate exists, start one from the stop console.
   - Confirm it does not require office help.

2. Quick line workflow
   - Add one labor line from the stop.
   - Add one part line from the stop.
   - Use dictation once for line details.

3. Part sourcing
   - Source a part from the stop.
   - Use:
     - recent supplier chip
     - availability chip
     - sourcing note chip
     - dictation for a sourcing note
   - Confirm the selected source summary appears on the stop.

4. Full estimate fallback
   - Open the full estimate route.
   - Confirm deeper editing still works when needed.

## Billing And Payment Flow

1. Invoice draft
   - Create an invoice if missing.
   - Edit a draft if present.

2. Issue and payment
   - Issue the invoice from the stop or invoice screen.
   - Record one manual field payment.
   - Confirm payment history appears.

3. Quick payment sheet
   - Use amount presets.
   - Use tender chips.
   - Use payment note chips.
   - Use dictation for a payment note.

4. Offline billing behavior
   - Disable connectivity.
   - Save one draft invoice edit.
   - Record one payment or payment handoff.
   - Confirm the correct queue notices appear.
   - Reconnect and confirm the queue clears.

## Closeout Gating

1. Completion blockers
   - Try to complete the stop with one blocker still missing:
     - incomplete inspection
     - no evidence
     - payment still due
   - Confirm the stop explains exactly what is blocking closeout.

2. Valid completion
   - Complete inspection.
   - Ensure at least one photo or video exists.
   - Resolve payment or structured payment follow-up.
   - Confirm the stop reaches completion only when all conditions are actually satisfied.

## Dictation Sweep

Use the narrower checklist in [mobile-dictation-device-validation.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/mobile-dictation-device-validation.md) after the broader field pass above.

Minimum fields to verify during this run:
- technician note
- call follow-up note
- inspection note
- inspection recommendation
- estimate line detail
- sourcing note
- payment note

## Failure Conditions

Do not call the field flow ready if any of these happen on a real device:
- app does not return into the correct stop context after Maps or phone
- `Navigate` fails to move scheduled/dispatched work into `en_route`
- evidence capture works only from the full gallery and not from the stop
- dictation stalls, duplicates badly, or silently fails
- inspection queue/evidence queue/billing queue behavior is unclear offline
- closeout blocker language is vague or misleading
- a mechanic has to guess what to do next after returning to the stop

## Output To Capture

Record the following after the device pass:
- device model
- OS version
- pass/fail per scenario
- any repeated phrase-transcription misses
- any return-from-app handoff failures
- any steps that still feel too slow in-hand

If dictation phrases fail repeatedly, update [dictation-context.ts](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/voice/dictation-context.ts).
