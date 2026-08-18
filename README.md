# TI 2026 Spoiler-Free VODs — V8

## New: team names hidden

The website no longer renders team names at all.

Internally, `matches.json` still keeps the real team names because the importer needs them to match official YouTube uploads. The browser only renders `displayLabel`.

Examples:

- `Round 1 Series 1`
- `Elimination Round Series 3`
- `Upper Bracket Series 1`
- `Lower Bracket Series 2`
- `Main Event Series 1`

If an official Main Event YouTube title includes `Upper Bracket`, `Lower Bracket`, `Upper Bracket Final`, `Lower Bracket Final`, or `Grand Final`, the importer uses that wording automatically.

If the title does not identify the bracket, the safe fallback is:

`Main Event Series N`

This avoids accidentally exposing which teams advanced.

## YouTube links

The team names are hidden only in the website UI. The stored YouTube video ID is unchanged, so clicking `Watch on YouTube` still opens the correct official English VOD.

## Existing protections

- only `[EN]` videos;
- only videos uploaded within the rolling last 30 days;
- official `@dota2` channel only;
- current game + exactly one hidden next-game row;
- no scores or winners displayed;
- automatic Main Event ingestion via GitHub Actions.

## Update

Replace your repo files with this package and commit.

The important changed files are:

- `app.js`
- `matches.json`
- `scripts/sync-youtube.mjs`
- `index.html`

Your existing `YOUTUBE_API_KEY` secret stays the same.
