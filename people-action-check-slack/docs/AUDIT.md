# Repository audit — before repairs

Reviewed the application source, inherited content/scoring, manifest, environment template, Docker/Compose files, dependency declarations/lock versions, README, prior validation claims, tests, validator and all eight generated example payloads.

Architecture: Node >=24 ESM; Slack Bolt 4.7.3; Socket Mode; docx 9.8.1; node:sqlite; single workspace/process. Entry: src/app.js. No shortcuts, HTTP endpoints, external identity provider, email, Teams, AI, or scheduled jobs. Slash command: /people-check. Event: app_home_opened. Scopes: commands, chat:write, im:write, files:read, files:write; app token connections:write. Four required Slack/HR environment variables plus optional DATA_PATH and RETENTION_DAYS.

## Findings in original delivery

| Severity | Finding | Evidence / consequence |
|---|---|---|
| High | Risk-answer polarity reversed | Original computeScore treats every Yes as safe, including six clearly risk-worded questions. A caveat does not correct an incorrect assessment. |
| High | Silent HR delivery failures | share_confirm discards Promise.allSettled results. UI never reports which deliveries failed or offers retry. |
| High | Repeated submission resets review | INSERT OR REPLACE uses same check/revision-derived ID with New status, overwriting existing HR notes/status. |
| High | Record type not checked | get checks owner only; team-shared policy and submission records share the same owner namespace. A wrong-type ID can bypass intended HR-only record separation. |
| Medium | Supporting links invisible to HR | Stored and in Word report, absent from result modal used by HR. |
| Medium | Runtime errors are not user-facing | Generic app.error logs only; stale/deleted/unauthorized/API/storage errors can leave dead controls or submission timeout. |
| Medium | Partial save blocked | All question inputs required; save/back require all five answers. |
| Medium | Navigation state sticky across updates | Same nav input ID across pages lets Slack preserve Previous or Save rather than new intended default. |
| Medium | Cross-window edits not consistently guarded | Only context/answer saves compare revisions; HR review is last-write-wins. |
| Medium | Unbounded related-policy summary | Many policy names can exceed a 3,000-character section. |
| Medium | Configuration only checked for nonempty placeholders | Invalid HR IDs and bot/workspace mismatch can reach production. |
| Medium | Tests do not execute app handlers | Five tests exercise render helpers/scoring/store but not actual commands/actions/submissions/API failures. “Persistence” test uses only :memory:. |
| Low | Policy required fields marked optional | Errors attached to name even if content missing; category is not validated server-side. |
| Low | Incomplete examples/validation coverage | No supporting-link/follow-up/delete/share/error/inbox/message payloads. |
| Low | Missing empty states; unsafe pagination assumptions | Deleted last page can render an empty page; invalid page values unchecked. |

Known scope adaptations are documented, not missing handlers: no email/Teams, PDF viewer/file ingestion, automatic reminder messages, bulk resets or Marketplace OAuth. Current UI does not advertise these. Native Slack close buttons need no backend handler unless notify_on_close is enabled; input select values are submitted via view callback, not standalone actions.

Repair plan: retain content and existing flow, isolate handler registration from process startup to test real handler code, enforce typed ownership/revisions, report/retry deliveries without replacing snapshots, fix clear scoring polarity errors, bound/render all content, test every interactive route and failure branch, validate generated surfaces against Slack, update install/QA docs and package.

## Repair disposition

- Implemented and regression-tested: explicit v2 scoring polarity, visible delivery outcomes and retry, duplicate snapshot/review preservation, typed storage authorization, HR evidence visibility, user-facing errors, partial saves, fresh navigation IDs, optimistic review/policy/supporting/follow-up revisions, bounded policy summaries, strict configuration, handler-level and disk-backed tests, required policy validation, complete payload fixtures and bounded pagination/empty states.
- Additional bug found while tracing native surfaces: Company policies used `views.push` whenever `body.view` existed, including App Home. It now uses `views.open` from Home and pushes only from a modal. Regression test runs real Bolt routing for both branches.
- Version 1.2 adds an HR-only Governance Center, append-only governed-event audit records, startup retention enforcement, document evidence inputs, richer HR notifications, and a consistent Block Kit hierarchy across primary surfaces. Audit metadata excludes employee content and credentials.
- Original content preserved; new `scoring.js` corrects six explicit polarity errors. The ambiguous policy offense-history question has an answer key in UI/reports. Existing assessments retain their legacy version until explicitly recalculated. Inherited HR/legal prose is not independently certified by software tests.
- State and side effects are tested through actual Bolt `App.processEvent`, including ack behavior. External Slack responses are test doubles, identified as such. No simulated data is used by production handlers.
- Final authenticated installation, Socket Mode connection, actual delivery and desktop/mobile visual acceptance are not claimed: user chose automated QA first. Docker CLI was unavailable. See LIVE-QA.md.

## Current Slack references consulted

- https://docs.slack.dev/tools/bolt-js/concepts/acknowledge/ — acknowledge interactive requests within three seconds; slow uploads run after acknowledgement.
- https://docs.slack.dev/reference/views/modal-views/ — modal fields, max 100 blocks, submit required with inputs, matching block/action IDs preserve entered values.
- https://docs.slack.dev/reference/block-kit/blocks/input-block/ — input dispatch_action defaults false; form values arrive with submission.
- https://docs.slack.dev/reference/block-kit/block-elements/button-element/ — action/value limits and accessible button labels.
- https://docs.slack.dev/reference/app-manifest/ — Socket Mode, event and interactivity settings.
- https://docs.slack.dev/reference/methods/conversations.open/ — im:write for 1:1 DM opens.
- https://docs.slack.dev/reference/methods/files.completeUploadExternal/ — files:write for modern uploads.
- https://docs.slack.dev/reference/methods/blocks.validate/ — public payload schema validation; Retry-After handling.

The public validator rejected a full message object containing top-level text as an additional property, although chat.postMessage supports that required accessibility fallback. The validator script therefore validates message blocks using the `blocks` parameter and checks fallback text locally. View objects are validated whole. The runtime message retains its fallback text.
