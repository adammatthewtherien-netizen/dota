import fs from 'node:fs/promises';

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) throw new Error('Missing YOUTUBE_API_KEY');

const FILE = new URL('../matches.json', import.meta.url);
const data = JSON.parse(await fs.readFile(FILE, 'utf8'));

const CHANNEL_HANDLE = '@dota2';
const NOT_BEFORE = new Date(data.meta?.importNotBefore || '2026-08-19T00:00:00Z');
const NOW = new Date();

const api = async(path, params={}) => {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k,v] of Object.entries({...params,key:API_KEY})) u.searchParams.set(k,String(v));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

const ch = await api('channels', {
  part:'id,contentDetails',
  forHandle:CHANNEL_HANDLE
});
const channel = ch.items?.[0];
if (!channel) throw new Error(`Could not resolve ${CHANNEL_HANDLE}`);

const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
if (!uploads) throw new Error(`Could not resolve uploads playlist for ${CHANNEL_HANDLE}`);

console.log(`Resolved ${CHANNEL_HANDLE}: ${channel.id}`);
console.log(`Ignoring every upload before ${NOT_BEFORE.toISOString()}`);

// Walk newest uploads until reaching our fixed cutoff date.
let items = [];
let token = '';
let reachedCutoff = false;

for (let page=0; page<40 && !reachedCutoff; page++) {
  const res = await api('playlistItems', {
    part:'snippet,contentDetails',
    playlistId:uploads,
    maxResults:50,
    ...(token ? {pageToken:token} : {})
  });

  const batch = res.items || [];
  items.push(...batch);
  console.log(`Uploads page ${page+1}: ${batch.length}`);

  for (const it of batch) {
    const d = new Date(it.snippet?.publishedAt || 0);
    if (!Number.isNaN(d.getTime()) && d < NOT_BEFORE) {
      reachedCutoff = true;
      break;
    }
  }

  token = res.nextPageToken || '';
  if (!token) break;
}

const norm = s => s.toLowerCase()
  .replace(/[–—]/g,'-')
  .replace(/[^a-z0-9]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();

function parseTitle(title) {
  // English broadcasts only.
  if (!/^\[EN\]\s*/i.test(title)) return null;

  const clean = title.replace(/^\[EN\]\s*/i,'').trim();

  // Loose on tournament/round suffixes; strict only on Team A vs Team B + Game X.
  const m = clean.match(/^(.+?)\s+vs\.?\s+(.+?)\s*(?:[-|:–—]\s*)?Game\s*([1-5])\b/i);
  if (!m) return null;

  return {
    a:m[1].trim(),
    b:m[2].trim(),
    game:Number(m[3])
  };
}

function inferRound(title) {
  const t = title.toLowerCase();
  if (/grand\s*final/.test(t)) return 'Grand Final';
  if (/lower\s*bracket\s*final|lower\s*final/.test(t)) return 'Lower Bracket Final';
  if (/upper\s*bracket\s*final|upper\s*final/.test(t)) return 'Upper Bracket Final';
  if (/lower\s*bracket/.test(t)) return 'Lower Bracket';
  if (/upper\s*bracket/.test(t)) return 'Upper Bracket';
  return 'Main Event';
}

function mainStage() {
  let s = data.stages.find(x => /Main Event/i.test(x.name));
  if (!s) {
    s = {name:'TI 2026 — Main Event',days:[]};
    data.stages.push(s);
  }
  return s;
}

function getDay(stage,label) {
  let d = stage.days.find(x => x.label === label);
  if (!d) {
    d = {label,matches:[]};
    stage.days.push(d);
  }
  return d;
}

function nextSeriesNumber(stage, date, roundName) {
  const day = stage.days.find(d => d.label === date);
  if (!day) return 1;
  return (day.matches || []).filter(m => m.round === roundName).length + 1;
}

function slug(s) {
  return norm(s).replace(/\s+/g,'-');
}

function findSeries(stage, date, a, b) {
  const day = stage.days.find(d => d.label === date);
  if (!day) return null;

  const na = norm(a), nb = norm(b);
  return day.matches.find(m => {
    const x = norm(m.teamA), y = norm(m.teamB);
    return (x===na && y===nb) || (x===nb && y===na);
  }) || null;
}

const stage = mainStage();
let changed = false;
let englishSeen = 0;
let matched = 0;
let unparsed = 0;

for (const it of items) {
  const title = it.snippet?.title || '';
  const publishedRaw = it.snippet?.publishedAt || '';
  const published = new Date(publishedRaw);

  if (Number.isNaN(published.getTime()) || published < NOT_BEFORE) continue;
  if (!/^\[EN\]\s*/i.test(title)) continue;

  englishSeen++;

  const parsed = parseTitle(title);
  if (!parsed) {
    unparsed++;
    console.log(`UNPARSED EN: ${title}`);
    continue;
  }

  const id = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
  if (!id) continue;

  const date = publishedRaw.slice(0,10);
  const roundName = inferRound(title);
  const day = getDay(stage,date);

  let m = findSeries(stage,date,parsed.a,parsed.b);

  if (!m) {
    const n = nextSeriesNumber(stage,date,roundName);

    m = {
      id:`main-${date}-${slug(parsed.a)}-${slug(parsed.b)}`,
      teamA:parsed.a,
      teamB:parsed.b,
      round:roundName,
      seriesNumber:n,
      displayLabel:`${roundName} Series ${n}`,
      bestOf: roundName === 'Grand Final' ? 5 : 3,
      games:Array.from({length:5},()=>({youtubeId:'',publishedAt:''}))
    };

    day.matches.push(m);
    changed = true;
    console.log(`Created ${m.displayLabel}`);
  }

  while (m.games.length < 5) m.games.push({youtubeId:'',publishedAt:''});

  if (m.games[parsed.game-1].youtubeId !== id ||
      m.games[parsed.game-1].publishedAt !== publishedRaw) {
    m.games[parsed.game-1] = {youtubeId:id,publishedAt:publishedRaw};
    changed = true;
    console.log(`ADD ${m.displayLabel} Game ${parsed.game}: ${id}`);
  }

  matched++;
}

// Sort days and series for stable display.
stage.days.sort((a,b)=>a.label.localeCompare(b.label));
for (const d of stage.days) {
  d.matches.sort((a,b)=>(a.seriesNumber||0)-(b.seriesNumber||0));
}

if (changed) {
  data.meta.lastSync = NOW.toISOString();
  await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
  console.log('Updated matches.json');
} else {
  console.log('No new VODs found');
}

console.log(`Uploads inspected: ${items.length}`);
console.log(`Recent [EN] uploads: ${englishSeen}`);
console.log(`Parsed/matched [EN] game VODs: ${matched}`);
console.log(`Unparsed [EN] uploads: ${unparsed}`);
