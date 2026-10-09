# People Action Check governance standard

## Purpose and ownership

People Action Check is an internal decision-support system for managers and HR. It is not an automated employment-decision system and does not authorize an adverse action. HR owns the workflow, access list, policy content, retention period, and periodic control review. The application administrator owns hosting, credentials, backups, monitoring, and recovery.

## Data classification and minimization

Treat all records as **Restricted HR** data. Enter only information needed to assess the proposed action. Avoid medical details, government identifiers, financial-account data, passwords, or unrelated personal information. Uploaded documents remain subject to Slack workspace access and retention controls; the application stores file references rather than a second document copy.

## Access control

- Slack identity is the user identity. There are no shared application passwords or HR PINs.
- Personal checks are owner-scoped and private until the owner explicitly submits a snapshot.
- `HR_USER_IDS` is the server-side reviewer allowlist. Review it quarterly and immediately after role changes.
- Use a dedicated Slack app and database per workspace. Restrict the `.env`, database, backups, and host administrator access.
- Reinstall the app only after reviewing new OAuth scopes. Current scopes are documented in the README and manifest.

## Decision and review controls

- The app records guidance and risk signals; a qualified person remains accountable for every employment decision.
- Critical answers require HR/legal review before action.
- HR submissions are immutable snapshots. Later manager edits do not rewrite submitted evidence.
- HR review status follows **New → In review → Closed** and stores reviewer identity and timestamp.
- Supporting documents and links must be relevant, authorized, and accessible to the intended reviewers.

## Audit and monitoring

The Governance Center is available only to configured HR reviewers. The append-only audit table records actor, action, target type, opaque target ID, timestamp, and limited control metadata. It intentionally excludes employee names, answers, notes, document contents, and credentials. Governed events include submission, evidence updates, report export, review updates, policy changes, deletion, and retention purge.

Review the Governance Center monthly for unexpected access patterns, unresolved reviews, policy changes, and retention configuration. Application logs are deliberately redacted and should be monitored for repeated delivery or transport failures.

## Retention and deletion

Set `RETENTION_DAYS` to the organization’s approved HR-record retention period. The application purges expired checks and submissions at startup; `0` disables automatic purge and should require a documented exception. Audit events are retained for accountability. Slack messages and files follow separate workspace retention settings and may outlive the application record. Coordinate deletion requirements across the application database, Slack, backups, and linked document systems.

## Change management

Before each release:

1. Review manifest scopes, commands, events, and interactivity against the code.
2. Run the automated tests, local payload checks, Slack public validation, and live acceptance checklist.
3. Record the release owner, date, test evidence, known limitations, and rollback plan.
4. Obtain HR/content-owner approval for changes to questions, scoring, guidance, or recommended actions.
5. Reassess privacy, legal, security, accessibility, and records-management obligations.

## Incident response

For suspected unauthorized access or disclosure, stop the app, preserve audit and host logs, revoke affected Slack tokens, restrict workspace access, notify the organization’s security/privacy owners, and follow the approved incident-response process. Restore service only after credentials, access lists, affected records, and delivery destinations have been reviewed.
