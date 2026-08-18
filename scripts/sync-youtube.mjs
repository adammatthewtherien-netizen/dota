import fs from 'node:fs/promises';

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('Missing YOUTUBE_API_KEY');
  process.exit(1);
}

const FILE = new URL('../matches.json', import.meta.url);
const data = JSON.parse(await fs.readFile(FILE, 'utf8'));
const CHANNEL_HANDLE = '@dota2';

const NOW = new Date();
const CUTOFF = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);

const api = async (path, params={}) => {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k,v] of Object.entries({...params,key:API_KEY})) {
    u.searchParams.set(k,String(v));
  }
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

// Resolve official @dota2 channel ID first.
const channel = await api('channels', {
  part:'id',
  forHandle:CHANNEL_HANDLE
});
const CHANNEL_ID = channel.items?.[0]?.id;
if (!CHANNEL_ID) throw new Error(`Could not resolve ${CHANNEL_HANDLE}`);

console.log(`Resolved ${CHANNEL_HANDLE} to channel ID ${CHANNEL_ID}`);
console.log(`Searching uploads published after ${CUTOFF.toISOString()}`);

/*
  IMPORTANT:
  Earlier versions walked the channel's uploads playlist. That can miss older
  TI uploads because the official channel publishes the same games in many
  languages and the first several hundred playlist entries can be consumed
  very quickly.

  This version uses search.list with:
    - channelId = official @dota2 channel
    - type = video
    - publishedAfter = rolling 30-day cutoff
    - order = date
    - q = "Game"

  Then we locally keep ONLY titles beginning with [EN].
*/
let items = [];
let pageToken = '';

for (let page=0; page<10; page++) {
  const res = await api('search', {
    part:'snippet',
    channelId:CHANNEL_ID,
    type:'video',
    order:'date',
    publishedAfter:CUTOFF.toISOString(),
    q:'Game',
    maxResults:50,
    ...(pageToken ? {pageToken} : {})
  });

  items.push(...(res.items || []));
  pageToken = res.nextPageToken || '';

  console.log(`Search page ${page+1}: ${res.items?.length || 0} videos`);

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

function parseTitle(title) {
  // English broadcasts only.
  if (!/^\[EN\]\s*/i.test(title)) return null;

  const clean = title.replace(/^\[EN\]\s*/i,'').trim();

  // Deliberately loose:
  //   Team A vs Team B ... Game 1 ...
  // Supports hyphens, pipes, colons, en/em dashes, etc.
  const m = clean.match(/^(.+?)\s+vs\.?\s+(.+?)\s*(?:[-|:–—]\s*)?Game\s*([1-5])\b/i);
  if (!m) return null;

  return {
    a:m[1].trim(),
    b:m[2].trim(),
    game:Number(m[3])
  };
}

function allMatches() {
  return data.stages.flatMap(s =>
    (s.days || []).flatMap(d =>
      (d.matches || []).map(m => ({stage:s,day:d,m}))
    )
  );
}

function findExisting(a,b) {
  const ca=canon(a), cb=canon(b);

  return allMatches().find(({m}) => {
    const x=canon(m.teamA), y=canon(m.teamB);
    return (x===ca && y===cb) || (x===cb && y===ca);
  });
}


function inferMainEventRound(title) {
  const t = title.toLowerCase();

  if (/grand\s*final/.test(t)) return 'Grand Final';
  if (/lower\s*bracket\s*final/.test(t) || /lower\s*final/.test(t)) return 'Lower Bracket Final';
  if (/upper\s*bracket\s*final/.test(t) || /upper\s*final/.test(t)) return 'Upper Bracket Final';
  if (/lower\s*bracket/.test(t)) return 'Lower Bracket';
  if (/upper\s*bracket/.test(t)) return 'Upper Bracket';

  // If the official title doesn't identify upper/lower bracket, use a neutral label.
  return 'Main Event';
}

function nextSeriesNumber(stage, dayLabel, roundName) {
  const day = stage.days.find(d => d.label === dayLabel);
  if (!day) return 1;
  const same = (day.matches || []).filter(m => (m.round || '') === roundName);
  return same.length + 1;
}

function mainStage() {
  let s=data.stages.find(x=>/Main Event/i.test(x.name));
  if(!s) {
    s={name:'TI 2026 — Main Event',days:[]};
    data.stages.push(s);
  }
  return s;
}

function getDay(stage,label) {
  let d=stage.days.find(x=>x.label===label);
  if(!d) {
    d={label,matches:[]};
    stage.days.push(d);
  }
  return d;
}

function slug(s) {
  return normalize(s).replace(/\s+/g,'-');
}

let changed=false;
let englishSeen=0;
let matched=0;
let skippedNonEnglish=0;
let skippedUnparsed=0;

for(const it of items) {
  const title=it.snippet?.title || '';
  const publishedAtRaw=it.snippet?.publishedAt || '';
  const publishedAt=publishedAtRaw ? new Date(publishedAtRaw) : null;

  if(!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt<CUTOFF) {
    continue;
  }

  if(!/^\[EN\]\s*/i.test(title)) {
    skippedNonEnglish++;
    continue;
  }

  englishSeen++;

  const parsed=parseTitle(title);
  if(!parsed) {
    skippedUnparsed++;
    console.log(`Unparsed EN title: ${title}`);
    continue;
  }

  const id=it.id?.videoId;
  if(!id) continue;

  let hit=findExisting(parsed.a,parsed.b);

  if(!hit) {
    const date=publishedAtRaw.slice(0,10);
    const stage=mainStage();
    const day=getDay(stage,date);

    let m=day.matches.find(x=>{
      const a=canon(x.teamA), b=canon(x.teamB);
      const ca=canon(parsed.a), cb=canon(parsed.b);
      return (a===ca&&b===cb)||(a===cb&&b===ca);
    });

    if(!m) {
      const roundName = inferMainEventRound(title);
      const seriesNumber = nextSeriesNumber(stage, date, roundName);

      m={
        id:`main-${date}-${slug(parsed.a)}-${slug(parsed.b)}`,
        teamA:parsed.a,
        teamB:parsed.b,
        round:roundName,
        seriesNumber,
        displayLabel:`${roundName} Series ${seriesNumber}`,
        maxPossibleGames:5,
        games:Array.from({length:5},()=>({youtubeId:''}))
      };
      day.matches.push(m);
      changed=true;
      console.log(`Created ${m.displayLabel}`);
    }

    hit={stage,day,m};
  }

  while(hit.m.games.length<5) {
    hit.m.games.push({youtubeId:''});
  }

  if(hit.m.games[parsed.game-1].youtubeId!==id) {
    hit.m.games[parsed.game-1].youtubeId=id;
    changed=true;
    console.log(`Added Game ${parsed.game}: ${parsed.a} vs ${parsed.b} -> ${id}`);
  }

  matched++;
}

if(changed) {
  data.meta.lastSync=new Date().toISOString();
  await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
  console.log('Updated matches.json');
} else {
  console.log('No new VODs found');
}

console.log(`Search results inspected: ${items.length}`);
console.log(`English uploads seen: ${englishSeen}`);
console.log(`English VODs parsed/matched: ${matched}`);
console.log(`Non-English/no-[EN] uploads skipped: ${skippedNonEnglish}`);
console.log(`English uploads that did not match expected title format: ${skippedUnparsed}`);
