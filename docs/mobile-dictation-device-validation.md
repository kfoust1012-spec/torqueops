# Mobile Dictation Device Validation

Run this after the next native mobile rebuild that includes `expo-speech-recognition`.

## Build Prerequisite

1. Regenerate a native build:
   - `pnpm --filter @mobile-mechanic/mobile android`
   - `pnpm --filter @mobile-mechanic/mobile ios`
2. Install the new build on one Android device and one iPhone.
3. Confirm the app prompts for microphone / speech recognition permissions on first dictation use.

## Test Script

Use one assigned stop that has:
- a draft estimate
- at least one part line
- a draft or unpaid invoice

Validate on both iOS and Android:

1. Technician note
   - Open the assigned stop.
   - Tap `Dictate note`.
   - Speak: `Diagnostic complete. Customer approved repair. Return visit required if part is not in stock.`
   - Confirm the transcript lands in the note field and can be saved.

2. Stop-console estimate sheet
   - Open `Add quick line`.
   - Dictate the line name and description.
   - Confirm the transcript appends into the right fields and `Save line` still works.

3. Stop-console sourcing sheet
   - Open `Source part`.
   - Dictate a sourcing note like:
     `Same-day pickup confirmed. Core due at pickup.`
   - Confirm the note field updates and `Save source` still works.

4. Stop-console payment sheet
   - Open `Quick field payment`.
   - Dictate a payment note like:
     `Cash collected in field. Paid in full during visit.`
   - Confirm the note field updates and the payment can be recorded.

5. Full estimate workspace
   - Dictate:
     - estimate title
     - estimate notes
     - estimate terms
     - estimate line name
     - estimate line description
     - source notes
   - Confirm each field captures transcript without affecting unrelated fields.

6. Full invoice workspace
   - Dictate:
     - invoice title
     - invoice notes
     - invoice terms
     - invoice line name
     - invoice line description
     - manual payment note
     - payment handoff note
   - Confirm each field captures transcript and save actions still work.

## Failure Checks

Verify:
- permission denied shows a clear failure state
- unsupported speech service shows a clear failure state
- tapping `Stop dictation` stops listening cleanly
- interim transcript does not duplicate excessively
- final transcript appends once
- returning to the field after an interruption does not leave the recognizer stuck

## Vocabulary Checks

Say these mechanic-specific phrases and record accuracy:
- `diagnostic complete`
- `return visit required`
- `same-day pickup confirmed`
- `core due at pickup`
- `customer approved repair`
- `cash collected in field`
- `check received in field`
- `parts and labor warranty`

If any phrase consistently fails, add it to the shared context lists in [dictation-context.ts](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/mobile/src/features/voice/dictation-context.ts).
