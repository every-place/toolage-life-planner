# LifePlanner by Toolage

A companion web app for a paper, two-page-per-day planner. Plan your day with a
prioritized ABC task list, mark status the way you do on paper, and forward
unfinished tasks with one tap while keeping their full history.

Part of the [Toolage Works](https://www.toolageworks.com) family of apps.

## What works today

- Daily page with the fixed daily tasks (Pray, Read, Plan, Record, Prepare, Relax by default)
- Prioritized Daily Task List: A = Must, B = Should, C = Want, numbered A1, A2, B1…
- Status column: blank, dot (in work), check (complete), arrow (forwarded), X (cancelled); tap to cycle blank → dot → check → X → blank
- Delegation: circled initials to the left of the status column
- Margin tags, such as B for one employer and E for another business
- Forwarding: a forwarded task keeps its letter and goes to the top of that letter on the
  new day. It keeps its creation date, and every forward is recorded in its history.
- "Forward unfinished" at the end of the day
- Goals with ordered steps, a margin tag (B, E, or none) and a target date, filterable by tag
- Put a goal step on a day as a task; it carries the goal's tag, and checking the task checks the step
- Link any task to a goal from the task list or its detail sheet
- Month calendar for future events; each event shows under Appointments on its day's page
- On paper: a pen mark on every task, event and goal shows it's written in the paper planner; forwarded tasks and moved events reset it
- Photos of handwritten notes on each task (take with the camera or choose from the library), kept with the task when forwarded and included in backups
- Margin letters editor in Settings, also reachable from any tag dropdown (Edit letters…)
- Settings for daily tasks, tags and priority symbols (use a ♥ if you like), plus backup and restore

Data is stored in the browser for now. Sync between phone and computer and
Google Calendar/Tasks sync are next.

## Develop

```sh
npm install
npm run dev     # local server
npm test        # unit tests for ranking and forwarding
npm run build   # production build in dist/
```

Pushing to `main` deploys to GitHub Pages (Settings → Pages → Source: GitHub Actions).
