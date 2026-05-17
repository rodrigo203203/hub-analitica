---
description: "Commit messages (Odoo Git guidelines)"
alwaysApply: true
---

Follow [Odoo Git guidelines](https://www.odoo.com/documentation/19.0/contributing/development/git_guidelines.html).

**Structure:**
- **Line 1:** `[TAG] module: short description` (max ~50 chars).
- **Body:** Explain **why** (WHY), not what; end with references (PRCS-XXXX, task-XXXX, Fixes #N, opw-N).

**Valid tags:** [FIX] bug fixes, [IMP] improvements, [ADD] new modules, [REF] refactoring, [REM] remove, [REV] revert, [MOV] move, [REL] release, [MERGE] merge, [I18N] translations, [PERF] performance, [CLN] cleanup, [LINT] linting.

**Header rule:** The subject must form a valid sentence with "if applied, this commit will &lt;subject&gt;" (e.g. `[IMP] website_helpdesk: restrict team visibility for portal users`).

**Ticket:** Include ticket reference in body or at end when applicable (e.g. TECNO-2288, task-2288).

**Do not** add any trailer or attribution to commits (e.g. do not use `--trailer "Made-with: Cursor"` or similar in commit commands or in the message body).

**Example:**
```
[IMP] website_helpdesk: restrict team visibility for portal users

Allow controlling which helpdesk teams are visible to portal users vs guests.
Add website_visibility field and filter in controller.

TECNO-2288
```
