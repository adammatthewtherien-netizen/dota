# TI 2026 Spoiler-Free VODs — V10

V10 replaces YouTube search ranking with a deterministic recent-upload scan.

The importer now walks the official @dota2 uploads playlist page-by-page until it reaches an upload older than 30 days, then filters locally for:
- `[EN]` prefix
- `Team A vs Team B`
- `Game X`

This avoids `search.list` ranking omissions while still limiting processing to the recent TI window.

Elimination Round Series 2 Games 1 and 2 are also preloaded in `matches.json`.

The existing safe-push GitHub workflow from V9 is retained.
