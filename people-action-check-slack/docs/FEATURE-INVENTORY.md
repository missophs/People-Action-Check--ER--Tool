# Feature and interaction inventory

All registrations below are in `src/handlers.js` (`registerHandlers`). All Block Kit factories are in `src/views.js`. `src/app.js` loads configuration, verifies the bot workspace, opens SQLite, registers these handlers, and starts Socket Mode. `src/config.js` validates configuration. `src/scoring.js` contains the versioned scoring correction; original content is in `src/content.js`.

Tests: **I** = `test/interactions.test.js`; **R** = `test/robustness.test.js`; **U** = `test/app.test.js`. Descriptions identify named tests, not claims of live workspace execution. Network operations are substituted at the Slack WebClient boundary; real Bolt routing, real SQLite and real DOCX generation execute.

| Feature | User action / ID | Surface / payload factory | Handler | API / data dependency | Expected result | Automated test |
|---|---|---|---|---|---|---|
| Start | `/people-check` | command → `picker()` | command `/people-check` | `views.open` | private selection modal | I: real Bolt dispatch |
| Start from Home | `new` | `home()` | action `new` | `views.open` | selection modal | I: real Bolt dispatch |
| Refresh Home | open Home / `app_home_opened` | `home()` | event `app_home_opened` | check list by owner; `views.publish` | user's history and HR-only controls | I: real Bolt dispatch |
| Refresh / clear Home | top-level `refresh_home` / `clear_history` | `home()` / `clearHistoryForm()` | actions plus `clear_history_confirm` | owner-scoped bulk delete; explicit confirmation; audit | immediate refresh or cleared personal history | I: refresh and confirmed clear |
| Manager history | **My history** / View assessment / Resume check | `history()` / `historyCard()` | `my_history`, `history_page`, `open` | owner-scoped check records only | private totals, status/risk, dates, follow-ups, pagination, and record access | I: private history dispatch and paging |
| Visual risk result | submit final answer page / open saved or HR record | `result()` / `riskSummary()` | `answers`, `open`, `review` | polarity-aware weighted score; critical-response override | 🟢 Low, 🟡 Medium, or 🔴 High with scale and required response | U: scoring thresholds; I: manager and HR result rendering |
| History pages | `home_page`, `_nav1`, `_nav2` | `home()` | regex `^home_page(?:_nav\d+)?$` | scoped list; `views.publish` | bounded previous/next/refresh | I: real Bolt dispatch; R: route mapping |
| Select scenarios/name | inputs `scenarios`, `employee`, action `value` | `picker()` | submission `pick` | validate; store check; ack update | new draft, first scenario overview | I: all 10 scenarios |
| Read overviews | Continue | `wizard()` context | submission `context` | revision check; save; ack update | next overview, then questions | I: all 10 scenarios |
| Answer/note | `q0…q49`, `n0…n49`, action `value` | `wizard()` questions | submission `answers` | validation; scoped save | correct page answers/notes persisted | I: all 10 scenarios; R: limits |
| Next/back/save | `nav_<page>_<revision>`, action `value` | `wizard()` | submission `answers` | local state; ack update/clear | required answers only for Next; partial Save/back work | I: all 10 scenarios |
| Resume | `open` with check ID | `home()` → `wizard()` or `result()` | action `open` | typed owner lookup; `views.open` | resume saved page or result | I: all 10 scenarios |
| Assessment | final Next | `result()` | submission `answers` | `assessment()` | versioned risk, raw counts, guidance | R: six polarity corrections; U: boundaries |
| Browse result | `result_page_0…9` | `result()` | regex `^result_page_\d+$` | check/submission authorization; `views.update` | selected scenario, answers, notes | I: all 10 scenarios; HR snapshot |
| Edit | `edit` | `result()` → `wizard()` | action `edit` | check revision; store; `views.update` | editable answers; completion recalculates v2 | I: all 10 scenarios |
| Run again | `rerun` | `result()` → `wizard()` | action `rerun` | new check, old retained | fresh answers, same situations | I: all 10 scenarios |
| Documentation and supporting evidence | primary `Add documentation` → notes, links, and native file input | `result()` / `supportingForm()` | action `attachments`; submission `attachments_save` | owner/revision/length; Slack file metadata | saved documentation visible in manager + HR result and Word report | I: supporting links/files; HR snapshot; live Slack form QA |
| Word report | `export` | `result()` → `notice()` | action `export`; `deliverReport()` | `conversations.open`, docx, `files.uploadV2` | actual DOCX to invoking user's DM | I: Word report |
| Share confirmation | `share` | `shareForm()` | action `share` | completed personal check | explicit recipients and disclosure scope | I: HR snapshot |
| Submit snapshot | confirm Send | `shareForm()` → `deliveryView()` | submission `share_confirm` | immutable snapshot per check revision | one HR snapshot; existing review retained | I: HR snapshot / duplicate protection |
| Deliver submission | after confirmation | `hrMessage()` + `deliveryView()` | `sendPending()` | DOCX to owner; HR DMs via `conversations.open`, `chat.postMessage` | per-recipient sent/failed status persisted | I: HR snapshot; R: concurrent retry |
| Delivery history | `submission_status` | `result()` → `deliveryView()` | action `submission_status` | owner check; latest personal submission | saved delivery status or no-submission notice | I: HR snapshot |
| Refresh delivery | `delivery_status` | `deliveryView()` | action `delivery_status` | submitter-only snapshot lookup | current durable status | I: HR snapshot; access guards |
| Retry failed delivery | `retry_delivery` | `deliveryView()` | action `retry_delivery`; `sendPending()` | persisted delivery state; in-process lock | retries unsent recipients; skips sent | I: HR snapshot; R: double-click retry |
| Follow-up | `followup` → `date` / `value` | `followupForm()` | action `followup`; submission `followup_save` | date/revision validation; store; publish | date appears in Home, blank removes | I: supporting links and follow-up |
| HR inbox | `inbox` | `inbox()` | action `inbox` | HR allowlist; submissions; `views.open` | only explicitly shared records | I: HR snapshot; access guards |
| Governance Center | `governance` | `governanceCenter()` | action `governance` | HR allowlist; audit table; retention configuration; record counts | control status and recent governed activity | I: HR governance access/audit; R: retention |
| Inbox pages | `inbox_page`, `_nav1`, `_nav2` | `inbox()` | regex `^inbox_page(?:_nav\d+)?$` | HR allowlist; `views.update` | previous/next/refresh | I: HR snapshot; R: route mapping |
| Review from inbox/DM | `review` | `inbox()` / `hrMessage()` → `result(hr=true)` | action `review` | HR allowlist; typed submission; open/update | all scenario details/supporting text | I: HR snapshot; access guards |
| Save HR review | `status`, `reviewNote`, action `value` | `result(hr=true)` | submission `result` | HR/review revision; store | status/note saved, stale edits rejected | I: HR notes; R: review paging |
| Policy library | `policies` | `policyList()` | action `policies` | team policy list; open from Home/push from modal | library overlays without losing question entry | I: policies |
| Policy pages | `policy_page`, `_nav1`, `_nav2` | `policyList()` | regex `^policy_page(?:_nav\d+)?$` | team policy list; `views.update` | bounded previous/next/refresh | I: policies; R: route mapping |
| Read policy | `read_policy` | `policyRead()` | action `read_policy` | typed policy lookup; mutation controls omitted for managers | complete text/URL, back control | I: manager read-only policy access; wrong-type rejection |
| Add policy | `add_policy` | `policyForm()` | action `add_policy` | HR allowlist; `views.open` | required name/content/category form | I: policies |
| Edit policy | `edit_policy` | `policyForm()` | action `edit_policy` | HR allowlist; typed lookup; `views.update` | prefilled policy form | I: policies |
| Save policy | `name`, `category`, `content`, action `value` | `policyForm()` | submission `policy_save` | HR/revision validation; store | shared policy created/updated | I: policies |
| Delete check/policy | `delete_check`, `delete_policy` | `deleteForm()` | action `delete_<type>` | ownership/HR check | explicit confirmation | I: HR notes; policies |
| Confirm deletion | Delete submit | `deleteForm()` | submission `delete_confirm` | typed scoped delete; publish | record deleted; shared snapshots retained | I: HR notes; policies |
| Errors | invalid/stale/failed request | `notice()` or field errors | registration wrapper | ack / update / open / publish | redacted, user-visible feedback when Slack available | I: database failure; stale forms; API failure |
| Native modal close | Close / X | all modals | Slack native behavior | no `notify_on_close` | dismisses without saving unsubmitted input | documented; live smoke checklist |

## Inputs versus button callbacks

All input elements use `action_id: value`, scoped to their unique block IDs. `dispatch_action` remains false: select menus and text fields are collected by the modal submission callback. They do not require an `app.action('value')` handler. Only views with a submit button generate a submission; informational `notice`, `policy_list`, `policy_read`, `inbox`, and `delivery` views have no submit. A personal `result` has no submit; the same callback is used only when an HR result contains the review form.

Pagination button IDs are made unique within each actions block; the `_navN` regex handlers cover those generated variants. Numeric page inputs are bounded. Scenario buttons carry a record ID, page and HR-mode flag; HR status is rechecked server-side and never trusted from that flag.

## Configuration and API contract

| Configuration | Required | Purpose / verification |
|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | `xoxb-`; `auth.test` checks configured team and bot at startup |
| `SLACK_APP_TOKEN` | Yes | `xapp-`; app-level `connections:write` for Socket Mode |
| `SLACK_TEAM_ID` | Yes | single team allowlist, every routed request checked |
| `HR_USER_IDS` | Yes | 1–20 unique `U…`/`W…` IDs; all HR actions checked |
| `DATA_PATH` | No | SQLite file, default `./data/pac.sqlite` |

Manifest is checked against actual registered command and event lists. No shortcuts are registered or advertised. `commands`, `chat:write`, `im:write`, `files:read`, and `files:write` cover the APIs and native file inputs used. `views.open/update/push/publish` use the installed bot; no channel-history scope is needed. `files.uploadV2` in installed WebClient uses getUploadURLExternal → upload bytes → completeUploadExternal, not deprecated files.upload. Socket Mode needs no signing secret, request URL or inbound port. Reinstallation is required when scopes change.

## Independent evidence / remaining limits

`npm test` runs real Bolt dispatch with network methods replaced, not a live Slack workspace. `npm run check` validates every synthetic fixture and checks every generated action/submission against registrations. `npm run validate:slack` sends those fixtures to Slack's public validation API. JSON files can be pasted into Block Kit Builder; Builder rendering and mobile/desktop user interaction remain live acceptance checks. No automatic follow-up messages, email, PDF ingestion, Teams, or OAuth distribution are advertised or implemented.
