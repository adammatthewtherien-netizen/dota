# TI 2026 Spoiler-Free VODs — V6

This version fixes the YouTube 404 `playlistNotFound` error.

## Fix
The importer no longer uses a hard-coded YouTube channel ID. It resolves the official Dota 2 channel from:

`@dota2`

and then retrieves that channel's uploads playlist through the YouTube Data API.

The existing safeguards remain:

- only uploads from the last 30 days;
- only titles beginning with `[EN]`;
- flexible parsing of `Team A vs Team B ... Game X`;
- automatic Group Stage backfill;
- automatic Main Event additions;
- scheduled GitHub sync every 15 minutes.

## Update
Replace the files in your GitHub repository with this package. The most important changed file is:

`scripts/sync-youtube.mjs`

Then commit the changes and run:

**Actions → Sync TI 2026 YouTube VODs → Run workflow**

Your existing `YOUTUBE_API_KEY` secret does not need to be changed.
