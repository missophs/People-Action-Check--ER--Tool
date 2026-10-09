# Cloudflare + Supabase cutover

`src/worker.js` receives Slack Events API, slash-command and interactive payloads at `/slack/events`. It size-limits each request, checks its timestamp, verifies Slack's HMAC signature, acknowledges Slack within 2.7 seconds and completes handler work with `waitUntil`.

Records live in the existing Supabase project in `pac_records`; governance activity lives in `pac_audit_events`. Row Level Security is enabled and `anon` and `authenticated` have no table privileges. Only the protected Worker service key can access these tables. Slack users never receive database credentials.

Protected Worker settings are `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_TEAM_ID`, `HR_USER_IDS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and optional `RETENTION_DAYS`. Never put their values in the manifest, source control, screenshots or chat.

## Cutover order

1. Apply `supabase/001_people_action_check.sql` in Supabase.
2. Deploy with `npx wrangler deploy` and add the protected Worker settings.
3. Migrate SQLite records once with `npm run migrate:supabase`.
4. Generate the HTTP manifest with `npm run manifest:http -- https://people-action-check.performance-check-in.workers.dev` and apply it in Slack.
5. Confirm Slack verifies the Event Subscriptions URL, then reinstall if Slack requests scope consent.
6. Stop the Mac Socket Mode process. Do not run HTTP delivery and Socket Mode simultaneously.
7. Test as manager and HR: Home, history, policies, evidence, HR notification, review response and risk display.

Rollback by restoring the Socket Mode manifest and restarting the local service. Supabase records remain intact.
