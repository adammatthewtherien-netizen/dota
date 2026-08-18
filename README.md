# TI 2026 Spoiler-Free VODs — V5

## Import rules

The automatic importer now applies three main safeguards:

1. **Last 30 days only** — uploads older than 30 days are ignored.
2. **English only** — the YouTube title must begin with `[EN]`.
3. **Loose match/game parsing** — after `[EN]`, the importer looks primarily for:
   `Team A vs Team B ... Game X`

It accepts common separators such as hyphens, pipes, colons and different dash characters.

This makes the importer less dependent on exact suffixes such as `Group Stage`, `Main Event`, or `The International 2026`, while the 30-day cutoff and `[EN]` requirement keep false matches low.

## Automatic syncing

The GitHub Action checks the official Dota 2 uploads playlist every 15 minutes.

Required repository secret:

`YOUTUBE_API_KEY`

After uploading this version, run:

**GitHub → Actions → Sync TI 2026 YouTube VODs → Run workflow**

The log will show the 30-day cutoff and how many English VODs were parsed.
