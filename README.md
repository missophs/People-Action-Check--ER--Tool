# People Action Check

A Slack app that gives managers guided decision support on 10 employee-management situations, and gives HR a protected queue for the cases managers choose to escalate.

https://github.com/user-attachments/assets/6f710d94-98a3-4082-a42a-09a5e0012c86


<!-- VIDEO: on github.com, edit this file and drag pac-demo.mp4 here; GitHub inserts the link. -->

## The problem

Managers act on employee issues without knowing what to document, how risky the situation is, or when to bring in HR. That is where repeat issues, escalations, and legal exposure start.

## How it works in Slack

1. **Pick the situation.** Performance decline, attendance, interpersonal conflict, policy violation, termination consideration, accommodation request, harassment or discrimination, retaliation concern, reduction in force, and more. Work stays private until the manager chooses to submit a snapshot to HR.
2. **Answer guided questions.** Each has an optional note and a "why this matters" line. Critical questions, such as possible leave or accommodation factors, tell the manager to stop and consult HR before acting if the answer is yes or unsure.
3. **Review the assessment.** Answers roll up to one of three risk levels (Low, Medium, High). High risk reads: stop, HR and when appropriate legal review are required before action.
4. **Escalate on purpose.** Submitting to HR is an explicit step. The manager also gets a private history of their own checks that only they can access.

## What each side gets

| Managers | HR |
| --- | --- |
| Assess: 10 situations, 50 questions, three risk levels | Receive: private alerts and a protected review queue |
| Document: notes, links, files, Word reports | Review: submitter names, risk ratings, attachments |
| Continue: save and resume, private history, policy viewing | Respond: status, review notes, manager notification |
| Escalate: explicit private submission to HR | Manage: add, edit, and delete policies |

## Governance and privacy

- **Access:** Slack identity, owner checks, and an HR allowlist.
- **Privacy:** private drafts, and fixed snapshots at the moment of submission to HR.
- **Control:** restricted policy administration, retention rules, and audit history.
- **Recovery:** delivery retry and daily verified backups.
- Supports manager and HR decision-making. It does not make employment decisions, and human review is required for any employee action or escalation.

## Access and data

- One shared app for Slack workspace members, so there is no separate installation per manager.
- Works on desktop, web, and mobile Slack.
- App records are stored in SQLite. Messages and files stay in Slack's own retention.

## Results

The Slack workflow, deployed with a DHW Consulting client, reduced employee-relations risk exposure 20%, measured by fewer escalations and repeat issues.

## Web version

A browser version of the same check is live at [peopleactioncheck.netlify.app](https://peopleactioncheck.netlify.app). It has the same 10 situations, risk levels, session history, follow-up reminders, a Word report download, and an HR dashboard.
