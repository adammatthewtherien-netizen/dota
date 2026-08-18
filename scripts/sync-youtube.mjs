import fs from 'node:fs/promises';

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('Missing YOUTUBE_API_KEY');
  process.exit(1);
}

// Only consider uploads from the last 30 days.
// This greatly reduces the chance of matching older Dota tournament VODs
// and lets the title parser stay relatively flexible.
const NOW = new Date();
const CUTOFF = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);

const FILE = new URL('../matches.json', import.meta.url);
const data = JSON.parse(await fs.readFile(FILE, 'utf8'));
const CHANNEL_ID = data.meta?.youtubeChannelId || 'UCjkem1Rik-q4xKeETu9geUw';

const api = async (path, params={}) => {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k,v] of Object.entries({...params,key:API_KEY})) {
    u.searchParams.set(k,String(v));
  }
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

const channel = await api('channels', {
  part:'contentDetails',
  id:CHANNEL_ID
});

const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
if (!uploads) throw new Error('Could not find uploads playlist');

let items = [];
let pageToken = '';

for (let page=0; page<8; page++) {
  const res = await api('playlistItems', {
    part:'snippet,contentDetails',
    playlistId:uploads,
    maxResults:50,
    ...(pageToken ? {pageToken} : {})
  });

  items.push(...(res.items || []));
  pageToken = res.nextPageToken || '';
  if (!pageToken) break;
}

const normalize = s => s.toLowerCase()
  .replace(/[–—]/g,'-')
  .replace(/[^a-z0-9]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();

const aliases = new Map([
  ['og esports','og'],
  ['og','og'],
  ['team vision','team vision'],
  ['vision','team vision'],
  ['lgd gaming','lgd gaming'],
  ['lgd','lgd gaming'],
  ['boom boys','boomboys'],
  ['boomboys','boomboys'],
  ['nigma galaxy','nigma galaxy'],
  ['nigma','nigma galaxy'],
  ['team falcons','team falcons'],
  ['falcons','team falcons'],
  ['iron wing','iron wing'],
  ['team spirit','team spirit'],
  ['team liquid','team liquid'],
  ['aurora gaming','aurora gaming'],
  ['aurora','aurora gaming'],
  ['gamerlegion','gamerlegion'],
  ['gamer legion','gamerlegion'],
  ['team yandex','team yandex'],
  ['yandex','team yandex'],
  ['xtreme gaming','xtreme gaming'],
  ['xtreme','xtreme gaming'],
  ['vici gaming','vici gaming'],
  ['vici','vici gaming'],
  ['team resilience','team resilience'],
  ['resilience','team resilience'],
  ['huligani','huligani']
]);

const canon = s => aliases.get(normalize(s)) || normalize(s);

/*
  ENGLISH-ONLY FILTER

  We deliberately accept ONLY uploads whose title begins with [EN].
  Examples accepted:
    [EN] TEAM VISION vs Team Resilience - Game 1 - Group Stage
    [EN] Team Falcons vs LGD Gaming - Game 2 - The International 2026
    [EN] Team Liquid vs Team Spirit - Game 3 - Main Event

  Examples rejected:
    [RU] ...
    [ES] ...
    [PT] ...
    [CN] ...
    Team A vs Team B ...   (no [EN] prefix)
*/
function parseTitle(title) {
  if (!/^\[EN\]\s*/i.test(title)) return null;

  const clean = title.replace(/^\[EN\]\s*/i,'').trim();

  // Flexible around everything AFTER "Game X".
  // This avoids depending on exact suffixes like "Group Stage",
  // "Main Event", "The International 2026", caster names, etc.
  // Delimiters around "Game X" may be hyphens, pipes, colons, or whitespace.
  const m = clean.match(/^(.+?)\s+vs\.?\s+(.+?)\s*(?:[-|:–—]\s*)?Game\s*([1-5])\b/i);
  if (!m) return null;

  return {
    a: m[1].trim(),
    b: m[2].trim(),
    game: Number(m[3])
  };
}

function allMatches() {
  return data.stages.flatMap(s =>
    (s.days || []).flatMap(d =>
      (d.matches || []).map(m => ({stage:s, day:d, m}))
    )
  );
}

function findExisting(a,b) {
  const ca = canon(a), cb = canon(b);

  return allMatches().find(({m}) => {
    const x = canon(m.teamA), y = canon(m.teamB);
    return (x === ca && y === cb) || (x === cb && y === ca);
  });
}

function mainStage() {
  let s = data.stages.find(x => /Main Event/i.test(x.name));
  if (!s) {
    s = {name:'TI 2026 — Main Event', days:[]};
    data.stages.push(s);
  }
  return s;
}

function getDay(stage,label) {
  let d = stage.days.find(x => x.label === label);
  if (!d) {
    d = {label, matches:[]};
    stage.days.push(d);
  }
  return d;
}

function slug(s) {
  return normalize(s).replace(/\s+/g,'-');
}

let changed = false;
let englishSeen = 0;
let matched = 0;
let skippedNonEnglish = 0;
let skippedUnparsed = 0;

for (const it of items) {
  const title = it.snippet?.title || '';
  const publishedAtRaw = it.snippet?.publishedAt || '';
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null;

  // Skip anything older than 30 days (or with an invalid/missing publish date).
  if (!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt < CUTOFF) {
    continue;
  }


  if (!/^\[EN\]\s*/i.test(title)) {
    skippedNonEnglish++;
    continue;
  }

  englishSeen++;

  const p = parseTitle(title);
  if (!p) {
    skippedUnparsed++;
    continue;
  }

  const id = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
  if (!id) continue;

  let hit = findExisting(p.a,p.b);

  if (!hit) {
    // New matchup = assume Main Event.
    // Group by publication date to avoid merging later rematches.
    const date = (it.snippet?.publishedAt || new Date().toISOString()).slice(0,10);
    const stage = mainStage();
    const day = getDay(stage,date);

    let m = day.matches.find(x => {
      const a = canon(x.teamA), b = canon(x.teamB);
      const ca = canon(p.a), cb = canon(p.b);
      return (a===ca && b===cb) || (a===cb && b===ca);
    });

    if (!m) {
      m = {
        id:`main-${date}-${slug(p.a)}-${slug(p.b)}`,
        teamA:p.a,
        teamB:p.b,
        round:'Main Event',
        maxPossibleGames:5,
        games:Array.from({length:5},()=>({youtubeId:''}))
      };
      day.matches.push(m);
      changed = true;
    }

    hit = {stage,day,m};
  }

  while (hit.m.games.length < 5) {
    hit.m.games.push({youtubeId:''});
  }

  if (hit.m.games[p.game-1].youtubeId !== id) {
    hit.m.games[p.game-1].youtubeId = id;
    changed = true;
  }

  matched++;
}

if (changed) {
  data.meta.lastSync = new Date().toISOString();
  await fs.writeFile(FILE, JSON.stringify(data,null,2) + '\n');
  console.log(`Updated matches.json`);
} else {
  console.log(`No new VODs found`);
}

console.log(`Upload cutoff: ${CUTOFF.toISOString()} (last 30 days only)`);
console.log(`English uploads seen: ${englishSeen}`);
console.log(`English VODs parsed/matched: ${matched}`);
console.log(`Non-English/no-[EN] uploads skipped: ${skippedNonEnglish}`);
console.log(`English uploads that did not match expected title format: ${skippedUnparsed}`);
