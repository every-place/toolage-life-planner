# Task inbox: sending tasks to LifePlanner

Other systems can send tasks to your LifePlanner inbox: a Claude project, a
script, another app's export. Tasks land **without a priority** in the Inbox
above the task list. While planning, tap A, B or C on each one to put it at the
bottom of that letter on the day you're looking at, or ✕ to dismiss it. A
planned task keeps where it came from (shown in its detail sheet).

## Turn it on

1. Sign in with Google in Settings (the inbox lives in your cloud copy).
2. Settings → **Task inbox** → **Turn on task inbox**. This makes a private key.
3. Use **Copy instructions for Claude**, **Copy address** or **Copy example**.

Tasks wait in the cloud until LifePlanner is open on one of your devices, then
move into the inbox and sync everywhere. **Make a new key** replaces the key
(the old one stops working); **Turn off** stops all intake.

The key lets anyone who has it *add* tasks to your inbox. It can't read or
change anything. Keep it private, and make a new key if it leaks.

## Sending a task (HTTP)

```
POST https://firestore.googleapis.com/v1/projects/toolage-life-planner/databases/(default)/documents/intake/<KEY>/tasks
Content-Type: application/json

{"fields": {
  "title":  {"stringValue": "Review the draft spec"},
  "source": {"stringValue": "Claude: My project"},
  "tag":    {"stringValue": "E"},
  "notes":  {"stringValue": "Optional details."}
}}
```

The body is Firestore's REST format: every value is `{"stringValue": "..."}`.
No other headers or sign-in are needed.

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | The task, up to 300 characters. |
| `notes` | | Details, up to 5,000 characters. |
| `tag` | | Margin letter, 1–2 characters (for example B or E). |
| `due` | | Due date, `YYYY-MM-DD`. Shown in the inbox, which lists soonest due first. |
| `priority` | | `A`, `B` or `C`. Only a suggestion: the button is highlighted, you still choose. |
| `source` | | Where it came from, shown on the task (for example `Claude: Spec work`). |
| `link` | | A link back to the item in the other system. |
| `id` | | The sender's own id for the task. A repeat with the same id is skipped. |

Any other field is refused. To make a send safe to repeat, also add
`?documentId=<id>` (letters, digits, `-`, `_`) to the URL; a second send with the
same id is either refused with `409 ALREADY_EXISTS` or skipped by the app.

Replies: `200` with a `name` means it arrived. `403` means the key is wrong or
turned off, or a field is not allowed.

## From a Claude project

Copy **instructions for Claude** from Settings and paste them into the
project's instructions. They contain your key, the format above and your margin
letters. Then ask, for example, "send these action items to my planner".
Claude needs a tool that can make web requests for this (Claude Code and
project threads can, using `curl`).

## Importing a list or an export file

Settings → **Import tasks from a list or file…** (or **Import** in the inbox
header) works without signing in. Paste text or choose a file:

- **JSON**: one task, a list of tasks, or `{"tasks": [...]}`. Plain field names
  (not the Firestore format). Common names from other apps also work:
  `name`/`content`/`summary` for the title, `description` for notes,
  `dueDate`/`due_date` for the due date, `url` for the link.
- **CSV** with a header row that has a `title` (or `task`, `name`, `summary`)
  column.
- **Plain text**, one task per line. List bullets and `[ ]` checkboxes are
  removed. Start a line with a margin letter, like `[B] Send slides` or
  `E: Renew license`, to tag it.

## Security rules

The inbox needs the rules in `firestore.rules` to be published (Firebase
console → Firestore → Rules → paste → Publish). They allow:

- `intakeKeys/{key}`: created and removed only by its owner; nobody can list them.
- `intake/{key}/tasks/{id}`: anyone may *create* a valid task when the key is
  live; only the key's owner can read and clear it.
