# Live Slack acceptance record

## Executed September 29, 2026

Tester: Codex, using synthetic unnamed-employee data in the **People Action Check** workspace (`T0C4XUJ6N31`) and Slack app `A0C5HG86AVA`. Tokens are stored only in the ignored local `.env` file.

- Imported manifest and installed the app with the four declared bot scopes: `commands`, `chat:write`, `im:write`, and `files:write`.
- Generated an app-level token limited to `connections:write`; Socket Mode connected successfully.
- Ran `/people-check` in `#new-channel`. The workflow opened privately as a modal and posted no check content to the channel.
- Selected **Performance Decline**, viewed its overview, completed all five questions, and received the expected **Low Risk** result for four Yes answers plus No on the critical medical/accommodation factor.
- Confirmed the completed check appeared in App Home session history.
- Used **Report to my DM** and confirmed a real `people-action-check.docx` attachment appeared in the private app conversation.
- Re-ran the 23-test automated suite after configuration; all tests passed.

## Version 1.2 governance and design acceptance

- Reinstalled the app with `files:read`; verified all five required bot scopes are active.
- Restarted Bolt version 1.2.0 and confirmed Socket Mode connected.
- Corrected the HR allowlist to the workspace member ID that owns the existing checks.
- Refreshed App Home and confirmed the enterprise layout, HR reviewer banner, **HR review queue**, **Governance Center**, and policy controls render correctly.
- Opened Governance Center and confirmed Restricted HR classification, one authorized reviewer, 365-day retention, control status, governed record counts, and audit empty state.
- Opened an existing assessment and confirmed the redesigned summary, risk context, situation navigation, supporting-evidence section, and action groups.
- Opened Supporting evidence and confirmed Slack renders the native **Upload File** control plus links/context and save actions.
- Version 1.2 automated evidence: 25 tests passed; 80 synthetic Block Kit payloads passed local validation and Slack's public validation API.
- Added explicit **Clear page / Submit answers** and **Clear form / Submit evidence** controls; automated coverage increased to 26 passing tests.
- Restarted the live app and confirmed Slack renders both control pairs in the questionnaire and evidence modal. The existing draft was not cleared during QA.
- Confirmed the final policy model: managers can list/read policies and see related guidance, while only configured HR reviewers receive Add/Edit/Delete controls. Automated tests verify manager policy views are read-only and forged mutation actions return HR access required.
- Moved **Refresh** to the top of App Home and added **Clear my history** with explicit confirmation. Automated coverage verifies refresh publishes immediately and history is unchanged until confirmation.
- Live Slack verification passed: Refresh disabled briefly while publishing and re-enabled on completion; Clear my history opened a confirmation showing two personal checks. The confirmation was closed without deleting the test history.
- Added a dedicated private **My history** modal for managers, plus a compact Recent activity preview on Home. Automated tests cover owner-only access, totals, paging, refresh, and View/Resume routing.
- Live Slack verification passed for **My history**: the modal showed 2 total checks (1 completed and 1 in progress), displayed the expected risk/status and dates, included Refresh, and opened the saved assessment from **View assessment** in the same modal.
- Made documentation a primary workflow section. Live Slack verification confirmed **Documentation & supporting evidence** appears directly under the assessment risk summary, **Add documentation** is prominent, and the form shows examples plus notes/links, Upload File, Clear form, and Save documentation controls.
- Added Slack-native color distinction to the guidance headings: **🟦 Common examples** and **🟨 Documentation checklist**. Live verification confirmed both markers and headings render correctly.
- Added a consistent visual risk scale across assessment results, manager history, HR notifications, and the HR queue: **🟢 Low**, **🟡 Medium**, and **🔴 High**. Each result now explains the action expected at that level.
- Reworked recorded-answer review so each question has its own heading and each response is a distinct **🔷 ANSWER** line with a separate **📝 NOTE** line. Live Slack verification confirmed all five responses are easy to distinguish.
- Replaced the technical delivery screen with a human-readable confirmation. Live Slack verification showed **Submitted successfully**, the risk scale, **HR review queue: Saved**, and **Manager report: Delivered**; retry guidance now appears only for real failures.
- Closed the HR response loop: saving an HR review now sends the submitting manager a private **HR review update** with risk, status, and HR note. Automated interaction tests cover successful notification and audit logging.
- Diagnosed suppressed HR alerts in the live workspace: Melissa's Slack working hours started at 9:00 AM while testing occurred around 7:00 AM. Updated weekday notification hours to 7:00 AM–5:00 PM.
- Replaced exposed Slack member IDs and raw ISO timestamps with native, clickable Slack member names and locally formatted dates in the HR queue, review form, reviewer list, and governance audit. Live verification confirmed the new submission renders as `@mel` (the member's current Slack display name) and `Today at 8:24 AM` instead of `U0C5GR056Q5` and an ISO timestamp.

The broader multi-user, HR delivery, concurrency, outage, Docker, and mobile-rendering cases below remain an acceptance checklist for a production deployment. The automated suite covers their backend behavior with fixtures, but they were not all exercised manually in this one-member workspace.

Use an isolated workspace with two ordinary members and two HR reviewers, synthetic employee data only. Install the manifest, configure `.env`, start the single app process, and keep private storage persistent.

1. Import manifest and install. Confirm exactly four bot scopes and app-level connections:write. Verify `/people-check`, Home and interactivity; no shortcuts should appear.
2. Open Home as an ordinary member and an HR reviewer. Only HR sees inbox/policy edit controls. Open Company policies from Home (modal must open, not fail with push-related errors).
3. Run `/people-check` in a channel. Nothing about the check should be posted in that channel. Select all 10 scenarios and read every overview.
4. Answer one question, add a note, Save and close, restart the app, Resume. Partial answer and note must remain. Advance with missing answers: field errors. Complete pages, go Back, change an answer, go Next: navigation must not get stuck on Back.
5. While answering, type a note and open Company policies. Read/back/close the overlay; unsaved question entry must still be present. Confirm correct related categories and lengthy policy display.
6. Complete a low-risk and high-risk fixture. For medical factors, Yes must elevate critical risk and No must not. Unknown on critical questions must elevate risk. Compare counts to actual selected values. Verify each scenario result page.
7. Add supporting text/links, reopen results, and export Word report. Check the private app DM, complete report content, no channel exposure and readable DOCX. Links are stored as text; verify access separately in the document system.
8. Send to me and HR. Review disclosure confirmation. Verify owner Word report, HR notification, inbox snapshot, supporting text, all scenario pages, status/note edit and save. Submit same revision again: no reset of status/note or duplicate confirmed deliveries.
9. Simulate a failed recipient in an isolated installation (e.g. temporarily use a syntactically valid nonexistent HR ID). The failure must appear in delivery status. Restore a working setup; do not assume changing the HR environment rewrites recipients on existing snapshots. New submissions use the new list. Verify retry mechanics on a transient failure and successful-recipient skipping.
10. Open the same review in two sessions. Save one; the stale submission must be rejected. Verify unsaved notes/status survive numbered scenario navigation in desktop and mobile Slack.
11. Create/edit/read/delete a policy as HR; ordinary users may only read. Confirm delete dialog. Confirm deleting a policy from an overlay leaves the underlying check available.
12. Set, reopen and dismiss a follow-up date. No automated reminder message is expected.
13. Delete personal history entry. Ensure the explicit HR snapshot and previously delivered file remain (as disclosed). Run again should preserve the original check.
14. Revoke app token or simulate outage. Confirm failure recovery after reconnection, redacted logs, and persisted data. Verify startup refuses mismatched bot/workspace.
15. Paste example JSON into Block Kit Builder and inspect desktop/mobile layouts, navigation labels, long text, screen-reader fallback, and focus behavior. Public schema validation cannot establish visual usability.

Record tester, app/workspace IDs (never tokens), date, outcome and screenshots using synthetic data. Docker build/restart must also be exercised if deploying with Compose; Docker was unavailable in the audit environment.
