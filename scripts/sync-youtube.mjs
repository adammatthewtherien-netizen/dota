import fs from 'node:fs/promises';

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) throw new Error('Missing YOUTUBE_API_KEY');

const FILE = new URL('../matches.json', import.meta.url);
const data = JSON.parse(await fs.readFile(FILE, 'utf8'));
const CHANNEL_HANDLE='@dota2';
const NOW=new Date();
const CUTOFF=new Date(NOW.getTime()-30*24*60*60*1000);

const api=async(path,params={})=>{
  const u=new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for(const [k,v] of Object.entries({...params,key:API_KEY})) u.searchParams.set(k,String(v));
  const r=await fetch(u);
  if(!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

const ch=await api('channels',{part:'id,contentDetails',forHandle:CHANNEL_HANDLE});
const channel=ch.items?.[0];
if(!channel) throw new Error(`Could not resolve ${CHANNEL_HANDLE}`);
const uploads=channel.contentDetails?.relatedPlaylists?.uploads;
if(!uploads) throw new Error(`Could not resolve uploads playlist for ${CHANNEL_HANDLE}`);
console.log(`Resolved ${CHANNEL_HANDLE}: ${channel.id}`);
console.log(`Scanning uploads until ${CUTOFF.toISOString()}`);

let items=[], token='', reachedCutoff=false;
for(let page=0; page<40 && !reachedCutoff; page++){
  const res=await api('playlistItems',{
    part:'snippet,contentDetails',
    playlistId:uploads,
    maxResults:50,
    ...(token?{pageToken:token}:{})
  });
  const batch=res.items||[];
  items.push(...batch);
  console.log(`Uploads page ${page+1}: ${batch.length}`);
  for(const it of batch){
    const d=new Date(it.snippet?.publishedAt||0);
    if(!Number.isNaN(d.getTime()) && d<CUTOFF){ reachedCutoff=true; break; }
  }
  token=res.nextPageToken||'';
  if(!token) break;
}

const norm=s=>s.toLowerCase().replace(/[–—]/g,'-').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const aliases=new Map([
['og esports','og'],['og','og'],['team vision','team vision'],['vision','team vision'],
['lgd gaming','lgd gaming'],['lgd','lgd gaming'],['boom boys','boomboys'],['boomboys','boomboys'],
['nigma galaxy','nigma galaxy'],['nigma','nigma galaxy'],['team falcons','team falcons'],['falcons','team falcons'],
['iron wing','iron wing'],['team spirit','team spirit'],['team liquid','team liquid'],
['aurora gaming','aurora gaming'],['aurora','aurora gaming'],['gamerlegion','gamerlegion'],['gamer legion','gamerlegion'],
['team yandex','team yandex'],['yandex','team yandex'],['xtreme gaming','xtreme gaming'],['xtreme','xtreme gaming'],
['vici gaming','vici gaming'],['vici','vici gaming'],['team resilience','team resilience'],['resilience','team resilience'],
['huligani','huligani']
]);
const canon=s=>aliases.get(norm(s))||norm(s);

function parseTitle(title){
  if(!/^\[EN\]\s*/i.test(title)) return null;
  const clean=title.replace(/^\[EN\]\s*/i,'').trim();
  const m=clean.match(/^(.+?)\s+vs\.?\s+(.+?)\s*(?:[-|:–—]\s*)?Game\s*([1-5])\b/i);
  return m?{a:m[1].trim(),b:m[2].trim(),game:Number(m[3])}:null;
}
function allMatches(){return data.stages.flatMap(s=>(s.days||[]).flatMap(d=>(d.matches||[]).map(m=>({stage:s,day:d,m}))));}
function findExisting(a,b){
  const ca=canon(a),cb=canon(b);
  return allMatches().find(({m})=>{const x=canon(m.teamA),y=canon(m.teamB);return(x===ca&&y===cb)||(x===cb&&y===ca)});
}
function mainStage(){let s=data.stages.find(x=>/Main Event/i.test(x.name));if(!s){s={name:'TI 2026 — Main Event',days:[]};data.stages.push(s)}return s;}
function getDay(s,label){let d=s.days.find(x=>x.label===label);if(!d){d={label,matches:[]};s.days.push(d)}return d;}
function slug(s){return norm(s).replace(/\s+/g,'-');}
function inferRound(title){
  const t=title.toLowerCase();
  if(/grand\s*final/.test(t))return'Grand Final';
  if(/lower\s*bracket\s*final|lower\s*final/.test(t))return'Lower Bracket Final';
  if(/upper\s*bracket\s*final|upper\s*final/.test(t))return'Upper Bracket Final';
  if(/lower\s*bracket/.test(t))return'Lower Bracket';
  if(/upper\s*bracket/.test(t))return'Upper Bracket';
  return'Main Event';
}
function nextNum(stage,date,round){const d=stage.days.find(x=>x.label===date);return d?d.matches.filter(m=>m.round===round).length+1:1;}

let changed=false,en=0,matched=0,unparsed=0;
for(const it of items){
  const title=it.snippet?.title||'';
  const date=new Date(it.snippet?.publishedAt||0);
  if(Number.isNaN(date.getTime())||date<CUTOFF) continue;
  if(!/^\[EN\]\s*/i.test(title)) continue;
  en++;
  const p=parseTitle(title);
  if(!p){unparsed++; console.log(`UNPARSED EN: ${title}`); continue;}
  const id=it.contentDetails?.videoId||it.snippet?.resourceId?.videoId;
  if(!id) continue;

  let hit=findExisting(p.a,p.b);
  if(!hit){
    const ds=(it.snippet?.publishedAt||new Date().toISOString()).slice(0,10);
    const stage=mainStage(), day=getDay(stage,ds), round=inferRound(title);
    let m=day.matches.find(x=>{const a=canon(x.teamA),b=canon(x.teamB),ca=canon(p.a),cb=canon(p.b);return(a===ca&&b===cb)||(a===cb&&b===ca)});
    if(!m){
      const n=nextNum(stage,ds,round);
      m={id:`main-${ds}-${slug(p.a)}-${slug(p.b)}`,teamA:p.a,teamB:p.b,round,seriesNumber:n,displayLabel:`${round} Series ${n}`,maxPossibleGames:5,games:Array.from({length:5},()=>({youtubeId:''}))};
      day.matches.push(m); changed=true;
    }
    hit={stage,day,m};
  }
  while(hit.m.games.length<5)hit.m.games.push({youtubeId:''});
  if(hit.m.games[p.game-1].youtubeId!==id){
    hit.m.games[p.game-1].youtubeId=id;changed=true;
    console.log(`ADD ${hit.m.displayLabel||hit.m.id} Game ${p.game}: ${id}`);
  }
  matched++;
}

if(changed){
  data.meta.lastSync=new Date().toISOString();
  await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
  console.log('Updated matches.json');
}else console.log('No new VODs found');

console.log(`Recent uploads inspected: ${items.length}`);
console.log(`Recent [EN] uploads: ${en}`);
console.log(`Parsed/matched [EN] game VODs: ${matched}`);
console.log(`Unparsed [EN] uploads: ${unparsed}`);
