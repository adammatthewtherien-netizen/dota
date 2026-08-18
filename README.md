# TI 2026 Spoiler-Free VODs — V9

## Fix for repeated GitHub push failures

The previous workflow successfully found and updated VODs, but failed on:

`[rejected] main -> main (fetch first)`

V9 hardens the GitHub Action so it:

- checks out the full repository history;
- prevents overlapping sync jobs with workflow concurrency;
- commits the generated `matches.json`;
- fetches the newest remote `main`;
- rebases the generated VOD commit on top of the latest `main`;
- falls back to a `matches.json`-only recovery if the rebase conflicts;
- pushes only after reconciling with the latest branch.

## What to update

The only file you actually need to replace is:

`.github/workflows/sync-youtube.yml`

Because `.github` may be hidden on Windows, the easiest method is to edit the existing workflow directly on GitHub.

Open:

`.github/workflows/sync-youtube.yml`

Click the pencil/edit icon, replace the contents with the version in this package, then commit.

Your existing:
- `YOUTUBE_API_KEY`
- importer script
- Vercel setup

do not need to change.
