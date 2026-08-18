# TI 2026 Spoiler-Free VODs — V11 Main Event Only

Changes:

- All Group Stage and Elimination Round data removed.
- `matches.json` starts empty except for the Main Event stage.
- Importer ignores every YouTube upload before `2026-08-19T00:00:00Z`.
- Official `@dota2` channel only.
- `[EN]` uploads only.
- Team names remain internal and never render on the website.
- New Main Event series are created automatically.
- Grand Final is treated as Bo5; other Main Event series default to Bo3.
- Safe end-of-series handling:
  - Bo3 cannot be complete before at least 2 games.
  - Bo5 cannot be complete before at least 3 games.
  - after the viewer watches the last available VOD, the site waits 4 hours from that VOD's upload time before displaying `Series complete`.
  - until then it says `Checking for next game`.
- V9 safe GitHub push/rebase workflow is retained.

The scheduled GitHub Action continues to run every 15 minutes.
