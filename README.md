# LifePlanner by Toolage

A companion web app for a paper, two-page-per-day planner. Plan your day with a
prioritized ABC task list, mark status the way you do on paper, and forward
unfinished tasks with one tap while keeping their full history.

Part of the [Toolage Works](https://www.toolageworks.com) family of apps.

## What works today

- Daily page with the fixed daily tasks (Pray, Read, Plan, Record, Prepare, Relax by default)
- Prioritized Daily Task List: A = Must, B = Should, C = Want, numbered A1, A2, B1…
- Status column: blank, dot (in work), check (complete), arrow (forwarded); tap to change
- Delegation: circled initials to the left of the status column
- Margin tags, such as B for one employer and E for another business
- Forwarding: a forwarded task keeps its letter and goes to the top of that letter on the
  new day. It keeps its creation date, and every forward is recorded in its history.
- "Forward unfinished" at the end of the day
- Settings for daily tasks, tags and priority symbols (use a ♥ if you like), plus backup and restore

Data is stored in the browser for now. Sync between phone and computer, goals,
the monthly calendar and Google Calendar/Tasks sync are next.

## Develop

```sh
npm install
npm run dev     # local server
npm test        # unit tests for ranking and forwarding
npm run build   # production build in dist/
```

Pushing to `main` deploys to GitHub Pages (Settings → Pages → Source: GitHub Actions).
