# TI 2026 Spoiler-Free VODs

Static site for watching TI 2026 VODs without seeing scores, thumbnails, brackets, durations, or whether later games exist.

## Deploy
1. Create a GitHub repository, e.g. `ti2026-spoiler-free`.
2. Upload these five files to the repo root.
3. In Vercel choose **Add New → Project**.
4. Import the GitHub repository.
5. Leave the default static-site settings and click **Deploy**.
6. Vercel gives you a `.vercel.app` URL.

## Add matches
Edit `matches.json`.

For each game paste only the YouTube video ID, not the title.

Example:
`https://www.youtube.com/watch?v=dQw4w9WgXcQ`
becomes
`dQw4w9WgXcQ`

Game 2 is hidden until Game 1 is marked finished. Game 3 is hidden until Game 2 is marked finished.

## Next version
Add automatic ingestion from an approved TI 2026 YouTube channel/playlist.
