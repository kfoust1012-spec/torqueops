## 2026-04-06 - Dashboard closeout is now a thin owner summary instead of a second Finance rail

What shipped:
- Removed the full Finance intervention rail from the owner [dashboard](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/page.tsx) so Dashboard stops acting like a second closeout desk.
- Strengthened the existing owner collections summary on the same page so it now calls out finance blocker and field-handoff counts directly and points owners into Finance instead of restating row-level closeout work on Dashboard.
- Added field-handoff counts into the dashboard billing summary so owners still see money pressure and technician billing outcomes without needing a separate Finance-style intervention rail.

Follow-up:
- The next owner simplification step should review whether the billing support panel is still carrying too much desk-like detail now that the closeout rail is gone.
- If owner feedback still says the dashboard feels too operator-heavy, the next pass should collapse more queue detail into owner summaries and reserve full row stacks for the specialist desks.

Docs touched:
- `docs/work-log.md`

## 2026-04-06 - Owner closeout summaries now stop retelling Finance's story in Dispatch

What shipped:
- Updated the owner [dashboard](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/page.tsx) so its collections summary now uses the same explicit `Resolve in finance` / `Open finance file` language as the row actions instead of falling back to generic `closeout thread` copy.
- Tightened Dispatch closeout-watch framing in [dispatch-operations-rail.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/dispatch/_components/dispatch-operations-rail.tsx) so it now explains only why the live visit is still on the board and hands the billing narrative back to Finance instead of re-describing the full collections story.
- Tightened the Dispatch recovery cards in [dispatch-command-center.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/dispatch/_components/dispatch-command-center.tsx) so their support copy now stays Dispatch-specific: stabilize the live visit here, then let Finance own the remaining closeout.

Follow-up:
- The next owner-desktop simplification step should decide whether Dashboard still needs a separate closeout rail at all once Finance is clearly established as the canonical collections desk.
- If owner feedback still says the product feels duplicated, the next pass should move from copy cleanup into structural compression by collapsing repeated closeout signals into a single shared owner summary component.

Docs touched:
- `docs/work-log.md`

## 2026-04-06 - Owner closeout actions now name the desk they actually open

What shipped:
- Updated owner closeout row actions in [dashboard/page.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/page.tsx) so they now read `Resolve in finance` or `Open finance file` instead of the vaguer `Review field handoff` / `Open closeout thread`, and the secondary action now reads `Finance queue`.
- Updated Dispatch closeout action labels in [dispatch-operations-rail.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/dispatch/_components/dispatch-operations-rail.tsx) and [dispatch-command-center.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/dispatch/_components/dispatch-command-center.tsx) so owners now see `Resolve in finance`, `Finance file`, and `Visit thread` instead of the less explicit `Review handoff`, `Open file`, and `Open drawer`.
- This keeps the same workflow power but removes some of the row-level translation work owners were doing in their heads to understand where each action would actually land them.

Follow-up:
- The next owner-desktop simplification step should probably trim repeated closeout-summary copy, not just action labels, so Dashboard and Dispatch stop restating the same billing narrative when Finance already owns it.
- If owner feedback still says the product feels too operator-heavy, the next pass should introduce a clearer owner summary mode on Dashboard rather than continuing to tune copy one phrase at a time.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Owner desktop desks now speak more clearly about ownership

What shipped:
- Added a clearer desk-ownership summary to the owner [dashboard](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/page.tsx) so it now states the intended operating split directly: Visits owns intake and release, Dispatch owns live execution, and Finance owns closeout.
- Tightened the [Visits](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/visits/page.tsx) hero copy so it reads as the production and release desk rather than another generic all-work queue.
- Tightened the [Finance](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/finance/page.tsx) thread summary and queue title so owners see it explicitly as the canonical closeout and field-billing-handoff desk.
- Tightened Dispatch closeout-watch copy in [dispatch-operations-rail.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/dispatch/_components/dispatch-operations-rail.tsx) so it now makes the ownership split explicit: Dispatch stabilizes the live thread, then Finance owns the remaining collections cleanup.

Follow-up:
- The next owner-desktop cleanup step should reduce duplicate closeout thread framing deeper in Dashboard and Dispatch row-level cards, not just in the headers.
- If owner feedback still says the system feels too “operator-heavy,” the next pass should distinguish owner summary mode from specialist desk mode more aggressively rather than layering in more explanatory copy.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Real-device field validation is now a first-class release artifact

What shipped:
- Added a consolidated real-device validation runbook in [mobile-field-device-validation.md](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/mobile-field-device-validation.md) that covers the actual compressed technician workflow end to end: current assignment priority, navigation and call handoffs, inspection speed path, evidence capture, estimate and parts, invoice and payment, closeout gating, and dictation.
- Added the new runbook to the documentation map in [README.md](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/README.md) so it is visible as a maintained project artifact instead of a one-off chat instruction.
- Updated [release-checklist.md](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/release-checklist.md) so hosted releases that materially change the field flow now explicitly require a real-device iPhone and Android validation pass, not just browser E2E confidence.

Follow-up:
- The next step is operational, not more repo work: run the new field-device checklist on one iPhone and one Android phone with the rebuilt native app, then capture the concrete slow spots or failures.
- Once that device pass exists, the next code step should be driven by the first repeated in-hand complaint rather than another speculative optimization pass.

Docs touched:
- `docs/work-log.md`
- `docs/mobile-field-device-validation.md`
- `docs/release-checklist.md`
- `README.md`

## 2026-04-05 - Simple passed inspection rows now collapse into compact summaries

What shipped:
- Updated [inspection-item-editor.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/inspections/components/inspection-item-editor.tsx) so saved pass items with no severity, notes, or recommendation now collapse automatically into a compact `Saved pass` summary instead of staying fully expanded in long sections.
- Added a one-tap `Adjust result` action on those compact rows so mechanics can reopen any simple pass item without losing the ability to edit it later.
- Synced the item-editor local state back to server/cached item props after save, which keeps the new compact/expanded behavior consistent when inspection data refreshes after each mutation.

Follow-up:
- The next inspection cleanup step should decide whether already-complete compact pass rows need an even lighter visual treatment or whether the current summary state is enough once it is seen on real devices.
- If field testing shows mechanics still want a more aggressive guided mode, the next pass should focus on collapsing completed rows above the fold automatically while preserving a manual “show all checked items” escape hatch.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Inspection save now points the mechanic at the next unchecked row

What shipped:
- Updated [inspection/[sectionKey].tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId]/inspection/[sectionKey].tsx) so after an inspection item saves, the section finds the next unchecked item, stores it as the next target, and scrolls it into view automatically.
- Added `Next up` highlighting in [inspection-item-editor.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/inspections/components/inspection-item-editor.tsx) so the mechanic has a clear visual handoff after a save instead of reacquiring the next row by eye.
- Reused the existing save path and validation rules, which means this is a pure momentum improvement: the workflow still saves the same way, but the section now behaves more like a guided checklist instead of a static long form.

Follow-up:
- The next inspection-speed decision is whether to broaden this into a true guided “pass and continue” mode that collapses already-complete rows more aggressively, or stop here and validate on devices first.
- If real-world testing shows the auto-scroll feels jumpy on long sections, the next pass should tune the offset or limit the behavior to simple pass saves only.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Untouched inspection items can now be marked pass in one tap

What shipped:
- Added a one-tap `Pass now` action in [inspection-item-editor.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/inspections/components/inspection-item-editor.tsx) for untouched `not_checked` items with no notes, recommendation, or severity yet.
- This gives the common-case inspection row a direct fast path instead of forcing the mechanic to tap `Pass` and then `Save item` for every simple pass result.
- Kept the existing explicit save flow for anything more complex than a simple pass, so attention/fail items and edited rows still use the fuller validation path and do not accidentally skip needed detail.

Follow-up:
- The next inspection-speed improvement should look at a smarter “save and move focus” behavior after pass results, so section progress keeps flowing without the mechanic having to visually reacquire the next row every time.
- If field testing shows mechanics still hesitate between `Pass now` and the regular status chips, the next pass should reduce that ambiguity with stronger placement or row-level hierarchy rather than adding more controls.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Inspection items now use quick field phrases and dictation instead of blank text boxes

What shipped:
- Added quick technician-note and recommendation phrase chips directly inside [inspection-item-editor.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/inspections/components/inspection-item-editor.tsx), with different defaults for `pass`, `attention`, `fail`, and `not_checked` results so common inspection outcomes can be captured with taps instead of typing.
- Added dictation to both inspection notes and recommendations in the same editor, reusing the shared voice system and new [inspection phrases](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/voice/dictation-context.ts) so field findings can be spoken instead of manually typed on the phone.
- Kept the existing inspection workflow and save semantics intact, which means the speed improvement happens inside the current checklist without changing offline behavior or completion rules.

Follow-up:
- The next inspection-speed improvement should focus on reducing the number of per-item saves, either with clearer autosave behavior or a faster “set result and continue” path for common pass items.
- Real-device validation is still useful here because inspection dictation now matters in one of the heaviest field flows, and that needs actual phone microphone validation rather than web-only confidence.
- If ride-alongs show the quick phrase chips are too generic, the next pass should specialize them by inspection section or item label instead of staying globally generic.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Navigate now auto-advances the stop into travel instead of forcing a second action

What shipped:
- Updated [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx) so tapping `Navigate` from a `scheduled` or `dispatched` stop now also attempts to mark the job `en_route` before opening Maps, collapsing the old two-step travel handoff into one mechanic action.
- Kept navigation resilient by not blocking Maps if the status mutation fails. The app still opens Maps immediately, but now surfaces whether the travel update succeeded, queued offline, or failed.
- Left the existing return-from-navigation sheet in place, which means the full travel loop is now tighter on both ends: `Navigate` starts travel, and returning from Maps points the mechanic at `Mark arrived` or `Resume current stop`.

Follow-up:
- The next travel-flow decision is whether a confirmed `Arrived` action should also be optionally suggested when the mechanic returns from Maps after enough elapsed time, rather than always waiting for an explicit tap.
- Real-device validation is still important here because browser E2E proves the logic path stays stable, but phone-level map handoff timing on iOS and Android is what will determine whether this feels instant in the field.
- With call and navigation handoffs tightened, the next highest-value speed work is likely around the inspection path, which is still the heaviest part of the field flow.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Returning from Maps now snaps back into the stop with the right next move

What shipped:
- Added a navigation-return flow in [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx) so when a mechanic comes back from Maps, the stop can reopen a `Back from navigation` sheet instead of dropping them into the workboard cold.
- The return sheet now gives one obvious next action based on the current stop state: `Mark en route`, `Mark arrived`, or `Resume current stop`, with the arrival window and service address still visible so the mechanic does not have to hunt for context again.
- Reused the existing app-state handoff pattern from the call flow, and widened [stop-console-recovery.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/jobs/stop-console-recovery.ts) so resuming after navigation is treated as a first-class interrupted stop task.
- Kept the external Maps jump in place, but reduced the re-entry friction by making navigation feel like a stop transition instead of a full context break.

Follow-up:
- The next travel-flow improvement should be deciding whether opening Maps should also auto-mark the stop `en_route` in the common scheduled/dispatched case, or at least offer that as an immediate pre-navigation action.
- Real-device validation is still useful here because browser-based E2E proves the stop stays stable, but only physical device testing will show how reliably iOS and Android hand app-state back after a Maps round-trip.
- The remaining external-app friction is now mostly contact and navigation outcome structure, not the stop console itself. The next pass should tighten arrival/travel automation rather than adding more stop modules.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Customer calls now return into a structured stop follow-up sheet

What shipped:
- Added an app-return call follow-up flow in [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx) so when a mechanic comes back from calling the customer, the stop can reopen a `Customer call follow-up` sheet instead of dropping them back into the workboard with no captured outcome.
- Added quick call-outcome chips, a dictated/manual call note field, and a one-tap `Save call note` action that writes directly into the existing technician-note pipeline, so the call result becomes stop history instead of memory.
- Added a manual `Log call outcome` fallback on the stop file, which covers cases where the OS/browser handoff does not re-enter through the normal app-state transition.
- Reused the shared dictation system with new customer-call phrase context from [dictation-context.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/voice/dictation-context.ts), and widened [stop-console-recovery.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/jobs/stop-console-recovery.ts) so call follow-up can resume after interruptions the same way estimate, sourcing, payment, and evidence already do.

Follow-up:
- The next compression step should reduce the remaining Maps handoff friction by making the stop explicitly snap back into `Arrived` / `Resume current stop` context after navigation returns.
- The call-follow-up sheet currently records the result as a technician note, which is the safest path for field context. If office users later need structured dispatch analytics on call outcomes, the next pass should add a typed call-outcome field rather than overloading notes forever.
- Real-device validation is still useful here, especially to confirm AppState return behavior on iOS and Android after leaving for the phone app.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Stop evidence can now be captured without leaving the stop console

What shipped:
- Added a stop-native evidence sheet to [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx) so mechanics can take a photo, record a short video, or choose media from the device library without leaving the active stop route.
- Reused the existing camera-first upload surface from [attachment-upload-sheet.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/attachments/components/attachment-upload-sheet.tsx) and the live/offline upload path from [attachments/api.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/attachments/api.ts), so the new stop sheet inherits sticky categories, queued offline uploads, and the same gallery refresh behavior as the dedicated photos route.
- Rewired the stop blockers, primary closeout actions, and action rail in [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx) so `Add evidence` now opens the in-stop sheet first instead of always bouncing the mechanic to the full gallery route.
- Added a compact evidence status card on the stop that shows whether proof is still missing, whether uploads are still queued, and gives a direct escape hatch to the full gallery only when the mechanic actually needs it.
- Expanded stop-console recovery state in [stop-console-recovery.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/jobs/stop-console-recovery.ts) so the app can remember `adding stop evidence` the same way it already remembered estimate, sourcing, and payment tasks.
- Updated the mobile regression coverage in [mobile-guided-stop.spec.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/e2e/tests/mobile-guided-stop.spec.ts) to follow the new evidence wording on the stop console.

Follow-up:
- The next compression step should put a lightweight after-call intake sheet on the stop, because calling the customer still throws the mechanic out to the phone app and back into a mostly blank state.
- The dedicated photos route still exists for deeper review and should stay, but the next pass could make the stop sheet show richer recent-evidence context or quick playback without growing the stop into another long admin screen.
- Real-device validation is still needed for the full voice + evidence combination, especially when dictating captions/notes around captured media on iPhone and Android.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Dictation vocabulary is now centralized and device validation is scripted

What shipped:
- Added a shared mechanic/billing/sourcing dictation vocabulary module in [dictation-context.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/voice/dictation-context.ts) so the estimate, invoice, stop-console, and note-composer dictation prompts stop drifting into one-off phrase lists.
- Rewired the existing dictation controls in [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx), [estimate/index.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId]/estimate/index.tsx), [invoice.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId]/invoice.tsx), and [job-note-composer.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/jobs/components/job-note-composer.tsx) to use the shared phrase groups instead of ad hoc inline arrays.
- Added a concrete native test script in [mobile-dictation-device-validation.md](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/mobile-dictation-device-validation.md) so the next rebuilt iOS/Android app has an exact field-by-field mic validation plan instead of a loose manual smoke test.
- Revalidated the mobile workflow after centralizing the voice context lists and kept the dependency state clean with `expo install --check`.

Follow-up:
- The remaining open step is operational rather than code: rebuild the native app and run the new device-validation script on one Android device and one iPhone.
- If any mechanic phrases consistently transcribe badly on devices, update the shared phrase lists in [dictation-context.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/voice/dictation-context.ts) rather than patching individual screens.
- If device testing shows transcript duplication or timing issues, the next code pass should tune the shared dictation control rather than the individual field integrations.

Docs touched:
- `docs/work-log.md`
- `docs/mobile-dictation-device-validation.md`

## 2026-04-05 - Dictation now covers the full estimate and invoice workspaces

What shipped:
- Extended the shared [dictation button](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/components/ui/dictation-button.tsx) into the main estimate workspace on [estimate/index.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId]/estimate/index.tsx), covering draft title/notes/terms, estimate line name/description, and sourcing notes.
- Extended the same control into the invoice workspace on [invoice.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId]/invoice.tsx), covering invoice title/notes/terms, invoice line name/description, manual payment notes, and billing handoff notes.
- Kept the dictation rollout focused on narrative fields instead of numeric fields, which means mechanics can speak the costly context while still entering precise prices, quantities, and percentages manually.
- Revalidated the mobile workflow after the broader voice rollout and kept the Expo dependency state clean with `expo install --check`.

Follow-up:
- Dictation now reaches the main field note, estimate, invoice, sourcing, and billing note surfaces. The next voice-related pass should be real-device validation and tuning of contextual phrase lists based on actual mechanic vocabulary.
- Numeric-heavy fields like unit price, amount collected, tax rate, and quantity still rely on manual entry by design. If field feedback shows those are still slow, the next improvement should be steppers/presets rather than raw voice parsing.
- This session did not run a native device rebuild, so live microphone capture on iOS/Android still depends on the next dev build or production build including the new speech-recognition plugin.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Mobile dictation is now wired into the main field typing surfaces

What shipped:
- Added `expo-speech-recognition` to the mobile app, configured its Expo plugin and permission copy in [app.json](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app.json), and verified the dependency state with `expo install --check`.
- Built a reusable [dictation button](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/components/ui/dictation-button.tsx) that starts speech recognition, appends interim/final transcript into the current field value, and handles stop/error/end state without forcing each screen to wire raw recognizer listeners.
- Wired dictation into [job-note-composer.tsx](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/jobs/components/job-note-composer.tsx) and the main stop-console sheets on [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx), covering technician notes, quick estimate line name/details, sourcing notes, and payment notes.
- Kept the existing mobile and office-to-field E2E suite green after the speech package landed, so the dictation layer did not destabilize the current field workflow.

Follow-up:
- Because this adds a native Expo plugin, the mobile app needs a fresh native rebuild before technicians can use dictation on physical devices. The web/mobile E2E suite stayed green, but this session did not verify live microphone capture on an actual iOS or Android device.
- This first dictation slice targets the highest-friction text fields on the stop and note composer. The next rollout should extend the same control to the deeper estimate and invoice workspaces if we want voice coverage everywhere billing and pricing still ask for typing.
- Speech recognition availability still depends on device settings and platform services. The reusable control already surfaces unsupported/denied states, but field rollout should include one real-device check on both iOS and Android.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Stop sheets now favor tap shortcuts over typing

What shipped:
- Added quick line-name presets, quantity chips, payment note chips, and sourcing note chips to the stop-console bottom sheets in [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx), so common field edits can be completed with taps instead of keyboard-heavy entry.
- Reused the manual-tender note pattern already proven in the full invoice flow and applied it to the stop-level quick payment sheet, which makes cash/check/other collection faster and more consistent.
- Added generic but field-relevant quick estimate line names by line type and compact quantity presets so the estimate sheet feels less like an empty form and more like a task-specific picker.
- Added quick sourcing note presets to the part-source sheet so supplier timing and return-visit context can be captured immediately without long text entry.

Follow-up:
- The stop sheets are now more tap-friendly, but they still use typed money inputs for price and collected amount. The next step could add stronger numeric preset behavior or stepper interactions if ride-along feedback shows those fields still slow mechanics down.
- The estimate line-name presets are intentionally generic. If we want them to feel sharper, the next pass should make them conditional on job type or recent repair history rather than staying static.
- At this point the stop console has compression, recovery, blocker actions, and tap shortcuts. The next high-value product move is likely voice/dictation support or more aggressive context-aware defaults rather than more structural routing work.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Stop console now recovers interrupted work and gives blocker-specific actions

What shipped:
- Added a persisted stop-console recovery helper in [stop-console-recovery.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/jobs/stop-console-recovery.ts) so the active stop can remember whether the mechanic was adding an estimate line, sourcing a part, or recording a payment.
- Wired [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx) to show a `Resume where you left off` notice when the mechanic comes back to an interrupted stop, with direct resume and dismiss actions instead of forcing them to remember which bottom sheet they were in.
- Added explicit closeout blocker cards on the stop console for incomplete inspection, estimate draft/approval issues, missing invoice, open payment, missing evidence, and stale partial snapshots, each with a one-tap action that opens the right tool immediately.
- Kept the recovery and blocker logic local to the stop route so the mechanic gets guidance right where they are already working instead of being pushed into another list or dashboard surface.

Follow-up:
- Recovery currently remembers the active stop sheet and, for part sourcing, the active line item. It does not yet restore partially typed field values after a full process kill beyond the existing in-memory form state.
- The blocker deck is intentionally pragmatic. The next refinement could collapse it into a more compact “next required actions” rail once we have real ride-along feedback on which blockers happen most often.
- The same persisted recovery pattern can now be reused for other interruption-prone field flows like evidence capture or invoice send/reminder follow-through.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Stop console estimate and payment edits now run from bottom sheets

What shipped:
- Added a reusable mobile [bottom-sheet](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/components/ui/bottom-sheet.tsx) primitive and exported it through the shared UI barrel so the stop route no longer has to stack full mini-forms directly in the page body.
- Moved quick estimate line add/edit, inline part sourcing, and quick field payment capture off the main stop surface and into dedicated bottom sheets on [job detail](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/app/(app)/jobs/[jobId].tsx), which keeps the stop readable while preserving the same field actions and offline-aware mutation paths.
- Kept the stop summary cards lightweight by replacing the old inline forms with short action prompts like `Add quick line`, `Resume source`, and `Open quick payment`, so mechanics only see the heavier input UI when they intentionally open it.
- Preserved the existing technician mobile and office-to-field E2E coverage after the interaction shift, which keeps the compressed stop route from regressing the core field workflow.

Follow-up:
- The stop now feels lighter, but the bottom sheets are still form-based rather than camera-like task flows. The next UX compression pass should make the payment and estimate sheets more shortcut-heavy and less keyboard-heavy.
- The same bottom-sheet primitive can now be reused for other stop-console actions like closeout blockers, invoice send/reminder actions, or evidence capture follow-through if we want the stop to stay even flatter.
- If we keep pushing toward the ideal field console, the next best step is interruption recovery and clearer blocker sheets, not more route proliferation.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Stop console can now source quick estimate part lines inline

What shipped:
- Added lazy stop-console part sourcing on the technician job detail route so mechanics can open a compact supplier form directly from a quick draft part line instead of bouncing into the full estimate workspace for every supplier quote.
- Reused the existing assigned-estimate sourcing load and save paths, which means the inline stop source editor still gets the same supplier-account resolution, procurement linkage, offline queueing, and optimistic estimate reload behavior as the dedicated estimate screen.
- Brought recent suppliers, saved supplier matches, availability chips, quoted cost, part number, and note capture into the stop console so the mechanic can add the actual supplier context while they are still standing at the vehicle.
- Kept the deeper estimate workspace as the fallback for richer sourcing, but made the stop console good enough for the common field case of adding a part line and immediately attaching a supplier, price, and availability.

Follow-up:
- The quick stop sourcing form is intentionally compact. It does not yet expose live retailer search or the full fitment-offer comparison inline on the stop surface.
- Quick line part-source summaries only appear after the richer estimate detail has been loaded once on the stop, because the lightweight workflow snapshot still does not carry sourcing detail by default.
- The next compression step should decide whether the stop console deserves inline line removal and inline live retailer offers, or whether the higher-value work is turning more of these forms into bottom sheets.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Stop console can now add and edit common draft estimate lines inline

What shipped:
- Added a lightweight `Quick estimate lines` section directly inside the stop console estimate card so technicians can see the first flat draft lines, jump into edit on a common line, or add a new labor/part/fee line without leaving the stop route.
- Reused the existing mobile estimate line-item mutations for add and save, so the inline stop editor still benefits from the same offline queueing and estimate reload behavior as the full estimate workspace.
- Kept grouped office-built estimate lines read-only on the stop console and called that out explicitly in the UI, which avoids the mobile inline editor colliding with the richer office-side grouping model.
- Preserved the dedicated estimate workspace as the deeper pricing surface while making the stop console good enough for the common field changes that were previously forcing unnecessary route changes.

Follow-up:
- This inline estimate editor covers common flat lines only. It still does not remove lines, edit grouped sections, or handle part sourcing inline from the same small form.
- The next estimate compression slice should combine this quick line editor with the existing parts sourcing state so mechanics can add a part line and source it without leaving the stop route.
- Billing now has lightweight inline actions and quick payment capture, while estimate now has lightweight inline lines; the next holistic stop-console pass should unify these inline controls visually so the screen feels intentional instead of incrementally expanded.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Stop console can now trigger core estimate and billing mutations directly

What shipped:
- Added direct stop-console actions to start an estimate draft, create an invoice draft, and issue a draft invoice from the technician job detail route instead of forcing a full navigation into the estimate or invoice workspace first.
- Added a lightweight `Quick field payment` section directly inside the stop console billing card so technicians can choose tender type, tap a common amount preset, and record a manual field payment without leaving the stop.
- Reused the existing mobile estimate and invoice mutation APIs instead of duplicating billing logic, so the inline stop actions still benefit from the same offline queueing, workflow automation, and post-mutation reload behavior as the dedicated estimate and invoice screens.
- Kept the regression suite green after the extra inline controls by validating the existing guided-stop and office-to-field flows against the denser stop-console layout.

Follow-up:
- The stop console can now trigger the key draft/billing mutations, but it still does not support inline estimate line editing or inline invoice line editing. Common creation and collection work can stay on the stop, while detailed pricing edits still route into the dedicated workspaces.
- The quick field payment block is intentionally light. If we keep compressing the stop, the next billing pass should turn it into a tighter drawer/sheet interaction and reduce the visible form weight on the stop itself.
- The estimate card still routes to the approval and estimate workspaces for any real pricing detail. The next estimate compression slice is embedding a small line-item add/edit surface inline for the most common field changes.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Stop console now keeps estimate and billing context inline

What shipped:
- Added inline `Estimate and approval` and `Billing and payment` summary cards directly on the technician stop console so mechanics can see approval state, estimate total, invoice number, balance due, and payment readiness without leaving the active stop.
- Wired direct next-step actions from those inline cards so the mechanic can jump straight into `Build estimate`, `Capture approval`, `Create invoice`, `Open invoice`, or `Collect payment` from the stop console instead of relying only on the generic action rail.
- Kept the existing workflow snapshot model and reused the stop snapshot data already loaded by the technician route, so this compression slice did not add another backend fetch just to render the inline summaries.
- Updated the mobile guided-stop Playwright selectors to handle the richer billing context on the stop and invoice flows without regressing the office-to-field completion path.

Follow-up:
- This is still summary-plus-jump, not true inline estimate or invoice editing. Mechanics can see the approval/billing state sooner, but they still leave the stop screen to edit pricing or billing details.
- The next real compression step is embedding lightweight estimate/billing mutation surfaces directly on the stop itself, likely as inline drawers or collapsible sections, so common edits do not require a full route change.
- The stop console now exposes more billing labels, which is why the regression suite needed tighter selectors on the invoice screen. Any future UI compression should keep test selectors explicit to avoid RN web duplicate-text noise.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Parts sourcing and field payment now use faster mobile presets

What shipped:
- Added recent-supplier reuse and quick availability shortcuts to the technician estimate sourcing flow so mechanics can reuse known suppliers, stamp common ETA states, and avoid retyping the same sourcing notes on every part line.
- Fixed the estimate sourcing opener so starting a new part source always pins the active estimate line instead of depending on an existing saved source to keep the form in context.
- Added one-tap amount presets for mobile field payments and manual-tender handoffs so mechanics can fill the full remaining balance or a half-balance partial payment without typing the amount from scratch.
- Added tender-specific note chips for manual payment and manual-tender handoffs so common cash/check field collection notes can be applied with a tap before recording the billing event.

Follow-up:
- This cuts typing, but the payment form is still a full inline section rather than the bottom-sheet tender flow called for in the upgrade plan. The next billing slice should collapse the payment interaction into a tighter sheet instead of a long form block.
- Parts sourcing is faster, but there is still no true “best price / fastest ETA / same-day” ranking control over the live retailer results themselves. The current slice speeds up manual entry and reuse rather than changing quote ranking.
- The live stop console still launches estimate and invoice into separate screens; the next major compression step is bringing more of those actions inline instead of only making the forms faster once you get there.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Camera-first evidence flow now supports short field videos

What shipped:
- Widened the shared attachment contract to support `video/mp4`, `video/quicktime`, and `video/webm`, and raised the attachment size limit from `15 MB` to `50 MB` so short diagnostic clips can upload without failing image-era validation.
- Added `0121_attachment_video_support.sql` so the `job-attachments` storage bucket now accepts those video MIME types and the larger file-size cap alongside the existing image types.
- Reworked the mobile evidence sheet so technicians can now `Take photo`, `Record video`, or `Choose media` from one camera-first panel, while keeping the selected attachment category sticky between uploads instead of resetting it after every capture.
- Updated the stop evidence gallery to label photo vs video attachments clearly and expose a direct `Play video` action for video entries instead of treating every attachment like an image preview.

Follow-up:
- This first slice focuses on capture speed and upload support, not in-app playback polish. Videos currently open from the gallery rather than rendering inline with a native player.
- Existing E2E coverage proves the evidence changes did not break the core technician and office-to-field flows, but there is still no dedicated automated test that records or uploads a real video clip.
- The new storage migration still needs to be applied to the hosted Supabase project before video uploads will work outside local code and local schema state.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Phase 1 now puts the active stop ahead of tracking and tightens the technician stop console

What shipped:
- Reworked the mobile home screen so the active assignment now appears above the daily metrics and workday tracking, with a direct `Resume current stop` / `Open next stop` CTA instead of burying the live job below location-sharing controls.
- Reframed the `My Work` queue around the active stop first, then the remaining queue, and swapped the queue metrics to field-relevant counts: active field work, ready-to-start stops, blocked stops, and completed stops.
- Tightened the technician stop detail screen into a denser stop-console layout by adding a clearer next-action notice, a compact action rail, and a shorter closeout summary that surfaces finish blockers without forcing mechanics to read a long warning wall.
- Updated the mobile guided-stop Playwright coverage so the regression suite now validates the compressed stop-console labels and still passes the technician billing/completion workflows after the copy and hierarchy changes.

Follow-up:
- This is the first compression slice, not the full single-screen stop console yet. Estimate, photos, and invoice still open their dedicated screens instead of rendering inline on the stop itself.
- The remaining biggest field friction from the audit is still media and evidence speed: photo capture exists, but video capture is still missing and the evidence flow still asks for too much repeated interaction compared with a camera-first drawer.
- Home and queue priority are corrected, but external Maps and phone handoffs still pull the mechanic out of the app, so the next field-speed pass should focus on reducing those context breaks and collapsing more stop work inline.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Expo mobile dependency drift is now aligned with SDK 55

What shipped:
- Updated the mobile Expo-managed package set in `apps/mobile/package.json` to the SDK 55-compatible versions, including the newer `expo-notifications` `55.x` line that Expo now expects instead of the older `0.32.x` package track.
- Repaired the workspace install after Windows file locks from lingering repo-local Expo/Next processes interrupted the first dependency update attempt.
- Confirmed `pnpm --filter @mobile-mechanic/mobile exec expo install --check` now reports `Dependencies are up to date`, which removes the noisy Expo startup warning from the mobile E2E stack.

Follow-up:
- `pnpm install` still reports a peer warning from `@expo/log-box` wanting a newer `@expo/dom-webview` than the one currently pulled transitively. That warning is install-time only and did not block mobile typecheck or E2E verification.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Office assignment through mobile completion now has a live cross-system E2E flow

What shipped:
- Added `apps/e2e/tests/office-to-field-flow.spec.ts` to seed a field-ready stop with accepted estimate pricing, a completed inspection, and photo evidence, then run the real office assignment/reschedule form before handing the stop to the technician app.
- The new flow proves the technician can progress the stop from `scheduled` to `completed` on mobile, including invoice draft creation, invoice issue, manual field payment capture, and the status automation that moves the job into `ready_for_payment` and then `completed`.
- Expanded the `@mobile-mechanic/e2e` `test:mobile` script so the mobile regression suite now includes the full office-to-field completion path alongside the guided-stop checks.
- Hardened `apps/e2e/playwright.config.ts` so the new cross-system spec boots the Expo web shell as part of the mobile suite instead of accidentally running as a web-only test.
- Fixed the mobile invoice issue route so status automation runs even when customer-link or Stripe checkout follow-through returns a warning, and switched the backend automation helper to a service-safe status update path instead of the office-auth RPC that was blocking field automation from server routes.

Follow-up:
- This flow validates the office assignment and technician completion chain, but it still does not prove real Expo push delivery because Playwright is running against the web shell rather than a device notification transport.
- The seeded stop intentionally starts with inspection evidence already present so the test can isolate the assignment, billing, and closeout automation path; photo capture and inspection authoring remain covered by the existing technician flows.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Pending Supabase migrations now apply cleanly on the local stack

What shipped:
- Fixed `0113_job_field_statuses.sql` so the migration no longer uses newly added enum literals directly inside function bodies in the same transaction, which was blocking all later field-workflow migrations from applying on Postgres.
- Applied the full pending local migration chain from `0113` through `0120`, covering field statuses, technician estimate drafts, manual procurement, payment handoffs, push subscriptions, manual invoice payments, and the new closeout-sync markers.
- Re-ran the shared job-status and workflow-automation tests after the local DB push to confirm the migration fix did not drift the application logic from the intended field-status model.

Follow-up:
- Remote deployment is still blocked in this shell because no Supabase access token is configured, so I could not push these migrations to the live hosted project from this session.
- The local `supabase db push --local` output is misleadingly worded as “remote database,” but it did apply against the running local stack on `127.0.0.1:54322`.
- The next operational step is to run the same migration push in an authenticated environment with `supabase login` or `SUPABASE_ACCESS_TOKEN` set.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Completion automation now respects unsynced local closeout work

What shipped:
- Added a technician closeout-sync marker flow so mobile can tell the server when a stop still has queued inspection or attachment work sitting on the device.
- Wired inspection and attachment queue changes to publish that marker immediately when possible, retry it from a tracked local registry on foreground sync, and clear it once the closeout queues drain.
- Tightened payment-driven completion automation so a stop will not auto-complete if the assigned technician still has pending local closeout sync, even if the invoice is fully paid and the persisted inspection/photo records look complete.

Follow-up:
- The new closeout-sync marker depends on the mobile app being able to reach the web app at least once after queue state changes. If the device never gets a chance to publish the marker, the server still only sees persisted artifacts.
- This marker currently tracks inspection and attachment queues only, because those are the closeout artifacts that gate completion today. If closeout later depends on other local-first artifacts, the marker payload should widen with them instead of inventing a second mechanism.
- The migration for the new sync-marker table exists in the repo but was not applied to a live database in this session.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Payment-driven completion now waits for inspection and photo closeout artifacts

What shipped:
- Tightened the shared job-workflow automation rule so a paid invoice no longer auto-completes a stop on billing state alone.
- The final `ready_for_payment -> completed` automation now requires both a completed inspection and at least one uploaded attachment, which aligns the server-side automation with the existing field-workflow closeout expectations.
- Updated the web-side automation helper to fetch inspection summary and attachment count only for the `invoice_settled` path, so the earlier approval and invoice-issue automations stay cheap while completion becomes artifact-aware.

Follow-up:
- This still does not account for refresh-failure style artifact uncertainty the way the mobile workboard does, because the server helper can only see persisted records, not whether a device is sitting on unsynced local work.
- The attachment gate is deliberately minimal at `>= 1` uploaded file. If the closeout bar should depend on category-specific evidence or richer inspection coverage, that needs a later policy pass.
- The next audit branch should decide whether the stronger remaining gap is widening automation into office-driven billing mutations, or making completion automation aware of queued offline field artifacts before it closes the stop.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Field workflow now auto-advances closeout statuses from approval and billing signals

What shipped:
- Added shared job-workflow automation rules in core so field approval and billing events now resolve a conservative next stop status from one place instead of scattering ad hoc status jumps across routes.
- Estimate approval now auto-advances `waiting_approval -> repairing`, including the direct mobile approval path and customer approval-link path, because both run through the shared estimate approval repository.
- Mobile field invoice issue now auto-advances `repairing -> ready_for_payment`, and fully settled invoice payments now auto-advance `ready_for_payment -> completed` from both the technician manual-payment route and the Stripe webhook reconciliation path.

Follow-up:
- This tranche is intentionally conservative. It does not auto-advance ambiguous states like `waiting_parts`, and it does not auto-complete a stop straight from `repairing` just because payment landed.
- Office-side invoice issuance outside the mobile field route still does not trigger the same `repairing -> ready_for_payment` automation, because that action is not always a reliable “work is done” signal.
- The next audit branch should decide whether the stronger remaining gap is widening these rules into more office-driven billing mutations, or tightening artifact-aware closeout so evidence and other missing stop file items can influence completion automation too.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Assigned-job list refreshes now seed offline stop data too

What shipped:
- Added a shared lightweight `TechnicianJobSeed` shape so technician list rows, push payloads, and mobile cache writes all use the same stop-seed contract instead of maintaining parallel ad hoc structures.
- Updated the assigned-job list repository to emit that stop seed from data it was already loading for customer, vehicle, and service location context, without adding another round-trip.
- Updated mobile job-list loads to persist those seeds into the assigned-job cache automatically, so imported or automation-created assignments can still bootstrap offline stop and estimate work as soon as the technician refreshes the queue, even if no push notification was delivered.

Follow-up:
- This still depends on one of the lightweight seed channels firing: either a delivered push or a successful assigned-job list refresh. If neither happens, the stop still has no local bootstrap context.
- The seed intentionally omits notes and status history, so it is enough for stop access and estimate bootstrap, but not enough to replace a full live detail refresh when signal returns.
- The next audit branch should decide whether the stronger remaining field blocker is broadening this same seed path into any other technician queue surfaces, or tightening automatic status/closeout progression once field work reaches payment and completion.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Assignment pushes now seed offline stop data for zero-cache estimate bootstrap

What shipped:
- Expanded technician assignment and reschedule pushes so the backend now attaches a lightweight stop seed with job, customer, vehicle, and address context instead of only sending a job ID and deep link.
- Updated the mobile push handlers to cache that stop seed into the assigned-job store on notification receipt and on notification tap before routing into the stop board.
- Reused the earlier offline estimate bootstrap path so a technician who receives an assignment push can now start the first estimate draft offline from that cached seed even if they never successfully opened the job detail on live signal first.

Follow-up:
- This still depends on the technician actually receiving the push payload. If a job is assigned while the device is offline and the push is never delivered, there is still no zero-context local seed.
- The cached push seed intentionally carries no notes or status history, so the stop board can open and estimate bootstrap can start, but richer timeline context still needs a later live detail refresh.
- The next audit branch should decide whether the stronger remaining field blocker is pushing the same lightweight seed into assignment list refreshes/import paths, or tightening automatic closeout progression once billing is done.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - The first estimate draft can now bootstrap offline from cached stop data

What shipped:
- Added an offline-first estimate creation path so a technician can start the first draft estimate from cached assigned-job detail even when no server-side estimate exists yet.
- Extended the mobile estimate queue with a `create_draft` bootstrap mutation and taught the replay pass to resolve that synthetic offline estimate ID back to the real server estimate before it replays queued draft edits, line-item mutations, and manual part-sourcing updates.
- Reused the existing estimate screen and queue messaging so offline estimate bootstrap drops straight into the same draft-editing flow instead of introducing a separate fallback UI path.

Follow-up:
- This still depends on cached assigned-job detail. If the technician has never loaded the stop at all, the first estimate draft still cannot be created from zero local context.
- The optimistic offline estimate starts empty by design, so any richer default labor/package seeding would need to happen in a later tranche and stay aligned with the server-side create path.
- The next audit branch should decide whether the stronger remaining field blocker is true zero-cache bootstrap from pushed assignment payloads, or tighter automatic closeout/status progression once estimate, invoice, and payment work complete.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - The first invoice draft can now bootstrap offline from cached estimate data

What shipped:
- Added an offline-first invoice creation path so a technician can start the first invoice draft from cached estimate data even when no server invoice exists yet.
- The mobile invoice queue now supports a `create_draft` bootstrap mutation ahead of later draft edits, and the sync pass reconciles synthetic offline estimate-derived line IDs back to the real server invoice before replaying queued line edits and removals.
- Updated the mobile invoice screen so offline invoice creation reports as a queued draft instead of a hard failure, keeping the billing flow moving even before the first invoice reaches the backend.

Follow-up:
- This still requires one successful estimate load first. If the estimate itself was never cached, the first invoice draft still cannot bootstrap offline.
- The line-ID reconciliation relies on the cached estimate copy matching the server-side invoice seed logic. If invoice creation ever changes materially on the backend, this sync mapping needs to stay aligned.
- The next audit branch should decide whether the bigger remaining field blocker is fully offline estimate bootstrap from zero cache, or broader automatic closeout/status progression once billing is complete.

Docs touched:
- `docs/work-log.md`

## 2026-04-05 - Live invoice issue and send actions now have an offline office handoff path

What shipped:
- Reworked the mobile invoice action section so cached/offline technicians no longer hit dead disabled billing buttons. The same controls now create structured office follow-through requests when live issue/send actions cannot run from the field.
- Mapped offline issue, resend-link, payment-page refresh, and payment-reminder requests onto the existing technician billing handoff model with action-specific notes, so the requests still queue offline and land in the office blocker flow instead of disappearing.
- Updated office handoff summary copy so those action-specific notes show up in rollup surfaces, making offline billing requests legible outside the invoice page instead of collapsing into generic follow-up text.

Follow-up:
- This uses the existing billing handoff model rather than a dedicated invoice-action request type, so office still resolves these through the broader billing follow-through workflow.
- Live issue/send actions remain true server-side mutations and still do not execute offline; this change only preserves the request and routes it to office explicitly.
- The next audit branch should decide whether the bigger remaining field blocker is offline-first invoice creation from zero cache, or broader closeout communication/status automation after these billing requests are resolved.

Docs touched:
- `docs/work-log.md`

## 2026-04-04 - Real payments now auto-close stale field billing handoffs

What shipped:
- Added shared helper copy for payment-driven handoff resolution so the system can explain why old technician billing handoffs were closed after a real payment landed.
- Updated the technician manual-payment route so posting a real field payment now automatically resolves any open payment handoffs on the same invoice instead of leaving stale billing follow-up behind for office.
- Updated the Stripe checkout webhook to do the same cleanup when a customer pays through the hosted invoice flow, using a system resolution path with a nullable resolver instead of faking an office user.

Follow-up:
- This auto-resolution path only runs when payment reconciliation succeeds. If a payment record is created outside these routes, it still needs the same cleanup hook.
- Resolved handoffs keep their original kind and now get an auto-resolution note, but there is still no dedicated “resolved by system” actor label in the office UI.
- The next audit branch should decide whether live invoice issue/send actions need an offline handoff path, or whether the remaining closeout gap is broader billing reconciliation reporting.

Docs touched:
- `docs/work-log.md`

## 2026-04-04 - Mobile billing mutations now queue offline

What shipped:
- Extended the mobile invoice cache with a durable mutation queue so draft invoice saves, draft line-item add/edit/remove actions, and technician-posted manual payments can all survive weak signal instead of hard failing.
- Reworked the mobile invoice billing flow to surface queued invoice edits and queued field payments explicitly, keeping live-only actions like issue/send separate from draft editing and manual payment capture that can now continue offline.
- Wired the new invoice queue into the app foreground sync loop so cached billing work flushes automatically alongside jobs, inspections, attachments, estimates, and payment handoffs when the device reconnects.

Follow-up:
- This still expects one successful invoice load before offline billing work can queue; a stop with no cached invoice cannot bootstrap the first invoice draft fully offline yet.
- The queue currently flushes mutations before invoice loads, but if a flush succeeds and the follow-up refresh fails, the cached view can still lag the server until the next successful load.
- The next audit branch should decide whether invoice issue/send actions also need an explicit offline handoff path, or whether the bigger remaining blocker is post-payment cleanup like auto-resolving older handoff records.

Docs touched:
- `docs/work-log.md`

## 2026-04-04 - Technicians can now edit invoice drafts and line items from mobile

What shipped:
- Added technician-safe mobile invoice draft mutation routes so assigned mechanics can update draft invoice metadata and add, edit, or remove draft line items directly from the phone.
- Reworked the mobile invoice screen so draft invoices no longer freeze after creation: technicians can now adjust invoice number, title, tax, discount, notes, terms, and the draft’s labor/part/fee lines before issuing the invoice.
- Tightened the billing copy so the mobile flow now clearly separates true field payments from unresolved billing handoffs instead of mixing both into one catch-all collection path.

Follow-up:
- These draft-editing controls are intentionally draft-only. Once the invoice is issued, any post-issue change still needs a separate workflow instead of silent mutation.
- Draft invoice edits do not yet queue offline the way estimate, inspection, and attachment work now does, so weak-signal billing edits remain network-dependent.
- The next audit branch should focus on offline billing mutations or on automatic cleanup of older handoff records when a real payment lands, depending on whether resilience or office follow-through is the bigger pain point in field testing.

Docs touched:
- `docs/work-log.md`

## 2026-04-04 - Technicians can now post manual cash and check payments from mobile

What shipped:
- Added a real manual payment provider path for invoices, including a new migration and shared payment model updates so cash, check, and other field-collected tenders can be recorded as first-class payment rows instead of only as billing handoffs.
- Added a technician-authenticated mobile payment route and mobile invoice action so assigned mechanics can post a manual payment directly to the invoice ledger from the field, immediately updating paid amount and balance due.
- Updated the mobile and office invoice payment logs to show field payment method and reference detail, keeping manual collections visible after they land instead of hiding them behind Stripe-only assumptions.

Follow-up:
- The new manual-payment migration still exists only in the repo and was not applied to a live database in this session.
- This records successful manual tenders directly, but it does not yet auto-resolve any older open billing handoffs that may have been left on the same invoice before the payment was posted.
- The next audit branch should focus on whether technicians also need mobile invoice line editing after draft creation, or whether the remaining priority is automatic reconciliation/closure of related handoff records when a real payment lands.

Docs touched:
- `docs/work-log.md`

## 2026-04-04 - Technicians can now create the first invoice from mobile

What shipped:
- Added a technician-safe mobile invoice creation route so assigned mechanics can create the first invoice draft for a stop without office help.
- The new mobile create flow seeds the invoice from the current estimate: accepted estimates use the existing estimate-to-invoice path, while non-accepted estimate drafts now copy their line items, notes, terms, tax rate, and discount into a new invoice draft automatically.
- Reworked the mobile invoice screen and stop workboard so missing billing now shows `Create invoice` instead of a dead-end unavailable state, keeping the field workflow moving from estimate into billing on the phone.

Follow-up:
- This first slice still expects an estimate to exist before the invoice can be created. If the technician needs a true invoice-without-estimate path, the next pass should add manual invoice line editing on mobile instead of forcing estimate-first billing.
- Technicians can now create, issue, and send the invoice/payment flow from mobile, but cash/check collection still resolves through structured handoffs rather than posting directly to the payment ledger.
- The next audit branch should focus on technician-safe manual payment reconciliation if true same-visit closeout is the priority.

Docs touched:
- `docs/work-log.md`

## 2026-04-04 - Technicians can now issue invoices and trigger customer payment flow from mobile

What shipped:
- Added a technician-safe mobile invoice action route so assigned mechanics can issue a draft invoice, refresh the live checkout page, resend the invoice link, and send a payment reminder without bouncing back to the office desks.
- Wired the mobile invoice API and invoice screen to use those actions in-app, including customer-ready billing controls for `Issue invoice`, `Prepare payment page`, `Send invoice link`, and `Send payment reminder`.
- Kept the new field actions aligned to the existing office billing model by reusing invoice status transitions, customer access-link issuance, queued invoice/payment communications, and the existing Stripe checkout-session flow instead of inventing a separate technician-only payment system.

Follow-up:
- This removes the office dependency when an invoice already exists, but a technician still cannot create the first invoice from mobile if the stop has no invoice yet.
- Payment completion still runs through the existing live checkout flow or structured handoffs; technicians are not yet posting a true manual cash/check payment directly into the invoice ledger.
- The next audit branch should cover mobile invoice creation and, if desired after that, a technician-safe manual payment reconciliation path for true in-field closeout.

Docs touched:
- `docs/work-log.md`

## 2026-04-04 - Technician push notifications now cover assignment and reschedule changes

What shipped:
- Added a technician push-subscription model, mobile registration route, and Expo push helper so the system can persist active device subscriptions per installation and safely send assignment or timing-change notifications to the currently assigned technician.
- Added mobile push registration, pending-notification routing, and response-listener handling in the technician app so assignment and reschedule pushes can land the mechanic back on the stop board instead of relying on manual refresh.
- Wired dispatch calendar edits, visits-desk owner and promise actions, single-visit assignment and edit flows, new-visit creation, workboard bulk actions, and estimate-desk owner and promise actions through the new notification helper so technician-facing assignment and schedule changes now fan out consistently across the main office mutation surfaces.

Follow-up:
- The new technician push-subscription migration still exists only in the repo and was not applied to a live database in this session.
- This tranche covers the major office-driven assignment and timing edits, but import and automation-driven changes still need to call the same helper if they should notify technicians without a human office action.
- The next audit branch should return to remaining field completion blockers, with native invoice/payment completion still the largest workflow gap after notifications.

Docs touched:
- `docs/work-log.md`

## 2026-04-04 - Office desks now capture structured field-handoff resolution outcomes

What shipped:
- Added structured office resolution metadata for technician payment handoffs, including shared types, validation, summary defaults, and a new migration that stores both the resolution disposition and any office note on the handoff record itself.
- Reworked the dispatch closeout actions so command-center, operations-rail, and intervention-deck handoff resolutions now capture an explicit office disposition and optional note instead of silently inferring a generic resolved state.
- Reworked the estimate desk and invoice workspace resolution actions to use the same validated office disposition flow, including note enforcement for `other_resolved`, so the closeout trail stays consistent across desks.

Follow-up:
- Dispatch currently applies one chosen resolution disposition across all open handoffs on the same invoice thread; if office needs per-handoff resolution inside dispatch, the next pass should drill into individual handoff rows there instead of resolving the whole invoice bundle at once.
- The new SQL migration for handoff resolution metadata still exists only in the repo and was not applied to a live database in this session.
- The next audit branch should move back to the field side: push assignment/reschedule notifications are still a major mechanic workflow blocker.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Dispatch and estimates can now resolve field billing handoffs directly

What shipped:
- Added a shared helper for resolving all open technician payment handoffs tied to an invoice so office desks can clear field billing outcomes without duplicating invoice-page-only logic.
- Extended the existing dispatch intervention API and command-center callbacks with a `resolve_closeout_handoff` path, then wired the dispatch closeout cards and deck actions to use `Resolve handoff` when the closeout problem is a technician field handoff rather than just a reminder-eligible balance.
- Added a direct server action on the estimate desk drawer so operators can resolve open field billing handoffs from the estimate workflow itself instead of leaving the desk for the invoice workspace.

Follow-up:
- These desks can now resolve handoffs directly, but they still do not support richer office dispositions like partial reconciliation notes or reassignment to a billing owner from the same surface.
- Batch closeout actions in dispatch still focus on reminder queueing; the next pass should decide whether a batch handoff-resolution action belongs in that lane as well.
- The SQL migration for technician payment handoffs still exists only in the repo and was not applied to a live database in this session.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Dispatch and estimates desks now show field-handoff detail inline

What shipped:
- Extended the shared dispatch closeout-risk item shape and blocker summaries so dispatch can show technician billing handoff labels and copy instead of generic money-thread language.
- Updated the dispatch command center, operations rail, and intervention deck so closeout cards now surface field handoff detail and switch their primary office action copy from generic file work to handoff review when appropriate.
- Updated the estimate desk roster and estimate drawer so finance blockers now show the actual field handoff summary inline, including drawer badges, blocker notes, and `Review field handoff` actions.

Follow-up:
- The richer handoff summary is now visible across the major office desks, but some intervention actions still only queue reminders; they do not branch into handoff-specific office workflows yet.
- If the team wants full handoff triage from dispatch or estimates, the next pass should let those desks resolve or reassign handoffs directly instead of always linking back to the invoice workspace.
- The SQL migration for technician payment handoffs still exists only in the repo and was not applied to a live database in this session.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Office rollups now show field-handoff detail, not just blocker counts

What shipped:
- Added shared handoff-summary formatting so office surfaces can describe the lead technician billing handoff by kind instead of reducing it to a generic finance-blocked count.
- Updated the owner dashboard finance queue to show field-handoff labels and copy inline, with direct `Review field handoff` actions when that is the real closeout blocker.
- Updated the fleet, customer, and supply rollups so their top blocker copy now carries the actual field billing handoff summary instead of generic “finance follow-through” language.

Follow-up:
- Broader queue rows now expose the lead handoff summary, but they still do not show the full handoff timeline or resolution state; deeper billing triage still belongs in the invoice workspace.
- Dispatch and estimates now carry the richer handoff summary in their blocker model, but they are not yet rendering that detail in dedicated row UI.
- The SQL migration for technician payment handoffs still exists only in the repo and was not applied to a live database in this session.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Office rollups now count technician payment handoffs as blocker work

What shipped:
- Extended the shared workspace-blocker summary so unresolved technician payment handoffs count as finance blockers alongside the older open-balance exception model.
- Wired the same handoff-by-job signal into the owner dashboard, fleet workspace, customer registry/workspace, dispatch desk, estimates desk, and supply desk so blocker counts no longer drift between office surfaces.
- Updated the owner dashboard and customer workspace copy so the top-level closeout signal can explicitly point office users at field billing handoffs instead of implying every finance blocker is a standard unpaid invoice thread.

Follow-up:
- Several desks now count the handoffs correctly, but most queue rows still do not show handoff kind or tender detail inline; deeper triage still requires opening the invoice workspace.
- The blocker summary treats handoffs as finance pressure, not a separate ownership lane. If the team wants a more explicit office workflow, the next pass should add a dedicated field-handoff card or lane in the broader dashboards.
- The SQL migration for technician payment handoffs still exists only in the repo and was not applied to a live database in this session.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Finance and visits desks now surface technician payment handoffs

What shipped:
- Extended the shared collections model so unresolved technician payment handoffs become a first-class finance stage instead of hiding behind invoice-detail-only review.
- Reworked the finance desk queue, stage filter, priority action, and selected-file context so open field handoffs sort, label, and route like real blocker work.
- Reworked the visits desk billing-follow-up scope and blocker metrics so jobs with unresolved technician payment handoffs now show up even when they do not fit the older completed-and-unpaid shortcut.

Follow-up:
- Other office surfaces still do not summarize field handoffs yet, so finance and visits are now aligned but downstream dashboards may still show the older closeout picture.
- The handoff signal is currently count-based; if the team wants deeper desk triage, the next pass should expose handoff kind and tender details directly inside queue rows.
- The SQL migration for technician payment handoffs still exists only in the repo and was not applied to a live database in this session.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Office invoice workspace can now review and resolve technician payment handoffs

What shipped:
- Added a shared office helper for listing and resolving technician payment handoffs so the new billing-handoff records do not stay trapped behind the mobile API route only.
- Reworked the office visit invoice workspace to surface technician billing handoffs in the main billing page, fold them into the activity rail counts, and show a full review/resolution section inside the existing billing activity drawer.
- Added office-side resolve actions so billing or dispatch can clear open field handoffs from the invoice workspace once the follow-up is handled.

Follow-up:
- Finance and visits queue surfaces still do not summarize open payment handoffs, so the office currently discovers them from the invoice workspace rather than from a broader blocker desk.
- Handoff resolution is binary right now; if the team wants a stronger audit trail, the next pass should add a structured office resolution note or disposition reason.
- The SQL migration for technician payment handoffs still exists only in the repo and was not applied to a live database in this session.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Structured technician payment handoffs landed for mobile billing

What shipped:
- Added a dedicated technician payment-handoff model and migration so field billing outcomes like `follow_up_required`, `resend_link`, `promised_to_pay_later`, and `manual_tender` are no longer trapped inside generic technician notes.
- Added a mobile-authenticated web route for listing and creating assigned-stop invoice handoffs, with narrow validation and service-side assignment checks before any record is written.
- Reworked the mobile invoice flow so technicians can record structured payment handoffs, see the handoff timeline on the invoice screen, and queue those handoffs offline for later sync just like the rest of the field workflow.

Follow-up:
- Office surfaces still need a first-class review and resolution UI for these handoffs so dispatch/billing teams can clear them without resorting to database access or note parsing.
- Real manual payment capture is still separate from this work; these handoffs structure billing outcomes, but they do not yet reconcile invoices or create ledger payments for cash/check collection.
- The new SQL migration exists in the repo only and was not applied to a live database in this session, so the handoff route will require deployment before it works outside local code.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Billing review and payment handoff now survive weak signal on mobile

What shipped:
- Added a persisted assigned-invoice cache so the technician invoice screen can fall back to the last synced invoice detail when live billing fetches fail instead of dropping the mechanic into an empty state.
- Wired the stop workboard invoice snapshot through the same cache so billing status, balance due, and invoice presence do not disappear from the field flow just because the live invoice request failed.
- Added invoice-screen payment handoff actions that create technician notes through the existing offline queue, so mechanics can leave one-tap or custom billing follow-up context for the office even when they cannot finish payment online.

Follow-up:
- This still does not create real offline payment records because the current backend only grants technicians read access on invoices and payments; true field payment capture still needs a wider permission model or a dedicated service route.
- If the team wants stronger closeout support, the next billing tranche should add a technician-safe manual payment/handoff model instead of relying on notes for cash, check, or deferred customer promises.
- Payment-link generation and Stripe checkout remain online-only, so the app still needs push/status guidance when a live payment page is required but unavailable.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Queued photo uploads now stage files into app-owned storage

What shipped:
- Hardened the mobile attachment queue so photo uploads that fall offline are first copied into an app-owned staging directory instead of relying on the original picker URI staying readable across reconnects, app restarts, or cleanup by the OS.
- Updated queued-upload flush behavior to upload from the staged file copy and delete staged files after a successful sync so the queue is more durable without leaking storage forever.
- Kept the optimistic gallery behavior unchanged for technicians, but the queued preview now points at the staged file path when available so offline evidence stays visible while the upload waits.

Follow-up:
- Add staged-file cleanup for abandoned queue entries if we ever introduce manual queue cancellation or attachment deletion before sync.
- Extend the same staging approach to future video capture if field evidence expands beyond images.
- The billing and payment parts of the field workflow still need the same offline hardening before the full day is network-resilient.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Job, inspection, and photo flows now queue through disconnects

What shipped:
- Added persisted mobile caches and mutation queues for technician job detail, inspection detail, and attachment galleries so the app can keep showing the field record even when Supabase requests fail.
- Reworked technician job status changes, technician notes, inspection item saves, inspection completion, and photo uploads to fall back to optimistic local updates plus device-side queues instead of hard failing the mechanic out of the flow.
- Wired foreground auto-sync into the mobile session provider and updated the stop, inspection, and photos screens so queued work is called out explicitly with offline warnings and queued badges.

Follow-up:
- Workflow snapshots on the stop workboard still depend on live fetches, so some derived counts can lag behind queued offline changes until the app reconnects.
- Attachment queueing currently relies on the captured device URI remaining readable long enough for a later upload; if we want stronger guarantees, the app should copy queued files into an app-owned staging directory.
- The same queue pattern still needs to reach invoice/billing actions before the full field workflow is truly network-resilient.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Estimate and parts actions now survive mobile disconnects

What shipped:
- Added a persisted assigned-estimate cache plus a device-side mutation queue so existing draft estimate edits, line-item changes, and part-source selections stay visible in the mobile flow even when the network drops.
- Reworked the technician estimate API layer to flush queued mutations before normal loads, fall back to cached estimate detail when Supabase is unreachable, and sync queued estimate work automatically when the app comes back to the foreground.
- Updated the estimate screen so queued work is called out explicitly with warning badges and notices instead of pretending disconnected edits were already saved upstream.

Follow-up:
- This first offline slice covers existing estimate work; fully offline creation of a brand-new estimate from a stop with no server-side estimate still needs a stronger temp-ID and server-reconciliation model.
- Extend the same queue/cache pattern into inspections, notes, status updates, attachments, and billing so the rest of the field workflow stops depending on stable connectivity.
- Decide whether queued estimate mutations need expiration/conflict handling when office users edit the same estimate before the mobile queue flushes.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Mobile fitment catalog and live retailer sourcing landed in the estimate flow

What shipped:
- Moved the seeded fitment catalog resolver into shared core code so web and mobile use the same vehicle-aware part suggestions instead of drifting between two separate catalogs.
- Added a mobile-authenticated web route for live retailer lookup that accepts the technician's Supabase bearer token, verifies assigned-stop access, and runs the existing O'Reilly search on the server without exposing office-only cookies or Playwright logic inside the Expo app.
- Reworked the mobile estimate sourcing section so selected part lines now show fitment-catalog picks, live retailer search/apply, and the existing manual supplier form in one screen.

Follow-up:
- Decide whether live retailer lookup should expand beyond O'Reilly and whether those provider labels need richer ETA/store-location detail before field rollout.
- Queue live retailer searches and selected-offer mutations for weak-signal conditions if we want the sourcing flow to remain reliable offline or on unstable connections.
- Set `EXPO_PUBLIC_WEB_APP_URL` for the mobile build and deploy the web route before expecting live retailer sourcing to work outside local development.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Technician manual parts sourcing opened inside the mobile estimate flow

What shipped:
- Added a technician-safe procurement migration so assigned technicians can read suppliers and create draft-only estimate sourcing records across part requests, request lines, carts, and manual cart lines without opening the entire office procurement surface.
- Extended the mobile estimate data layer so assigned estimate loads now include supplier options plus selected manual source state per part line, and added a technician mutation path that links estimate part lines to supplier pricing and availability.
- Reworked the mobile estimate screen so draft part lines now expose inline `Source part` actions, a manual supplier picker/creator, quoted pricing capture, availability notes, and selected-source summaries without leaving the estimate builder.

Follow-up:
- Add live retailer and fitment-catalog sourcing from mobile so the mechanic is not limited to manual supplier entry.
- Decide whether the sourcing flow should auto-suggest `waiting_parts` status changes when availability implies the stop cannot continue.
- Apply the new SQL migration in live environments before expecting the mobile sourcing flow to work outside local development.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Technician draft estimate builder opened on mobile

What shipped:
- Added a technician-safe estimate draft mutation path by introducing a new SQL migration that allows assigned technicians to create and edit draft estimates plus flat draft line items directly from the mobile app while keeping sent and terminal estimate control with the office workflow.
- Reworked the mobile estimate route so the old dead-end `no estimate yet` state becomes a draft-start flow, with inline draft details, quick labor/part/fee line editing, grouped-line read-only handling, and live total recalculation after each mutation.
- Tightened the stop workboard estimate quick action so missing pricing now reads as a primary `Build estimate` move instead of a generic summary link.

Follow-up:
- Promote section-aware estimate editing and sourcing actions into mobile so grouped/package lines stop being read-only in the field.
- Decide whether technicians should eventually be able to send draft estimates for approval directly or whether that release step should stay office-owned.
- Apply the new SQL migration in live environments before expecting the mobile draft editor to work outside local development.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Estimates desk helpers and Shopmonkey import lifecycle aligned to the field-status model

What shipped:
- Extracted the estimates desk bulk-action and follow-through readiness rules into a shared helper module so live-dispatch semantics for scheduled, travel, on-site, and payment-ready visits are testable outside the page component.
- Added focused regression coverage for approved-release gating, already-on-board detection, dispatch-update routing, and on-board status risk ranking across the widened field-status model.
- Added a Shopmonkey import lifecycle helper and switched imported authorized active jobs from the legacy `in_progress` state to `repairing`, while keeping imported completed and canceled work mapped consistently.

Follow-up:
- The remaining status-model work is no longer in core office workflow logic; it is mostly intentional grouped copy/action mappings and any future data backfill or migration execution against live environments.
- If we continue from here, the next real operational step is applying the SQL migration in a live environment and backfilling any existing jobs that still sit in legacy field states where the business wants stronger normalization.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Visits index, estimates desk, customer workspace, and supply detail pages widened to active field work

What shipped:
- Updated the visits queue, estimates desk release/follow-through logic, and customer workspace route confidence so active field statuses now behave as `live` work across office list and thread-level surfaces.
- Updated supply detail pages for requests, carts, and purchase orders so service-site thread continuity treats scheduled and active field visits consistently instead of only recognizing `dispatched` and `in_progress`.
- Updated dispatch visit event tone mapping so travel and on-site field states render with the correct live-work emphasis instead of falling back to pre-migration status colors.

Follow-up:
- The remaining direct matches are mostly intentional grouped status copy or action-label mappings in shared helpers and dashboard summaries, plus a couple of onboarding/import paths that are not part of the day-to-day field workflow.
- If we want to finish the status-model migration completely, the next pass should target those onboarding/import surfaces and add regression tests for the estimates desk live-update semantics.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Visit detail and customer-link surfaces aligned to active field statuses

What shipped:
- Updated customer document visibility, service-history milestone labeling, and the visit workspace shell so scheduled and active field visits no longer collapse back to the legacy `dispatched` / `in_progress` pair.
- Updated visit detail subpages for inspection, photos, estimate, parts, inventory, and edit flows so service-site thread continuity uses shared active-field status helpers when deciding whether a visit is still live.
- Tightened customer-facing “Meet Your Mechanic” eligibility copy so public visit links describe the widened field workflow accurately instead of naming stale status labels.

Follow-up:
- Sweep the remaining list and workspace surfaces outside this tranche, especially the main visits index, estimates dashboard, customer workspace shell, dispatch event badges, and parts request/cart/purchase-order pages that still hard-code legacy live-state assumptions.
- Add focused regression coverage for service-history milestone labeling and customer document visit visibility now that those rules use shared field-status helpers.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Shared follow-through and intervention helpers aligned to active field statuses

What shipped:
- Updated shared dispatch follow-through, release-runway continuity, and service-thread helpers so active field work is no longer modeled as only `dispatched` and `in_progress`.
- Updated the internal dispatch intervention route so promise-risk updates and defer gating use shared travel/on-site status helpers instead of stale one-off status checks.
- Added focused tests around follow-through weighting and continuity placement/route semantics for blocked on-site states like `waiting_approval` and `waiting_parts`.

Follow-up:
- Sweep the remaining internal/job detail routes and customer-thread surfaces that still rely on legacy live-state assumptions where they affect copy, filtering, or automation prompts.
- Add a broader regression suite around the end-to-end field-status model once the remaining detail routes are migrated.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Dispatch command surfaces widened to active field work

What shipped:
- Updated dispatch command center, operations rail, calendar grid, month view, command deck, and dispatch page summaries so lane pressure, promise risk, reroute/defer gating, and live-lane selection all understand the widened field-status model.
- Replaced the old `dispatched` / `in_progress` live-work checks in the dispatch control plane with shared `active field` and `on-site` helpers so travel, arrival, diagnosis, approval waits, parts waits, repair, and payment-ready stops stay visible in board-level dispatch decisions.
- Removed a stale month-view `confirmed` branch that no longer exists in the shared job-status model.

Follow-up:
- Sweep the remaining dispatch-adjacent helpers outside this tranche, especially follow-through/service-thread/customer-thread utilities and any API/internal routes that still encode the old live-state pair.
- Add focused tests around the dispatch command center and rail sorting logic now that active field work is no longer a two-status model.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Visits, finance, automation, and fleet office surfaces widened to the field-status model

What shipped:
- Updated the visits workboard lane metrics and drag guidance so `live` work counts all active field statuses instead of only `dispatched` and `in_progress`.
- Updated finance continuity and service-site thread logic so route confidence, live GPS assumptions, and active-visit counts understand the widened field workflow.
- Updated communications automation and fleet workspace helpers so travel-triggered automations, current-stop detection, late-stop logic, and on-job technician status all work with the new travel and on-site state groups.
- Updated the dispatch quick-edit panel so dispatch can explicitly set the new field statuses and lane-fit logic treats any active field stop as live work.

Follow-up:
- Sweep the remaining large dispatch surfaces such as command center, operations rail, calendar grid, and month view, which still have direct `dispatched` / `in_progress` assumptions.
- Sweep remaining visit, finance, and customer-thread helpers that still hard-code the legacy live-state pair in list/detail pages outside the workboard tranche.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Office dashboard and dispatch surfaces now understand active field statuses

What shipped:
- Added shared technician status helpers that separate `upcoming`, `travel`, `on-site`, `mobile live`, and `active field` work so office surfaces can treat `dispatched`, `en_route`, `arrived`, `diagnosing`, `waiting_approval`, `waiting_parts`, `repairing`, and `ready_for_payment` consistently.
- Updated the office workflow board logic, dashboard brief, operational health summaries, and dispatch calendar signals so travel, on-site blockers, and payment-ready stops stop collapsing into the old `dispatched` versus `in_progress` split.
- Added focused tests around the new helper semantics and office workflow moves so the widened field-state model stays coherent across the mobile and web surfaces already touched.

Follow-up:
- Sweep the remaining office surfaces that still hard-code `dispatched` and `in_progress`, especially visits workspace, finance, dispatch quick-edit, service-thread, communications automation, and fleet workspace helpers.
- Add office actions for the new blocked states so dispatch can actively resolve `waiting_approval`, `waiting_parts`, and `ready_for_payment` instead of only seeing labels.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Persisted field-status model widened for technician workflow

What shipped:
- Added the new persisted job states `en_route`, `arrived`, `diagnosing`, `waiting_approval`, `waiting_parts`, `repairing`, and `ready_for_payment` to the shared job model, validation layer, generated database types, and technician status-action labels.
- Added a schema migration that widens `public.job_status` and updates both office and assigned-technician transition functions so the new technician path can persist safely instead of staying UI-only.
- Updated mobile queue summaries, featured-stop selection, the technician workboard, and the customer visit document copy so the new field statuses behave coherently in the current mobile surfaces.

Follow-up:
- Sweep the office dashboard and dispatch surfaces so every place that still keys only off `dispatched` and `in_progress` treats the new field states as live work too.
- Add parts-native mobile surfaces so `waiting_parts` stops have a first-class field workflow instead of only status tracking.

Docs touched:
- `docs/work-log.md`

## 2026-04-03 - Mobile field workflow backlog and technician stop workboard

What shipped:
- Added a build-ready mobile field workflow backlog that turns the mechanic audit into epics for field status modeling, stop-workboard compression, mobile estimate and parts completion, billing closeout, push alerts, and offline safety.
- Hardened the shared field-stage helper in `packages/core` so unreleased, canceled, draft-estimate, declined-estimate, and void-estimate states stop falling through into misleading later-stage guidance.
- Reworked the mobile technician stop detail into a denser field workboard so the current stage, next action, route/contact tools, inspection, estimate, photos, invoice, and closeout blockers sit near the top of one mobile screen instead of across multiple stacked sections.

Follow-up:
- Finish the real persisted field-status migration across the database enum, API transitions, dispatch history, and customer communications triggers.
- Add mobile estimate creation, parts sourcing, invoice issue, and in-app payment capture so the workboard can become a true end-to-end field operating surface.
- Add offline mutation queueing for technician status changes, notes, inspections, attachments, approvals, and billing events instead of relying on location-only queueing.

Docs touched:
- `docs/mobile-field-workflow-backlog.md`
- `docs/work-log.md`

## 2026-03-26 - Workboard collections, queue rail, and workflow helpers tightened again

- Continued the canonical Visits workboard cleanup by renaming more collection helpers, loop variables, and drop-guidance inputs from Jobs-first to Visits-first wording across the active board and queue render paths.
- Flipped the Dispatch unassigned queue rail deeper into Visits-first semantics by renaming the queue item boundary and the panel's internal backlog, intake, and section collection locals while preserving the external component contract.
- Tightened the shared workflow helper internals in `apps/web/lib/jobs/workflow.ts` so its state, move-assessment, queue-state, and counting helpers now read in Visits-first terms while leaving the existing compatibility aliases intact.
- Caught and fixed a live validation regression in the Visits workboard where stale follow-up urgency was passing `job: visit` instead of `title: visit.title`, then revalidated fresh Dispatch and Visits loads on the 3000 app.

## 2026-03-26 - Visits-first renderer semantics tightened again

- Renamed the Dispatch quick-edit lane recommendation copy inputs off `hasLiveJob`, `nextJobTitle`, and `previousJobTitle` into Visits-first local names while intentionally leaving the underlying recommendation payload contract untouched.
- Continued the canonical Visits workboard cleanup by pushing Visits-first naming through the main queue-row renderer, quick-note handler, card renderer, and several helper inputs such as dispatch-link, schedule-urgency, operational-urgency, move-plan, and moved-visit visibility helpers.
- Fixed a transient malformed trust-summary block introduced during the rename pass, then revalidated static errors and fresh `/dashboard/dispatch` and `/dashboard/visits` page loads on the 3000 app.

## 2026-03-26 - Quick-edit local aliasing and workboard move helpers tightened again

- Removed the semantic-rename artifact in the Dispatch quick-edit drawer so the selected record now cleanly enters the component as `visit`, then propagated that local alias through the drawer internals without changing the existing API payload keys.
- Tightened the canonical Visits workboard move-flow helpers again by renaming the active move function and its immediate derived locals toward Visits-first wording, while preserving `jobId` request payload fields for compatibility with the current backend endpoints.
- Revalidated both `/dashboard/dispatch` and `/dashboard/visits` after the pass and kept file error checks clean across the quick-edit panel, command center, and canonical workboard.

## 2026-03-26 - Dispatch quick-edit and Visits workboard state pushed further into Visits-first naming

- Renamed the Dispatch quick-edit drawer's external `job` prop boundary to `visit` and updated the command-center handoff, while also flipping the local snapshot type to `DispatchVisitSnapshot` so the selected-visit drawer reads more cleanly at the component boundary.
- Renamed the canonical Visits workboard's hot state locals off `draggedJobId`, `pendingJobIds`, `selectedJobIds`, `activeNoteJobId`, and `savingNoteJobId`, then aligned the highest-traffic handlers and derived locals to Visits-first names without changing the underlying API payload keys.
- Revalidated the canonical `/dashboard/visits` queue after the workboard state cleanup and kept file error checks clean across the workboard, quick-edit panel, and dispatch command center.

## 2026-03-26 - Visits detail threads flipped to Visits-first local helper names

- Aliased the active visit detail, invoice, estimate, and estimate-workspace routes onto Visits-first local helper names like `getVisitById`, `getEstimateByVisitId`, `getInvoiceByVisitId`, and `listVisitCommunications` so those hot visit threads no longer read through Jobs-era helper names in their route implementations.
- Renamed the remaining `latestJob` and `latestJobResult` locals inside the visit detail and estimate-workspace server actions to `latestVisit` and `latestVisitResult`, and aligned the visit access-link helpers to local Visits-first names in the main visit record route.
- Revalidated live visit detail, invoice, and estimate routes for a real visit record on the 3000 app after the alias pass, confirming the detail-thread surfaces still render cleanly.

## 2026-03-26 - Dispatch child component boundaries flipped to Visits-first naming

- Renamed the remaining Dispatch child component prop interfaces from Jobs-first to Visits-first across the queue drawer, conflict panel, week calendar, month calendar, operations rail, and day grid so the command center no longer hands its selected visit state into legacy-named hot-path boundaries.
- Finished the last day-grid local cleanup by replacing stale drag, selection, pending-mutation, move, and resize locals with Visits-first names inside `dispatch-calendar-grid`, while intentionally leaving shared type names like `MoveDispatchJobInput` alone for safety.
- Revalidated the live `/dashboard/dispatch` route after a full reload and confirmed the refreshed command center renders cleanly with no remaining targeted Jobs-era prop names in `apps/web/app/dashboard/dispatch/_components`.

## 2026-03-26 - Visits workboard ownership moved off Jobs-era module names

## 2026-03-26 - Dispatch command-center state and Visits action locals converged

- Renamed the Dispatch command-center state layer off `selectedJobId`, `draggingJobId`, and `pendingJobIds` so the active state, derived selected visit locals, and calendar handoff now read in Visits-first terms below the calendar boundary too.
- Finished the remaining Visits server-action local cleanup by renaming repeated `latestJobResult` and `latestJob` variables to `latestVisitResult` and `latestVisit` across the schedule, status, communications, estimate, and invoice action flows.
- Revalidated the live `/dashboard/dispatch` and `/dashboard/visits` routes after the state-layer and server-action cleanup so the naming pass ends with both active desks still rendering cleanly.

## 2026-03-26 - Main Visits shell helpers flipped to Visits-first local naming

- Renamed the main Visits page's highest-traffic helper imports into local Visits-first aliases so the active shell now calls `getVisitById`, `listVisitsByCompany`, `assignVisitTechnician`, `changeVisitStatus`, `createVisitNote`, and matching visit document helpers without changing the shared package exports yet.
- Renamed the selected visit and communications locals inside the main Visits page so the detail rail and queue assembly no longer revolve around `selectedJobRecord`, `selectedJobVisitLinkSummary`, or `jobCommunicationsResult` in the hot route implementation.
- Fixed the one rename-tool parse regression in the communications map expansion and aligned the Visits workboard prop handoff to `initialVisitCommunications`, then revalidated the live `/dashboard/visits` route.

## 2026-03-26 - Visits queue helpers and Dispatch calendar props tightened again

- Flipped the remaining main Visits page `listJob*` and attachments helpers into local Visits-first aliases so the active queue assembly now reads through `listVisitCommunications`, `listVisitInventoryIssuesById`, `listVisitNotesById`, `listVisitStatusHistory`, and `listVisitAttachments` without changing shared package exports.
- Renamed the active selected-visit workspace variable from `selectedJob` to `selectedVisit` across the main Visits page so the queue/detail handoff no longer reads like a legacy Jobs record in the highest-traffic shell.
- Renamed the live Dispatch calendar surface props from `selectedJobId`, `onOpenJob`, `onJobClick`, `onJobDragStart`, `onJobDragEnd`, `onMoveJob`, `onResizeJob`, `draggingJobId`, and `pendingJobIds` into Visits-first local names across the week, month, grid, and command-center handoff, then revalidated Dispatch and Visits with clean file errors.

- Copied the active Visits workboard implementation into a canonical `visits-workboard` module so the live Visits page no longer imports its primary board from a Jobs-named file.
- Reduced the old `jobs-workboard` module to a compatibility re-export, preserving any stale internal imports without leaving Jobs-era naming on the hot route path.
- Tightened the canonical workboard's remaining high-traffic type and helper names from `JobCardDensity`, `WorkboardViewMode`, and `getJobCardDensity` to Visits-first naming so the main board implementation aligns better with the product model.

## 2026-03-26 - Dispatch hot-path signals and event card flipped to Visits-first names

- Added Visits-native Dispatch signal exports so the week calendar, grid, operations rail, and quick-edit panel can call `getDispatchVisit*` helpers without breaking older imports that still expect `getDispatchJob*` names.
- Copied the active dispatch event card into a canonical `dispatch-visit-event` module and reduced `dispatch-job-event` to a compatibility re-export so the main calendar grid no longer imports its core event component from a Jobs-named file.
- Kept the shared package-level `DispatchCalendarJobEvent` types intact for behavior safety while reducing more Jobs-era naming from the live Dispatch rendering path.

## 2026-03-26 - Control-desk framing and fleet compatibility routing tightened

- Promoted Reports and Settings out of the generic linked-desk eyebrow so the shared shell now identifies them as control desks without collapsing them into the primary operating lanes.
- Tightened the Fleet compatibility entries so legacy fleet routes preserve incoming filter state and technician-specific deep links now land in Fleet's team lens instead of the generic unit lens.
- Kept the canonical Fleet workspace route as the only real owner while reducing more route-tree drift between legacy entrypoints and the desk model.

## 2026-03-26 - Supply compatibility wrappers preserve canonical desk state

- Updated the remaining thin Parts and Inventory compatibility entrypoints so they carry incoming query state through to the canonical Supply routes instead of dropping operators onto stripped-down URLs.
- Aligned the admin shell's internal command-tier naming with the control-desk model so Reports and Settings no longer read like leftover utilities in code or runtime labels.
- Kept Finance on its canonical wrapper path while removing another layer of route-tree drift from the Supply ownership handoff.

## 2026-03-26 - Secondary desk shell hierarchy tightened

- Promoted Supply and Finance out of the generic linked-desk eyebrow so the shared shell now identifies them as operations desks instead of treating them like loose attachments to the operating model.
- Reframed the generic shell fallback from Linked Desk to Connected Desk so non-primary secondary surfaces no longer read as second-class leftovers.
- Left Estimates intentionally framed as a support desk so approval follow-through still reads as a linked support surface rather than a primary command lane.

## 2026-03-26 - Navigation chrome stops demoting reports and settings

- Renamed the left navigation bucket for Reports and Settings from "Secondary" to "Control desks" so those routes no longer read like leftovers.
- Tightened the Reports and Settings nav hints to match the operating-system framing already applied inside those pages.
- Updated the command palette divider and badges so those routes surface as control desks rather than generic utilities.

## 2026-03-26 - Reports and settings reframed as operational desks

- Tightened Reports into an operating signal desk so throughput, approval conversion, and revenue drag read as live operational signal instead of passive reporting.
- Reframed Settings as operating system setup so dispatch control, supply providers, communications, migration control, and inventory network read like configuration tied to real desks.
- Preserved the existing route structure and data logic while bringing the last generic utility-page copy into the same V3 operating model as the rest of the office shell.

## 2026-03-26 - Secondary desk language and shell chrome tightened

- Sharpened the deeper Supply lane headings so sourcing intake, unblock work, ordering handoff, provider readiness, and repeatable stock kits read like operating responsibilities instead of generic categories.
- Tightened the Finance detail rail so the selected invoice thread now frames closeout next moves, ownership, collection state, service-thread continuity, return-work recovery, collection actions, and payment activity more explicitly.
- Removed the remaining shared shell drift around "Supporting Workspace" and "Secondary Workspace" by reframing the admin context bar around primary desks, detail threads, and linked desks.

## 2026-03-26 - Supply, Finance, and customer support-rail framing tightened

- Reframed Supply as an unblock desk with clearer language around sourcing ownership, readiness pressure, and blocked service threads instead of a neutral parts registry.
- Reframed Finance as a revenue closeout desk with stronger closeout-control language in the hero and command deck while keeping the existing collection mechanics intact.
- Tightened the Customers inspector into a thread-support rail so quick actions, address control, readiness gaps, and lifecycle actions all reinforce the active relationship-thread model.

## 2026-03-26 - Fleet readiness and customer-thread framing tightened

- Reframed Fleet away from passive asset monitoring and toward readiness-and-capacity control so the desk now speaks in terms of lane health, same-day insertion confidence, and recovery ownership.
- Tightened the main Customers workspace copy below the hero so the desk consistently reads as an active relationship thread, including the vehicle region, relationship history, and timeline areas.
- Adjusted compact Today Brief ordering so collections surfaces ahead of readiness on narrower layouts, keeping money follow-through above lower-priority support content once the desktop side rail collapses.

## 2026-03-26 - Today Brief and Visits workspace triage tightened

- Reworked the Today Brief wording and section order so carryover recovery leads the workspace, the command strip reads like immediate intervention priority, and release, dispatch, readiness, and collections panels speak more clearly in visit-first operational language.
- Consolidated the selected-visit lower rail production controls into one section for assignment, promise control, and the next workflow move, while tightening follow-up, thread, customer-link, and history section language so the drawer feels more like one operating thread than a stack of admin cards.
- Reframed the Customers hero and command band around relationship control and next-move ownership so the desk reads less like a registry and more like an active customer-thread workspace.

## 2026-03-25 - Jobs compatibility tree reduced to wrappers

- Deleted the unreferenced Jobs-side route-local component files that became dead once Visits took ownership of the real dashboard page implementations.
- Switched the Stripe office checkout fallback and recovery redirects from `/dashboard/jobs/*` invoice URLs to the canonical `/dashboard/visits/*` invoice URLs.
- Kept the legacy Jobs estimate-edit redirect in place because it still bridges an old compatibility entrypoint into the Visits estimate workspace.

## 2026-03-25 - Visits routes now own the page implementations

- Copied the active Jobs page implementations and their local route components into the mirrored Visits route tree so `/dashboard/visits/*` now contains the real page code instead of thin wrappers.
- Collapsed the mirrored Jobs pages into compatibility re-exports so the legacy route tree no longer owns the runtime page implementations.
- Removed the last shell and navigation runtime checks for `/dashboard/jobs*`, leaving the Next redirect layer as the only Jobs compatibility surface the operator should still encounter.

## 2026-03-25 - Visits workflow ownership finished at the type layer

- Flipped the remaining shared workflow constants and move-plan types so Visits now owns the primary exported state array and workflow move types instead of only the helper functions.
- Updated the dispatch helper tests to use Visits paths in their invalid return targets so the remaining test fixtures no longer model Jobs as the canonical non-dispatch workspace.
- Left the legacy Jobs aliases in place for compatibility while eliminating another thin layer of Jobs-first framing from the shared workflow module.

## 2026-03-25 - Visits ownership pushed below the UI layer

- Inverted the shared workflow module so Visits now owns the primary workflow states, actions, and move-assessment exports while the old Jobs helpers remain as compatibility aliases.
- Renamed the shared internal API context helper so the Visits workboard boundary is now canonical at the server layer too, with the Jobs helper retained only as a fallback alias.
- Tightened the remaining shell, detail, and redirect references so canonical operator navigation now resolves through `/dashboard/visits` even when legacy Jobs links still enter through compatibility routes.

## 2026-03-25 - Visits API wrappers and callers tightened

- Added Visits-branded internal API entrypoints for the workboard, snapshot, and communications flows so the active UI no longer needs to call `/api/internal/jobs/*` directly.
- Updated the existing Jobs API implementation to use Visits-branded shared helper naming and workflow aliases internally while preserving the legacy Jobs routes as compatibility wrappers.
- Switched the live Visits workboard and dispatch quick-edit surfaces onto the new `/api/internal/visits/*` endpoints so the server boundary now matches the Visits-first operator model.

## 2026-03-25 - Main Visits shell workflow helpers migrated

- Moved the main Visits shell and the new-visit entry flow off the remaining `getJob*` workflow helper imports onto the Visits-native aliases so the highest-traffic operator surfaces now speak the same workflow API language as the Visits model.
- Renamed the remaining internal workboard column symbols from `JobBoardColumn` and `jobBoardColumns` to Visits-first naming so the board implementation is more consistent internally as well as externally.
- Kept the change behavior-safe by reusing the existing shared workflow logic through aliases, then revalidated the shell and board surfaces under strict typing.

## 2026-03-25 - Visits workflow aliases and workboard surface tightened

- Added Visits-native aliases on the shared workflow helper layer so active workflow surfaces can stop importing `getJob*` helpers without changing the underlying workflow behavior.
- Renamed the main workboard surface to `VisitsWorkboard` and switched the primary Visits, Dispatch, and intake consumers onto the Visits helper names while leaving a compatibility alias in place for the legacy export.
- Tightened the code-level Visits ownership in the intake workflow, dispatch quick-edit, dispatch queue, and workflow tests so the remaining Jobs-era implementation drift is reduced in the highest-traffic operator paths.

## 2026-03-25 - Visit exception recovery and shell drift tightened again

- Removed the misleading Visits and Dispatch deep-link escape hatches from the selected-visit exception communication card so that full-record recovery stays centered on the inline customer-update actions already available there.
- Renamed another high-traffic slice of the main Visits shell from `Jobs*` and `*Jobs` variables toward Visits-first naming, including the scoped queue data and workboard usage.
- Kept the underlying alias routes intact while reducing more of the code-level mismatch between the Visits product model and the Jobs-era implementation surface.

## 2026-03-25 - Dispatch supply actions and Visits shell naming tightened

- Added a direct per-thread supply action in Dispatch so supply-blocked cards can jump straight into the affected visit's parts workspace instead of only opening the generic review drawer.
- Renamed the core Visits workspace filter and routing helpers away from `Jobs*` naming so the main `/dashboard/visits` shell is no longer internally framed around Jobs-era state.
- Kept the pass low-risk by preserving the existing Visits routes and behavior while reducing another layer of implementation drift between the product model and the code.

## 2026-03-25 - Low-confidence replans and estimate workspace links tightened

- Added per-thread low-confidence replan actions in Dispatch so operators can pull a specific weak-promise visit back out of the live board without relying only on the batch recovery control.
- Replaced more operator-facing `job` wording in the visit edit flow, labor-guide suggestions, estimate workspace, and workboard empty states so the remaining active office surfaces keep converging on Visits terminology.
- Shifted the active estimate workspace hero links onto `/dashboard/visits/*` routes so the implementation path matches the visit-first workflow model instead of bouncing through Jobs-era routes.

## 2026-03-25 - Promise-risk recovery now works at thread level

- Added a per-thread promise-risk action in Dispatch so operators can send the customer update for the exact at-risk visit in front of them instead of only running the batch recovery action.
- Tightened the active visit-detail subpages around parts, inventory, photos, invoice, and invoice edit so live workflow copy consistently speaks in terms of visits instead of jobs.
- Cleaned the visit-creation and selected-visit status/detail flow of more operator-facing `job` wording so the Visits model stays consistent across intake, execution, and billing.

## 2026-03-25 - Dispatch recovery cards now act on the hot thread

- Added per-thread reminder and recovery buttons to Dispatch stale approval, stale return, and closeout cards so operators can intervene on the exact visit in front of them instead of only running batch actions.
- Reused the existing dispatch interventions pipeline for those per-card actions, so Dispatch still queues reminders and follow-up updates through the same API path and eligibility rules as the batch recovery controls.
- Tightened another visible pass of `job` to `visit` wording in the active Visits workboard and selected-visit detail flow so drag/drop guidance, queue labels, notes, archive actions, and workflow copy keep converging on the Visits model.

## 2026-03-25 - Today Brief now pushes live follow-through

- Added one-click reminder actions to Today Brief approval and finance cards so operators can nudge customer follow-through without leaving the briefing surface.
- Reused the existing Visits and Finance communication server-action flow instead of creating a dashboard-only mutation path, keeping reminder queuing and document-link tracking consistent across desks.
- Tightened Dispatch and Visits continuity again by routing another dispatch card action into the split visit workspace and removing another visible `job` label from active workflow surfaces.

## 2026-03-25 - Dispatch handoff and visit-first language tightened

- Upgraded Today Brief rail cards so operators can take the primary next move directly from the card and only open the inspector when they need more context.
- Added a stronger Dispatch-to-Visits handoff by surfacing the split visit workspace directly from the dispatch quick-edit drawer and selected-visit rail focus.
- Replaced more visible `job` wording with `visit` wording in customer history and estimate-first intake surfaces so the active product language keeps converging around Visits.

## 2026-03-25 - Today Brief launch paths tightened

- Reworked Today Brief launch actions, lane links, queue rows, and rail actions so the brief opens focused visit work and closeout threads instead of dumping operators into generic desks.
- Renamed the queue inspector language around visits so the home brief reinforces visit-first production ownership instead of mixing `job` and `visit` wording.
- Tightened the dispatch toolbar handoff back into Visits so Dispatch now returns operators to the most relevant visit queue, especially the release queue when work is ready to route.

## 2026-03-25 - Customer support helpers extracted

- Moved the Customers desk risk summaries, next-move logic, thread-action routing, and customer-risk action cascade into a shared customer support module so the shell no longer owns the desk decision tree inline.
- Rewired the Customers workspace shell to consume the shared helper while preserving the existing customer risk and next-action behavior.
- Added focused unit coverage for customer record health, relationship risk summaries, next-move ordering, thread-action routing, and risk-action priority.

## 2026-03-25 - Dispatch lane health helpers extracted

- Added a shared dispatch lane-health helper so the resource header, week calendar, and operations rail all derive lane labels and tones from one source instead of carrying separate inline versions.
- Standardized the utilization-based lane tone mapping so `Loaded` and `Flow` no longer drift between dispatch surfaces.
- Added focused unit coverage for lane-health thresholds and resource-lane summarization.

## 2026-03-25 - Supply priority helpers extracted

- Moved the Supply desk's default-view and priority-action cascade into a shared procurement support module so the desk follows the same structural pattern as Estimates and Billing instead of keeping its decision tree inline.
- Rewired the Supply workspace page to consume the shared procurement support helper without changing desk behavior or cross-desk responsibilities.
- Added focused unit coverage for the procurement and supply priority ordering so the desk's urgency cascade stays explicit as inventory and sourcing rules evolve.

## 2026-03-25 - Jobs workboard billing helpers extracted

- Moved the remaining workboard-only billing helpers into the shared visit-billing module so billing action labels, notes, sort rank, and completed-work grouping no longer live inside the workboard component.
- Kept the Jobs workboard behavior intact while removing the last local billing helper pocket after the earlier visit-billing state extraction.
- Extended billing adapter tests to cover shared workboard billing behavior as well as visit invoice artifact summaries.

## 2026-03-25 - Visit billing state now derives from collections stages

- Added a shared visit-billing adapter so Visits now derives its billing state, labels, tones, and invoice artifact summary from the Finance collections-stage model instead of duplicating invoice-state logic in the visit page and workboard.
- Rewired both the selected-visit drawer and the Jobs workboard to use the shared adapter, removing the repeated `getBillingState` / label / tone helper blocks.
- Added focused unit coverage for the adapter so visit-side invoice summaries stay aligned with Finance-stage wording as collections thresholds evolve.

## 2026-03-25 - Finance collections helpers extracted

- Added a shared invoice collections helper module so finance-stage resolution, urgency ordering, collection next moves, and finance-priority actions now come from one source instead of living only inside the Finance page.
- Rewired the Finance desk to use the shared collections helper for stage labels, tones, copy, queue ordering, next actions, and invoice action labels while keeping visit-side billing state logic separate inside Visits.
- Added focused unit coverage for collections stage thresholds so reminder and aged-risk transitions are no longer protected only by page-level behavior.

## 2026-03-25 - Shared estimate support helpers extracted

- Added a shared estimate-support helper module so support-stage resolution, approval staleness, action labels, and decision copy now come from one source instead of drifting between Visits and Estimate support.
- Rewired the Visits workspace to use the shared helper for visit-side estimate-support routing, support summaries, and editable estimate action labels while keeping visit-specific routing local.
- Rewired the Estimate support desk to use the same shared stage, tone, rank, and decision-copy helpers so queue filtering and inspector messaging stay aligned with Visits.

## 2026-03-25 - Estimate support preserves selected visit focus

- Updated visit-side estimate-support links to pass `estimateId` so the estimate support desk opens already focused on the same estimate instead of dropping into a generic queue scan.
- Updated the estimate support inspector action copy to `Return to visit focus` so the route back into Visits is explicit and reinforces visit-first workflow ownership.

## 2026-03-25 - Visit-side estimate support convergence

- Added stage-aware estimate-support links directly to the selected-visit estimate artifact so builder work, approval follow-up, and release support can be reached from Visits without a separate desk-first jump.
- Added visit-production copy inside the estimate artifact so the operator sees the current estimate-support lane in visit context instead of only inside the Estimates desk.
- Kept the direct estimate workspace action in place while adding the estimate-support queue as a parallel action for drafting, approval, and release follow-through.

## 2026-03-25 - Visits drawer summary duplication removed

- Removed the duplicate exception-ownership and promise/trust/readiness summary sections from the selected-visit drawer.
- Kept the shared `OperationalFocusPanel` as the single top-level summary layer for urgency, blockers, and follow-through inside Visits.
- Left action-heavy sections such as customer updates, artifact workspaces, follow-up lifecycle, and service-thread detail in place.

## 2026-03-25 - Shared operational focus extended to Fleet and Finance

- Removed the remaining `FieldRecommendationStrip` usage from Fleet and Finance and replaced it with the shared `OperationalFocusPanel`.
- Removed the redundant top priority command card from both desks so the new shared panel becomes the single high-level summary layer instead of stacking duplicate urgency surfaces.
- Kept Fleet capacity/exception cards and Finance desk-health/cross-workspace cards intact underneath the shared focus layer.

## 2026-03-25 - Shared operational focus pattern for Visits and Customers

- Added a shared `OperationalFocusPanel` so desks can show one consistent summary language for next move, blockers, and follow-through instead of desk-specific recommendation strips and ad-hoc priority boxes.
- Replaced the customer recommendation strip with the new operational-focus panel driven by relationship risk, blockers, and service-thread follow-through.
- Replaced the selected-visit drawer callout plus next-action block with the same operational-focus pattern so Visits and Customers now surface urgency and ownership through the same frame.
- Left deeper visit artifact sections and customer cockpit details intact for now to keep the pass focused and low-risk.

# Work Log

Use this file as the living project ledger. Add a short entry whenever a meaningful milestone lands, especially if it includes schema changes, workflow changes, or deferred follow-up.

## Entry template

```
## YYYY-MM-DD - Milestone name

What shipped:
- ...

Follow-up:
- ...

Docs touched:
- ...
```

## 2026-03-24 - Dispatch and Visits recommendation strip

What shipped:
- Added a shared `FieldRecommendationStrip` component so operational workspaces can present explicit next moves instead of only status counters
- Added recommendation cards to Dispatch for release-ready routing, promise recovery, supply blockers, stale approvals, stale returns, and closeout pressure
- Added recommendation cards to Visits for release handoff, stale approvals, ownership gaps, supply blockers, and finance follow-through

Follow-up:
- Extend the same recommendation pattern into Customers and Finance so relationship risk and cash-risk workspaces become intervention-first too

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - Production desk reduction across Dispatch, Visits, and Estimates

What shipped:
- Compressed the dispatch toolbar and command center so the live board stays dominant and the page spends less space on header chrome and advisory layers.
- Removed the extra recommendation strips from `Dispatch`, `Visits`, and `Estimates`, leaving the core desks to lead with blocker counts, queue controls, and the actual working surfaces.
- Reframed the estimates workspace as `Estimate support` for visit production instead of a peer command center, aligning estimate work more clearly with the `Visits` lifecycle.

Follow-up:
- Continue reducing the right-side rails so dispatch, visits, and customer detail all use one shared exception and next-action model.
- Start the visit-side split workspace pass so estimate production, approval follow-up, and release happen from the same visit context more often.
- Tighten the dispatch toolbar CSS so the reduced control set also collapses vertically on smaller desktop widths.

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - Dispatch command-center reduction pass

What shipped:
- Removed the extra recommendation strip from the dispatch command center so the toolbar, status strip, board, and operations rail remain the primary work surfaces.
- Reframed the dispatch status strip around recovery pressure, release pressure, conflicts, supply blockers, and money follow-through instead of a broader mixed-status summary.
- Tightened the dispatch page framing so the screen reads as a live recovery and release workspace rather than a generic routing page.

Follow-up:
- Keep compressing the dispatch toolbar so date, view, scope, and batch recovery actions occupy less vertical space above the board.
- Push the same exception-first reduction into the right operations rail so recovery, approvals, supply, and closeout read as one shared operational model.
- Start the split-workspace pass for Visits and estimate production so Dispatch and Visits feel like two modes of one operating system.

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - Dispatch intervention framing and Visits queue language tightened

What shipped:
- Reframed the Dispatch operations rail and selected-visit actions around an explicit intervention-dock model so the right side reads as live recovery context instead of a passive exception roster.
- Tightened the Dispatch visit drawer copy so timing recovery, trust, and release ownership are explicit in the header and hero callouts without changing the underlying workflow behavior.
- Sharpened the Visits page hero and scope-panel language so the desk presents itself as the production queue at first glance rather than a generic visits list.

Follow-up:
- Keep compressing Dispatch review card copy so per-thread actions converge around one intervention vocabulary across promise risk, approvals, supply, and closeout.
- Continue tightening Visits selected-thread language so queue, drawer, and artifact actions all speak in terms of production flow instead of record browsing.

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - Dispatch action vocabulary and visit thread framing tightened

What shipped:
- Normalized the Dispatch intervention cards around queue, drawer, and conflict language so promise risk, approvals, return recovery, closeout, and supply cards now read like one intervention system.
- Tightened the selected visit drawer in Visits so it presents itself as a production workspace with workstreams and production controls instead of a generic detail inspector.
- Preserved the existing routing and server actions while making the next moves and workspace framing clearer at the points where operators actually work.

Follow-up:
- Continue tightening artifact-card action labels so estimate, invoice, and supply cards use the same production-workspace vocabulary as the top rail.
- Consider a small visual pass on the selected visit header so the production workspace framing is even more obvious without adding extra chrome.

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - Visit workspace actions and hierarchy polished

What shipped:
- Tightened the selected visit artifact-card actions so estimate, invoice, field, and supply buttons read as explicit workspaces and customer-facing outputs instead of mixed generic links.
- Removed an accidental block of work-log text that had landed inside the selected visit supply card markup.
- Added a small visual hierarchy pass to the selected visit workspace header and production-workspaces block so the drawer more clearly reads like the primary operating rail.

Follow-up:
- Continue aligning the remaining lower-rail action labels with the same workspace vocabulary used in the top production block.
- Validate the updated drawer visually in-browser and trim anything that now feels too heavy once seen in context.

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - Dispatch handoff targets now preserve visit context

What shipped:
- Replaced the main Dispatch-to-Visits queue links with selected-visit-aware hrefs so recovery, release, supply, approval, return, and money handoffs keep the same visit thread open when a dispatch visit is already selected.
- Fixed the malformed promise-risk queue link in the dispatch quick-edit drawer so it now targets the real Visits scope.
- Kept the change low-risk by reusing the existing dashboard alias helper instead of introducing new routing behavior.

Follow-up:
- Extend the same selected-visit-aware handoff pattern into any remaining dispatch page-level links that still point to generic Visits scopes.
- Consider whether the finance desk should also preserve selected visit context when Dispatch sends operators into money follow-through.

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - Dispatch toolbar copy and shell cleanup tightened

What shipped:
- Brought the dispatch toolbar batch-action labels into the same intervention vocabulary already used across the rail and command center.
- Removed a stray raw code string that had been rendering inside the dispatch toolbar board meta area.
- Switched the page-shell assignment queue link onto the shared dashboard alias helper for consistency with the rest of the Visits handoff surface.

Follow-up:
- Keep checking the dispatch shell for any remaining legacy copy or accidental render artifacts as the V3 refactor continues.

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - Dispatch role shortcuts now preserve visit focus

What shipped:
- Updated the Dispatch role-focus shortcuts so the dispatcher assignment queue and admin approval follow-up links now preserve the selected visit thread when one is already open.
- Kept the behavior aligned with the earlier Dispatch handoff work by reusing the shared dashboard alias helper instead of introducing another routing path.

Follow-up:
- If finance follow-through should also preserve selected visit context, apply the same pattern to the remaining finance-stage shortcuts.

Docs touched:
- `docs/work-log.md`

## 2026-03-25 - V3 product architecture and workflow spec

What shipped:
- Added a new V3 strategy document that converts the recent product review into a concrete target architecture covering the future sitemap, role-based entry points, page-purpose model, navigation rules, and canonical workspace patterns.
- Mapped the ideal visit lifecycle from intake through revisit, including which current routes should be kept, merged, shrunk into workspace tabs, or removed from the operator mental model.
- Wrote a focused Dispatch, Visits, and Estimates triangle strategy so the highest-leverage production surfaces converge on one operating system instead of continuing as adjacent desks.

Follow-up:
- Break the V3 strategy into execution milestones that explicitly sequence route consolidation, workspace-shell convergence, and visual hierarchy reduction.
- Convert the lifecycle merge map into route-by-route engineering tickets so deep visit artifact pages can be progressively downgraded into tabs and drawers.
- Use the Dispatch-Visits-Estimates triangle section as the basis for the next design pass and implementation backlog review.

Docs touched:
- `docs/v3-operations-architecture-and-workflow-spec.md`
- `docs/work-log.md`

## 2026-03-25 - V3 execution backlog, route tickets, and screen specs

What shipped:
- Added a V3 implementation backlog that turns the new architecture direction into an ordered milestone sequence focused on route-model finish, visit-workspace convergence, field-capacity consolidation, and support-desk completion.
- Added a route-by-route engineering ticket pack mapping which current routes and workspace surfaces should be kept, demoted, merged, or downgraded into drawers, tabs, and parent-desk entry points.
- Added wireframe-grade screen specs for the Dispatch, Visits, and Estimates triangle so the next design and implementation pass has explicit layout, interaction, continuity, and responsive rules.

Follow-up:
- Break the new V3 milestones into implementation-ready tickets per milestone, starting with shell finish and Visits-estimate convergence.
- Translate the screen spec into actual component-level design tasks for dispatch command center, visits queue, selected-thread drawer, and estimate production workspace.
- Use the route ticket pack to audit current redirects, wrappers, and parent-desk launch paths before deleting any legacy compatibility routes.

Docs touched:
- `docs/v3-implementation-backlog.md`
- `docs/v3-route-consolidation-engineering-tickets.md`
- `docs/v3-dispatch-visits-estimates-screen-spec.md`
- `docs/work-log.md`

## 2026-03-25 - V3 milestone tickets, UI build plan, and Visits-first estimate handoff

What shipped:
- Added an implementation-ready ticket pack for V3 Milestones 30 and 31, focused on shell finish and Visits-estimate convergence.
- Added a component-level UI build plan that maps the Dispatch, Visits, and Estimates screen strategy onto current files and reusable component surfaces.
- Tightened the active code paths so Today Brief, Reports, and selected-visit estimate-support actions now route approval and follow-through work into Visits-first scopes instead of defaulting to the standalone estimate desk.

Follow-up:
- Continue the same path normalization across remaining cross-desk estimate links so support-stage work consistently re-enters Visits first.
- Start the dispatch-side quick-context drawer pass so the board can open visit intervention context without relying on deep route changes.
- Use the new Milestone 30-31 ticket pack as the implementation checklist for the next code sprint.

Docs touched:
- `docs/v3-milestone-30-31-engineering-tickets.md`
- `docs/v3-dispatch-visits-estimates-ui-build-plan.md`
- `docs/work-log.md`

## 2026-03-25 - Dashboard shell reduction and Today Brief tightening

What shipped:
- Simplified the office shell navigation around the actual operating model so `Today brief`, `Dispatch`, `Visits`, `Customers`, `Fleet`, `Supply`, and `Finance` read as the core desks.
- Removed the standalone `Estimates` desk from sidebar navigation so estimate work is framed as part of the visit lifecycle instead of a competing top-level module.
- Tightened the `Today brief` surface by removing the extra recommendation strip, sharpening header actions and metrics, and only surfacing active blocker desks for release, supply, and finance.

Follow-up:
- Continue the same reduction pass inside `Dispatch` and `Visits` so live recovery, visit release, and closeout use the same compact action hierarchy.
- Convert more cross-module recommendation cards into shared exception primitives so urgency feels consistent across Today Brief, Visits, Customers, and Fleet.
- Rework the estimate queue so approval oversight stays available without restoring `Estimates` as a first-class shell destination.

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Today Brief recommendation strip

What shipped:
- Added the shared `FieldRecommendationStrip` to Today Brief so the owner and manager home view now leads with explicit interventions instead of summary-only pressure signals
- Prioritized carryover, release handoff, approval drag, assignment gaps, trapped revenue, and route watch as the top recommended moves from the brief

Follow-up:
- Extend the same recommendation pattern into Customers and Finance so relationship risk and cash-risk workspaces become intervention-first too

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Customers and Finance recommendation strip

What shipped:
- Added the shared `FieldRecommendationStrip` to the Customer workspace so relationship risk, approval drag, supply blockers, return work, and open balance pressure now surface as explicit next moves
- Added the shared `FieldRecommendationStrip` to the Finance desk so aged risk, reminders due, draft release, dominant service-thread pressure, and open-money follow-through now lead the workspace

Follow-up:
- Convert the highest-value recommendation cards into inline drawer launches or one-click actions so operators can act without leaving the current desk

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Estimates and Fleet recommendation strip

What shipped:
- Added the shared `FieldRecommendationStrip` to Estimates so stale approvals, approved release, builder throughput, supply blockers, and dominant service-thread pressure now lead the workspace
- Added the shared `FieldRecommendationStrip` to Fleet so insertion capacity, lane recovery, waiting-work routing, readiness gaps, and workflow pressure now surface above the map workspace

Follow-up:
- Convert the highest-value recommendation cards into inline drawer launches or one-click actions so operators can act without leaving the current desk

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Recommendation strip action footer

What shipped:
- Upgraded the shared `FieldRecommendationStrip` so every recommendation card now ends with an explicit `Next move` footer instead of relying on the whole card link to imply the action
- Kept the behavior shared across Dispatch, Visits, Today Brief, Customers, Finance, Estimates, and Fleet so the command language stays consistent product-wide

Follow-up:
- Replace the footer link behavior with inline drawers or one-click mutations for the highest-value desks where a full route change is still unnecessary

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Recommendation strip action labels

What shipped:
- Added explicit `actionLabel` copy across Today Brief, Dispatch, Visits, Customers, Finance, Estimates, and Fleet so recommendation footers now read like concrete operator moves instead of repeating card titles
- Kept the existing recommendation ranking and destinations intact while tightening the cross-desk command language

Follow-up:
- Replace the highest-value footer links with inline drawers or one-click actions where operators should not need a full page transition

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Recommendation strip inline actions

What shipped:
- Reworked the shared `FieldRecommendationStrip` so recommendation cards can expose an inline action button in the footer alongside the primary next-move link
- Wired Dispatch recommendations into existing batch intervention handlers so operators can trigger recovery, approval, return-visit, closeout, and replanning actions without leaving the board
- Wired Fleet recommendations into in-place lane inspection, queue inspection, and unit-panel actions so the desk can absorb the first response before a dispatch route change

Follow-up:
- Extend inline actions into the remaining client-side desks where the first recommended move can be completed with local state changes or server actions instead of a full route change

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Customer vehicles route collapse

What shipped:
- Removed the standalone `Customer vehicles` screen as a competing operational workspace and turned `/dashboard/customer-vehicles` into a route-level alias back into the Customers workspace
- Preserved legacy vehicle selection by resolving the requested vehicle and redirecting into the correct customer with the `vehicles` tab open
- Removed the static redirect entry so the route can preserve real customer and vehicle context instead of blindly dropping users into a generic tab

Follow-up:
- If the old customer-vehicles filters still matter in practice, port the few that operators actually use into the Customers workspace instead of rebuilding a separate registry screen

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Fleet alias route restoration

What shipped:
- Removed the static Next.js redirects for `/dashboard/fleet-vehicles` and `/dashboard/team` so the existing route-level alias pages can preserve `panel`, `technicianId`, and date context when sending users into Fleet
- Restored the intended product behavior where Team and Fleet Vehicles act as compatibility routes into Fleet lenses instead of flattening into a generic fleet landing

Follow-up:
- Collapse any remaining legacy links that still speak in standalone `Team` or `Fleet vehicles` language and replace them with explicit Fleet lens actions

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Dispatch and Fleet shared status strip

What shipped:
- Added a shared `FieldStatusStrip` component so Dispatch and Fleet use the same operational summary pattern for queue, readiness, route risk, supply pressure, and closeout pressure
- Inserted the shared strip beneath the Dispatch toolbar and replaced Fleet's local exception-chip row with the same shared surface
- Removed the obsolete Fleet exception-chip helper and styling that the new shared strip made redundant

Follow-up:
- Consider whether the next convergence step should merge Dispatch and Fleet toolbar controls, or keep the controls role-specific while preserving the shared status vocabulary

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Visit route link convergence

What shipped:
- Added a shared Visits workspace href helper so service history, payment return, and visit-side office workflows can generate canonical `/dashboard/visits/...` links from one place
- Replaced the remaining live `Jobs` route links in service history cards, the payment return office redirect, the visit parts and inventory flows, the invoice editor, the visit edit flow, and parts-request back-links
- Updated the affected visit subflows to revalidate canonical Visits routes instead of only the legacy `Jobs` paths so the real workspace URL stays fresh after office actions

Follow-up:
- Keep collapsing any remaining legacy route implementations that still exist only as compatibility shells, but keep the canonical route helpers as the single source of truth for operator navigation

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Supply and Finance root alias convergence

What shipped:
- Converted `/dashboard/parts`, `/dashboard/inventory`, and `/dashboard/invoices` root pages into real query-preserving aliases to `/dashboard/supply`, `/dashboard/supply/inventory`, and `/dashboard/finance`
- Promoted the canonical Supply, Inventory, and Finance root implementations to named exports so the real desks no longer depend on redirecting through a legacy default page export
- Removed the remaining `revalidatePath` calls that still targeted `/dashboard/jobs...` in the active visit-side office workflows, parts procurement flows, and bulk workboard API handlers

Follow-up:
- Continue collapsing deeper legacy detail routes where a path still exists only as a compatibility shell, but keep runtime behavior query-preserving when operators arrive through old bookmarks

Docs touched:
- `docs/work-log.md`

## 2026-03-09 - Documentation baseline

What shipped:
- Added a top-level README with workspace structure, commands, and documentation expectations
- Added an architecture snapshot for application, package, and database boundaries
- Added this work log to track milestones and follow-up in one place

Follow-up:
- Backfill notable earlier milestones as time allows so the log reflects more than just new work
- Decide whether the repo also needs a dedicated ADR or decisions folder for irreversible architecture choices

Docs touched:
- `README.md`
- `docs/architecture.md`
- `docs/work-log.md`

## 2026-03-09 - Documentation hardening

What shipped:
- Added an environment reference covering web, mobile, billing, and communications configuration
- Added the first ADR to define which documents are expected to stay current as the repo evolves
- Backfilled historical milestones from the current migration and integration-note state so the log is useful immediately

Follow-up:
- Add more ADRs when the team makes decisions that are expensive to unwind

Docs touched:
- `docs/environment.md`
- `docs/adr/0001-documentation-and-drift-control.md`
- `docs/work-log.md`

## 2026-03-09 - Release and decision docs

What shipped:
- Added a reusable release checklist covering environment, schema, app verification, docs, and operational checks
- Added an ADR template so future architectural decisions have a consistent format
- Tightened the docs workflow so substantial changes are expected to update the work log or ADRs in the same change

Follow-up:
- Add a deployment runbook once hosting and release mechanics are stable
- Add subsystem-specific release addenda only if a checklist section becomes too broad

Docs touched:
- `README.md`
- `docs/architecture.md`
- `docs/release-checklist.md`
- `docs/adr/template.md`
- `docs/work-log.md`

## 2026-03-23 - Customer SMS provider platform hardening

What shipped:
- Added company-owned SMS provider account support for `Twilio` and `Telnyx`
- Added communications readiness and automation activation controls in office settings
- Added live SMS automation production for `en_route`, `running_late`, and invoice reminder workflows
- Added dedicated communications onboarding routes for provider choice, compliance prep, provider connection, test-delivery guidance, and final review
- Added a customer SMS platform runbook so platform setup is documented separately from per-shop onboarding
- Updated environment and release docs to reflect `SMS_PROVIDER_CREDENTIAL_SECRET`, legacy Twilio fallback, and the scheduler-owned automation route

Follow-up:
- Add inbound SMS handling if customer replies move into scope
- Improve late detection from scheduled-window heuristics to live ETA when GPS routing is ready

Docs touched:
- `README.md`
- `apps/web/.env.example`
- `docs/customer-sms-platform-runbook.md`
- `docs/customer-sms-self-serve-onboarding-spec.md`
- `docs/environment.md`
- `docs/release-checklist.md`
- `docs/work-log.md`
- `tooling/customer-communication-layer-integration.md`

## Historical milestones inferred from current repo state

These entries were reconstructed from the migration timeline, workspace structure, and feature notes. They are meant to prevent context loss until a real commit-based history log is maintained here.

### Foundation and tenancy

- Source of truth: migrations `0001` through `0005`
- Established database extensions, profiles, companies, memberships, and baseline row-level security
- Created the base multi-tenant shape the rest of the system depends on

### Customer and vehicle records

- Source of truth: migrations `0006` through `0012`
- Added customers, customer addresses, vehicles, and guard policies around customer-vehicle relationships
- Locked down important data-quality rules such as nonblank constraints and plate-pair integrity

### Jobs and technician access

- Source of truth: migrations `0013` through `0018`
- Added jobs, job notes, status history, archive/status guards, and technician mobile access rules
- Defined the main service workflow between office dispatching and technician execution

### Inspections and attachments

- Source of truth: migrations `0019` through `0024`
- Added inspections plus completion guards, attachments, storage integration, and related RLS
- Extended the job workflow with field evidence capture and inspection lifecycle enforcement

### Estimates

- Source of truth: migrations `0025` through `0029`
- Added estimates, estimate RLS, send guards, sent-state lock behavior, and subtotal guards
- Introduced a controlled estimate lifecycle with stronger pricing invariants

### Signatures, invoices, and payments

- Source of truth: migrations `0030` through `0038`
- Added signatures, invoice records, invoice balance and total recomputation guards, partial-payment status, payments, and payment RLS
- Established the billing path from approval through collection state transitions

### Dispatch board integration

- Source notes: `tooling/dispatch-board-integration.md`
- Includes scheduling views, assignment/reschedule flows, and availability blocks
- Requires migration alignment and typecheck after schema updates

### Customer communication layer integration

- Source notes: `tooling/customer-communication-layer-integration.md`
- Includes durable communication events, provider abstraction, internal processing route, and send surfaces across estimates, invoices, jobs, and customers
- Has clear follow-up around scheduling, provider webhooks, and preference management

## Working rule going forward

When a meaningful feature lands, add a dated entry here immediately instead of relying on memory or scattered chat history.

## 2026-03-21 - Fleet workspace redesign review

What shipped:
- Added a written review of the Fleet page UX and information architecture
- Captured the redesign goals for making Fleet map-first, exception-driven, and less chrome-heavy
- Started a redesign pass to turn the top controls into a command bar, the bottom rail into an exception roster, and the side rail into a denser inspector

Follow-up:
- Finish the Fleet redesign until the map, command bar, roster, and inspector read as one coherent operator console
- Re-verify Fleet at desktop, tablet, and mobile widths after the redesign settles

Docs touched:
- `docs/fleet-ui-review-2026-03-21.md`
- `docs/work-log.md`

## 2026-03-23 - Customer SMS onboarding persistence and test-send flow

What shipped:
- Added saved company-level SMS onboarding/compliance profiles so self-serve setup no longer depends on provider-portal memory alone
- Added a dedicated in-app SMS test-send flow that stores provider test state, updates from Twilio or Telnyx delivery callbacks, and unlocks readiness once delivery is observed
- Extended communications readiness and onboarding to require the saved compliance profile, show provider-test state, and guide admins through review before enabling live automations

Follow-up:
- Add inbound SMS and reply handling if customer conversations need to live inside the platform
- Replace schedule-only late detection with live GPS ETA once fleet-based dispatch timing is promoted into the communications automations
- Resolve the unrelated missing `apps/web/lib/data-imports/processor.ts` import before relying on full `@mobile-mechanic/web` typecheck as a green release gate

Docs touched:
- `docs/customer-sms-platform-runbook.md`
- `docs/work-log.md`

## 2026-03-23 - Estimate queue visual polish

What shipped:
- Reworked the Estimates board into a clearer command surface with a workflow-focused command band and filtered-queue-aware metrics
- Simplified estimate cards and tightened the right-side drawer so the page reads like an operations workspace instead of a soft admin dashboard
- Improved context preservation by surfacing next move, queue state, and direct actions inside the drawer without extra page hopping
- Tightened tablet and phone behavior so board mode no longer inherits the wrong multi-column layout at narrow widths and the mobile header/command surfaces waste less vertical space

Follow-up:
- Recheck the Estimates page at tablet and mobile widths after the next broader navigation polish pass
- Decide whether the same command-band hierarchy should be carried into the estimate workspace and invoices queue for visual consistency

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Estimates desk-first workspace pass

What shipped:
- Converted `/dashboard/estimates` to a desk-first default view instead of leading with the three-lane showcase
- Added a priority command deck for stale approvals, approved release, and builder throughput so operators land on the highest-value work immediately
- Replaced the modal estimate details drawer with a persistent inline inspector to keep queue state and estimate context visible at the same time
- Introduced a compact live roster grouped by stale approvals, release-ready work, approvals waiting, and builder work so the estimate desk reads like an operating surface instead of a gallery

Follow-up:
- Recheck the new inspector and roster balance at narrower laptop widths during the next broader navigation pass
- Carry the same persistent-inspector pattern into other remaining queue surfaces only where it reduces context resets instead of adding more chrome

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Command brief and blocker surfacing pass

What shipped:
- Reframed `/dashboard` from a residual overview into a tighter command brief with an action-first strip for release, supply, and finance follow-through
- Surfaced supply and finance blockers directly into the Today Brief rail so cross-workspace pressure stays visible without hunting through separate desks
- Added release, supply, and finance blocker counts to the Visits hero plus direct blocker shortcuts in the queue toolbar
- Added a supply-watch section to the Dispatch exception rail so supply blockers stay visible beside approvals, promise risk, returns, and closeout pressure

Follow-up:
- Keep collapsing drawer-only review flows on remaining office surfaces where the same blocker is still hidden behind secondary chrome
- Decide whether Visits should gain a dedicated supply-blocked scope or whether the command strip plus direct inventory deep-links are sufficient

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Supply-blocked scope and desk alignment pass

What shipped:
- Added a dedicated `supply_blocked` Visits scope so office users can work blocked visit threads directly instead of inferring them through broader readiness slices
- Updated the Supply desk to use the shared blocker model for release handoff, supply-blocked visits, and finance follow-through instead of only local sourcing counts
- Updated the Finance desk to surface the same cross-workspace blocker model inside its command deck and corrected its visits deep-links to the existing billing-follow-up slice

Follow-up:
- Decide whether the Visits scope bar now needs regrouping or prioritization as more operating-system slices are added
- Keep auditing older desk links for any remaining stale route names from before the canonical workspace reset

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Visits lane regrouping and customer blocker pass

What shipped:
- Regrouped the Visits scope toolbar so the top row stays focused on primary operating lanes while secondary watchlists move into the expandable filter panel
- Extended the shared blocker model into Customers so the relationship desk now surfaces supply-blocked and finance-blocked customer threads alongside trust, approval, and return-work risk
- Corrected the Supply workspace shell CTA to point directly at the dedicated `supply_blocked` Visits slice instead of the older readiness-risk queue

Follow-up:
- Recheck whether Fleet should adopt the same shared blocker summary next or whether its current exception roster already captures enough cross-workspace pressure
- Keep trimming any remaining shell-level CTAs that still point to broader legacy slices when a dedicated canonical queue now exists

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Fleet workflow pressure pass

What shipped:
- Extended the shared blocker model into Fleet so visible lanes now surface release handoff, supply-blocked work, and finance closeout pressure beside route and GPS exceptions
- Added a workflow-pressure command card and blocker chips to the Fleet workspace so dispatch capacity decisions stay grounded in whether a visible visit is actually commercially or materially clear
- Added blocker-aware inspector actions so operators can jump straight from a selected fleet lane into supply or finance recovery when that lane is not truly dispatchable

Follow-up:
- Recheck whether the fleet command deck still feels balanced on narrower laptop widths now that workflow pressure sits beside route recovery and capacity cards
- Decide whether Dispatch and Fleet should eventually share one unified "lane pressure" vocabulary for route, supply, and finance blockers

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Estimate workflow pressure pass

What shipped:
- Extended the shared blocker vocabulary into the Estimates desk so estimate-linked visits now surface supply blockers, release handoff, and finance follow-through beside quote-specific approval work
- Added a workflow-pressure command card and toolbar chips so the Estimates desk reads as part of the operating system instead of an isolated quote queue
- Added blocker-aware actions and cross-workspace blocker detail in the selected estimate inspector so operators can jump directly into supply or billing recovery when a quote thread is not truly clear

Follow-up:
- Recheck whether the Estimates command deck now needs layout tightening on smaller laptop widths with the added workflow card
- Decide whether the estimate desk should eventually use the same blocker-strip pattern as Visits and Fleet for even tighter visual consistency

Docs touched:
- `docs/work-log.md`

## 2026-03-24 - Dispatch and Fleet field command shell pass

What shipped:
- Added a shared field-command shell so Dispatch and Fleet now present as two lenses of one field command system instead of separate header patterns
- Added a mode switch, shared status framing, and cross-links between Dispatch, Fleet, and Visits to tighten movement between field control surfaces
- Applied the shared shell to Dispatch and Fleet success and recovery states without changing the underlying board and map workspaces

Follow-up:
- Decide whether Dispatch and Fleet should eventually share one deeper command bar vocabulary for scope, filters, and saved views beyond the new shared shell framing
- Recheck the new shell at tablet widths to confirm the two-mode switch remains quick to scan and does not crowd the primary workspace on smaller screens

Docs touched:
- `docs/work-log.md`

## 2026-03-23 - V2 operations IA and wireframe spec

What shipped:
- Added a future-state office product architecture spec for a dispatch-led, visit-centric redesign
- Defined the reduced top-level navigation, role-based entry points, canonical workspace patterns, and route migration rules
- Captured text wireframes for the key v2 surfaces including Today Brief, Dispatch, Visits, Visit Workspace, Estimate Workspace, Customers, Fleet, Supply, and Finance

Follow-up:
- Use this spec to guide shell changes, route consolidation, and workspace rewrites instead of adding more peer-level modules
- Decide whether the visit workspace should be introduced behind the current job routes first or launched as a new `/dashboard/visits` shell during migration
- Break the redesign into implementation milestones with explicit success criteria for Dispatch, Visits, Customers, Fleet, Supply, and Finance

Docs touched:
- `README.md`
- `docs/v2-operations-ia-and-wireframes.md`
- `docs/work-log.md`

## 2026-03-23 - V2 implementation backlog and milestone plan

What shipped:
- Added a phased implementation plan for the v2 office product redesign instead of leaving the architecture at the concept level
- Broke the redesign into milestone-sized execution blocks covering shell reset, visits, visit workspace, dispatch convergence, customer consolidation, fleet consolidation, supply, finance, and cleanup
- Added dependencies, route migration guidance, workstreams, and exit criteria so implementation can be sequenced without reinforcing the current fragmented structure

Follow-up:
- Translate Milestone 26 and Milestone 27 into concrete engineering tickets before starting route or shell work
- Decide whether the first migration release should expose `/dashboard/visits` immediately or ship it behind the existing `/dashboard/jobs` route with renamed UI first
- Keep the implementation plan current as milestones are split, merged, or partially deferred

Docs touched:
- `README.md`
- `docs/v2-operations-ia-and-wireframes.md`
- `docs/v2-implementation-plan.md`
- `docs/work-log.md`

## 2026-03-23 - Milestones 26-27 engineering ticket breakdown

What shipped:
- Added build-ready engineering tickets for the first two v2 milestones so implementation can start from explicit tasks instead of high-level architecture only
- Scoped Milestone 26 tickets around primary nav reduction, transitional route aliases, role-based home behavior, shell copy migration, and secondary-route preservation
- Scoped Milestone 27 tickets around the new `Visits` route, queue-first default behavior, stronger drawer interactions, and reduced reliance on the full job page

Follow-up:
- Convert Ticket 26.1 through 26.5 into active implementation work before touching the shell
- Decide whether to instrument visits-route and full-job-page usage during Milestone 27 or defer telemetry hooks to a near-follow-up pass
- Add the Milestone 28 ticket pack before starting the persistent visit workspace build so the route-collapse work stays explicit

Docs touched:
- `README.md`
- `docs/v2-implementation-plan.md`
- `docs/v2-milestone-26-27-engineering-tickets.md`
- `docs/work-log.md`

## 2026-03-25 - Canonical route ownership for visits and supply detail pages

What shipped:
- Moved canonical implementation ownership to `visits/*`, `supply/*`, `supply/inventory/*`, and `finance` while keeping `jobs/*`, `parts/*`, `inventory/*`, and `invoices` as thin compatibility aliases.
- Added query-preserving alias behavior for legacy visit and supply detail routes so existing deep links continue to land on the new canonical desks without losing context.
- Repointed canonical wrappers at named implementation exports instead of legacy defaults, reducing the chance of future feature work landing under deprecated route families.

Follow-up:
- Sweep the remaining operator copy, breadcrumbs, and internal references for any lingering `Jobs`, `Parts`, or `Inventory` wording that no longer matches the canonical IA.
- Add route-level smoke coverage for legacy alias redirects so future desk work does not accidentally restore implementation ownership to deprecated paths.
- Continue converging feature-local helpers and server actions toward canonical desk naming so the file system and runtime navigation stay aligned.

Docs touched:
- `docs/work-log.md`
## 2026-04-05 - Mobile guided-stop verification now boots the correct E2E stack and supports Expo web billing flows
- moved the mobile E2E harness to a dedicated Expo web port (`19016`) so stale local Expo sessions on `19006` stop causing blank-page false negatives.
- made mobile guided-stop tests boot the Next web app alongside Expo web because technician billing actions depend on web-backed `/api/mobile/...` routes.
- injected `EXPO_PUBLIC_WEB_APP_URL` into the Expo E2E process so mobile billing and handoff flows can resolve their web API base URL in test runs.
- updated the guided-stop Playwright spec to the new field workboard / invoice workspace flow after the technician stop redesign removed the old `Guided stop sequence` / `Billing summary` copy.
- added shared CORS + preflight handling for mobile API routes and wired it through push subscriptions, invoice actions/payments/handoffs/drafts/line-items/create, live retailer lookup, and closeout sync so Expo web can call those authenticated routes during verification.
- verified with `pnpm --filter @mobile-mechanic/e2e test:mobile`, `pnpm --filter @mobile-mechanic/web typecheck`, and `pnpm --filter @mobile-mechanic/mobile typecheck`.
