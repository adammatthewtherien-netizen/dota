const KEY='ti2026MainEventProgressV11';
const COMPLETE_GRACE_MS=4*60*60*1000; // 4 hours

const getP=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return{}}};
const saveP=p=>localStorage.setItem(KEY,JSON.stringify(p));
const key=(id,i)=>`${id}:g${i+1}`;

function safeLabel(m){
  if(m.displayLabel) return m.displayLabel;
  const round=(m.round||'Main Event').trim();
  const n=m.seriesNumber||1;
  return `${round} Series ${n}`;
}

function nextIndex(p,m){
  let i=0;
  while(p[key(m.id,i)]) i++;
  return i;
}

function availableGame(m,i){
  return m.games?.[i]?.youtubeId || '';
}

function lastAvailableIndex(m){
  let last=-1;
  for(let i=0;i<(m.games||[]).length;i++){
    if(m.games[i]?.youtubeId) last=i;
  }
  return last;
}

function minimumGames(m){
  return (m.bestOf===5) ? 3 : 2;
}

function safeToCallComplete(p,m){
  const last=lastAvailableIndex(m);
  if(last<0) return false;

  // Viewer must have watched every VOD we currently have.
  for(let i=0;i<=last;i++){
    if(!p[key(m.id,i)]) return false;
  }

  // Never call a Bo3 complete after only one game, or a Bo5 after fewer than three.
  if(last+1 < minimumGames(m)) return false;

  // If another game already exists, series is obviously not complete.
  if(availableGame(m,last+1)) return false;

  // Wait four hours after the most recent VOD upload before declaring completion.
  // This avoids revealing a 2-0/3-0 while the next game could merely be awaiting upload.
  const published=m.games?.[last]?.publishedAt;
  if(!published) return false;

  const age=Date.now()-new Date(published).getTime();
  return Number.isFinite(age) && age>=COMPLETE_GRACE_MS;
}

function seriesBody(p,m){
  const i=nextIndex(p,m);
  const id=availableGame(m,i);

  if(id){
    const url=`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    return `
      <div class="row">
        <div><b>Game ${i+1}</b><div class="meta">Ready to watch</div></div>
        <div class="actions">
          <a class="watch" href="${url}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
          <button class="done" data-m="${m.id}" data-i="${i}">Mark finished</button>
        </div>
      </div>
      <div class="row locked">
        <div><b>Next game</b><div class="meta">Hidden until the current game is finished</div></div>
      </div>`;
  }

  if(safeToCallComplete(p,m)){
    return `<div class="row"><div><b>Series complete</b><div class="complete">You're caught up with this series.</div></div></div>`;
  }

  return `
    <div class="row">
      <div><b>Checking for next game</b><div class="meta">The automatic sync may still find another official English VOD.</div></div>
      <div class="wait">Checking</div>
    </div>`;
}

function render(data){
  const p=getP(),app=document.getElementById('app');

  app.innerHTML=(data.stages||[]).map(s=>`
    <section class="stage">
      <h2>${s.name}</h2>
      ${(s.days||[]).length ? s.days.map(d=>`
        <div>
          <div class="daytitle">${d.label}</div>
          ${(d.matches||[]).map(m=>`
            <article class="match">
              <div class="matchhead"><b>${safeLabel(m)}</b><span class="meta">${m.round||''}</span></div>
              <div class="games">${seriesBody(p,m)}</div>
            </article>`).join('')}
        </div>`).join('') :
        `<div class="notice">No Main Event VODs have been imported yet. New official English VODs posted from August 19 onward will appear automatically.</div>`}
    </section>`).join('');

  document.querySelectorAll('.done').forEach(b=>b.onclick=()=>{
    const q=getP();
    q[key(b.dataset.m,Number(b.dataset.i))]=true;
    saveP(q);
    render(data);
  });
}

fetch('matches.json',{cache:'no-store'}).then(r=>r.json()).then(render);

document.getElementById('reset').onclick=()=>{
  if(confirm('Reset all watched progress?')){
    localStorage.removeItem(KEY);
    location.reload();
  }
};
