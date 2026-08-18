# TI 2026 Spoiler-Free VODs — V3

## Fix in this version
The UI no longer reveals whether a Bo3 contains two or three games. It renders:
1. the current game;
2. exactly one generic hidden `Next game` line.

It never renders one locked row per future game.

## Real VODs
Several confirmed official individual-game IDs are preloaded. The GitHub Action fills the rest from the official Dota 2 YouTube uploads playlist.

## Turn on automatic YouTube syncing

### 1. Get a YouTube Data API v3 key
In Google Cloud:
- create/select a project;
- enable **YouTube Data API v3**;
- create an API key.

### 2. Put the key in GitHub
Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- Name: `YOUTUBE_API_KEY`
- Value: your API key

### 3. Enable the workflow
Repository → **Actions** → `Sync TI 2026 YouTube VODs` → **Run workflow**

It is also scheduled every 15 minutes.

When the script finds official uploads titled like:
`[EN] Team A vs Team B - Game 1 - The International 2026 ...`

it:
- fills missing Group Stage VOD IDs;
- automatically creates Main Event series;
- adds the individual Game 1/2/3/etc. YouTube IDs;
- commits `matches.json`;
- Vercel redeploys from GitHub.

## Deploy/update
Replace the files in your current repo with this package and commit them.
