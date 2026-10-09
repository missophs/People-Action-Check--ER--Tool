# People Action Check — Slack app

An installable, single-workspace Slack Bolt app using Socket Mode, Block Kit, SQLite, and Word reports. Original content © Melissa A. Weiss; all rights reserved. No public redistribution license is granted by this project.

## Current cloud deployment

The existing Slack app runs on Cloudflare Workers with Supabase storage. The October 9 connection repair restored Slack interactivity and verified live history, assessment, policy and HR queue reads. See [repair evidence](docs/RESUME-2026-10-09.md) and [cloud deployment instructions](docs/CLOUD-CUTOVER.md). The instructions below describe the optional local Socket Mode installation; do not run it alongside the cloud connection.

## Install

1. Install Node.js 24 or newer (Node 24 LTS recommended).
2. At https://api.slack.com/apps choose **Create New App → From a manifest**, select your workspace, and paste `manifest.json`.
3. In **Basic Information → App-Level Tokens**, generate a token with `connections:write`. Save the `xapp-…` token.
4. **OAuth & Permissions → Install to Workspace**. Save the `xoxb-…` Bot User OAuth Token. Workspace approval may be required.
5. Copy `.env.example` to `.env`. Set both tokens, your workspace ID, and comma-separated HR member IDs (Slack profile → Copy member ID). Configure only trusted HR reviewers. Do not commit `.env`.
6. From this project folder run:

```sh
npm ci
npm test
npm run check
npm start
```

7. In Slack, open the app → Home, or run `/people-check`. No public URL or inbound port is needed. The process needs outbound HTTPS/WebSocket access to Slack and must remain running.

### Free Mac pilot operations

The included macOS service keeps the Socket Mode app running at login, restarts it after a crash, creates a verified SQLite backup at startup and every day at 2:00 AM, and retains the latest 14 backups. The Slack app remains usable from desktop, web, and mobile; only this host must stay awake, powered on, and connected to the internet.

```sh
chmod +x scripts/install-macos-service.sh
./scripts/install-macos-service.sh
npm run status
```

Backups are written to `backups/`; service logs are written to `var/log/`. Both directories and `.env` are excluded from the installable package and source control. Keep FileVault enabled and include the project folder in an existing encrypted Mac backup if available. This improves the free pilot but does not provide an enterprise SLA or off-site disaster recovery.

Scopes: `commands` starts checks; `chat:write` sends explicit HR notifications; `im:write` opens recipient DMs; `files:read` enables Slack's native modal file input and preserves uploaded document references; `files:write` delivers requested Word reports. `app_home_opened` refreshes the private Home tab. The app never reads channel history. Reinstall if scopes change.

## Workflow

Select one or more of 10 situations → read each overview, examples, documentation tips, watch-outs and HR guidance → answer five questions per situation with Yes, No or Don’t know and optional notes → review assessment, answer breakdown and recommended next steps.

Each submitted page is saved. All five answers are required to advance, but Save and close and Previous situation allow partial pages. Close and resume from Home; text not submitted with **Submit answers** is not saved. **Clear page** resets the current questionnaire page and persists the cleared page; **Save and close** pauses the check. Each situation presents a prominent numbered documentation checklist alongside its examples. Completed assessments place **Documentation & supporting evidence** near the top with a primary **Add documentation** action for notes, secure links, and up to five Slack files at a time. The documentation form has **Clear form** and **Save documentation** controls; clearing the visible form does not change the stored record until submission. Results also let managers edit answers, run again without overwriting history, download a Word report via the app DM, submit a snapshot to themselves and HR, set a follow-up date, or delete a check. HR reviewers can attach documents while saving their review. Combined results have numbered scenario navigation. **My history** gives each manager a private, paginated record of their own checks with totals, status, risk, updated dates, follow-up dates, and working View/Resume controls. Policy lists are paginated.

Managers can see **Company policies**, read policy text or approved links, and open related-policy guidance during a check. Their policy list is read-only: it contains no add, edit, delete, or upload controls. Only configured HR members can see **Add policy** and mutate policy records; every create, edit, and delete handler also enforces the server-side HR allowlist. **HR review queue** and **Governance Center** remain HR-only. HR sees only explicitly submitted snapshots, with New / In review / Closed status and internal review notes. Editing a personal check does not alter a submitted snapshot. Submission confirmation identifies configured reviewers.

HR members also see **Governance Center**, which reports data classification, authorized-reviewer count, retention configuration, record counts, control status, and recent append-only audit activity. Governed events include HR submission, evidence updates, report export, review decisions, policy changes, deletion, and retention purge. Configure `RETENTION_DAYS` from 1–3650; `0` disables automatic purge. See `docs/GOVERNANCE.md` before production use.

App Home keeps **My history** and **Refresh** at the top so they are always visible, followed by a compact three-item Recent activity preview. **Clear my history** opens a confirmation modal and then removes all personal checks from that user's Home. It does not remove immutable HR snapshots, Slack messages, or files already delivered; the audit log records the number of personal checks removed.

## Fidelity and deliberate Slack adaptations

- `src/content.js` preserves all 10 scenarios, 50 questions, hints, weights, critical flags, examples, documentation tips and all 90 recommended steps from the supplied HTML. The original `computeScore` is retained for legacy records; new checks use the explicit polarity corrections in `src/scoring.js`.
- Slack identity replaces Google sign-in. Server-side HR member allowlisting replaces the browser PIN. Workspace/owner checks protect personal records, including button actions.
- Private Home and modals replace browser cards. Native Slack styling replaces the original colors/fonts. Use `examples/*.json` in https://app.slack.com/block-kit-builder.
- Word reports delivered to DMs replace email, copy-to-clipboard and browser download. Explicit HR confirmation replaces the email/webhook delivery flow. Teams and SMTP integration are not included.
- Policy records accept text or approved document-system links. Supporting evidence accepts links/context plus PDF, Office, text, image, and CSV files through Slack's native modal file input. Slack workspace permissions and retention govern uploaded files; the app stores file references rather than a second document copy.
- Follow-up dates appear in Home; like the preview’s list, they do not send scheduled notifications. Blank the date to dismiss it.
- Personal records can be deleted individually. Bulk history reset, bulk policy reset, and HR-wide access to unsubmitted checks are intentionally not exposed.

## Scoring and content review

New checks use version 2 scoring. Six clearly risk-worded questions now score Yes as risk and No as confirmation: performance medical/leave factors, interpersonal escalation/protected characteristics, policy mitigating circumstances, termination legal exposure, and the two retaliation activity/timing questions. Unknown still contributes 75% of risk weight; a critical risky or unknown response forces High Risk. Weighted ratios up to 0.15 are 🟢 Low, up to 0.45 🟡 Medium, otherwise 🔴 High. The result explains the required response, and the same colored label appears in manager history, HR notifications, and the HR review queue. Answer counts show the actual responses, not the normalized calculation. Combined checks share one assessment across scenarios.

Older records without `scoringVersion: 2` retain their historical calculation and display a legacy warning. Edit and finish them to recalculate; already-submitted HR snapshots stay unchanged. No automatic migration rewrites historical assessments.

Question wording, examples, hints and recommended steps remain source content. The policy-violation question “Is this a first offense, or is there prior disciplinary history?” is ambiguous as Yes/No; the app now supplies an answer key for whether offense history has been established. Content-owner/HR review of inherited guidance remains necessary; automated software QA does not independently validate its legal statements.

## Hosting and data

Run one process on a persistent host; SQLite is not suitable for multiple replicas sharing this file. Keep `DATA_PATH` on persistent storage, restrict filesystem access, and use encrypted storage/backups. This is a single-workspace internal installation, not a multi-tenant OAuth/Marketplace distribution service. Use a separate app, process, credentials, and database per workspace.

The database contains employee names, answers, notes, policies and HR snapshots in plaintext; no external AI is used. Personal checks are restricted by Slack member ID. The configured retention job runs at application startup and removes expired personal checks and HR submissions; audit events remain for accountability. Slack administrators and hosting operators may have access under their organization’s policies. Deleting a local check does not delete uploaded Slack reports, linked documents, or HR snapshots. Slack retention applies to delivered files/messages. Back up the SQLite database using a consistent SQLite backup procedure; do not copy only the main file while WAL writes are active.

DM/file delivery may fail after a successful HR submission. The HR inbox snapshot is authoritative. **Submission delivery** shows each recipient's persisted status; **Retry failed deliveries** retries unsent recipients and skips confirmed successes. Repeating the same confirmation preserves the existing HR review. A new saved check revision produces a new snapshot. If the submitting user is also a configured HR reviewer, they receive their Word report once and can review the submission from the HR inbox.

After a crash, an in-flight delivery can remain “sending”; the submitter can retry from Submission delivery. There is no background delivery worker. If Slack accepted an operation but its response was lost, retrying can create a duplicate notification/file; exactly-once external delivery cannot be guaranteed. Explicit repeated Report-to-my-DM clicks can also create duplicate files.

Revision checks reject stale assessment, supporting-link, follow-up, policy and HR-review submissions. Buttons, callbacks and storage enforce both owner and record type. Request bodies and employee content are not logged by application error handlers. If Slack itself is unavailable, feedback cannot be rendered; persisted state can be checked after reconnection.

## Validation

`npm test`: real Slack Bolt dispatch with simulated WebClient responses, complete multi-scenario flow, partial save/resume, policy CRUD, HR sharing/review, retry/concurrency, access failures, stale edits, corrected scoring, real DOCX generation, and disk-backed persistence.

`npm run check`: validates required files, manifest/handler correspondence, limits and action mappings, and writes 79 synthetic Block Kit payloads. `npm run validate:slack` additionally calls Slack’s public `blocks.validate` endpoint; it sends synthetic example content only, respects rate limits, and caches successful validations by exact payload. Evidence is saved in `docs/slack-validation.json`.

Live installation checklist: open Home and command; select all 10 scenarios; save/resume and edit; verify a different non-HR member cannot access someone else’s record; submit to configured HR; open HR inbox and change status; receive Word report; add/edit/delete policy; set/dismiss follow-up; restart host and resume saved data. Live Slack testing requires your installed app credentials.

Slack references: https://docs.slack.dev/tools/bolt-js/ • https://docs.slack.dev/surfaces/modals/ • https://docs.slack.dev/reference/block-kit/ • https://docs.slack.dev/tools/node-slack-sdk/socket-mode/

### Optional Docker hosting

After configuring `.env`, run `docker compose up -d --build`. The named `pac-data` volume persists the database. `docker compose down` stops the app; do not add `--volumes` unless you intend to destroy saved data. Container builds and live hosting were not exercised during project generation.


## Audit and QA evidence

- [Audit findings](docs/AUDIT.md)
- [Feature → action → surface → handler → dependency → expected result → test inventory](docs/FEATURE-INVENTORY.md)
- [Validation results and limits](VALIDATION.md)
- [Live acceptance checklist](docs/LIVE-QA.md)

Run from the project directory. Node >=24 is required for built-in SQLite; this QA run used Node 26.8.1. `src/app.js` performs an authenticated `auth.test` before connecting and refuses a token from another workspace. No `.env` or tokens are included in the package.
