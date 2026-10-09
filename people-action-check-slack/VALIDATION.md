# QA validation — version 1.2.0

Automated QA completed September 29, 2026, on Node 26.8.1. Production minimum remains Node 24. No test-workspace tokens were configured; the user explicitly requested automated QA first.

## Passed

- **27 tests**, zero failures. See `docs/test-results.txt` and run `npm test` or `npm run test:coverage`.
- Real Slack Bolt `App.processEvent` dispatch for commands, events, actions and view submissions. Real SQLite operations and real DOCX generation. WebClient network calls are replaced with controlled test responses/failures.
- All 10 scenarios in one check: overview progression, partially answered save/resume, back/next, validation, completion, result pages, edit and rerun.
- Policies: Home open versus modal push, create/read/update/delete, pagination and required fields.
- HR: explicit snapshot sharing, visible supporting evidence, review save, stale review protection, persisted per-recipient delivery outcomes, partial failures, successful-recipient skipping, duplicate-submission review preservation and concurrent retry exclusion.
- Negative tests: cross-user/workspace access, wrong record type, non-HR access, missing records, stale forms, invalid dates, database failures, missing scopes and rate limits.
- File-backed database close/reopen retains assessment, policy and HR/delivery data. Database mode is 0600. Personal deletion retains already-shared snapshots.
- Scoring tests cover six corrected answer polarities, legacy behavior, critical overrides, raw answer counts and thresholds.
- **81 current synthetic Block Kit fixtures** passed local structure/limit checks and action/callback mapping checks.
- **81/81 exact current fixtures accepted by Slack's public blocks.validate API**. Whole views validated using `view`; notification blocks validated using `blocks`. Notification fallback text checked locally and retained in production. Evidence: `docs/slack-validation.json`, including the exact synthetic payload associated with each success. No actual workspace messages were sent.
- Manifest command/event declarations exactly match registrations. Expected bot scopes, Socket Mode, Home and interactivity flags match code. Required environment fields and bot/workspace startup checks tested.
- Governance tests verify HR-only access, append-only audit retrieval, governed submission events, retention configuration validation, and deletion of expired governed records.
- Source data remains preserved; source and content hashes recorded in `docs/source-provenance.json`.

Coverage at this run: handlers 85.78% branches / 97.10% functions; loaded source overall 89.51% branches. The unexecuted network startup entrypoint is excluded from these numbers. Line coverage is not presented as proof of end-to-end success.

## Not executed / release limits

- Authenticated manifest import/installation, real auth.test/Socket Mode connection, actual Slack DM/file delivery, real throttling/reconnection, desktop/mobile rendering, Block Kit Builder visual inspection and accessibility interaction.
- Docker build/Compose restart: Docker CLI was unavailable. A live checklist is in `docs/LIVE-QA.md`.
- Independent legal/content validation. Source guidance is retained, an answer key clarifies the ambiguous offense-history question, and explicit polarity fixes are versioned. An assessment is not clearance to act.
- Exactly-once external delivery is not guaranteed if Slack accepts an operation but its response is lost. Retries and potential duplicates are disclosed. In-flight states survive process termination and can be retried manually; there is no background worker.

Status: automated QA passed; ready for test-workspace installation and live acceptance testing. Not certified as production-verified.
