const KEY='ti2026ProgressV3';
const getP=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return{}}};
const saveP=p=>localStorage.setItem(KEY,JSON.stringify(p));
const key=(id,i)=>`${id}:g${i+1}`;

function nextIndex(p,m){
  let i=0;
  while(p[key(m.id,i)]) i++;
  return i;
}
function availableGame(m,i){ return m.games?.[i]?.youtubeId || ''; }

function seriesBody(p,m){
  const i=nextIndex(p,m);
  const id=availableGame(m,i);

  // If current slot has no VOD yet, we cannot safely decide whether the series ended.
  // Therefore we show "waiting/checking", never "series complete".
  const current = id
    ? `<div class="row"><div><b>Game ${i+1}</b><div class="meta">Ready to watch</div></div>
       <div class="actions"><a class="watch" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
       <button class="done" data-m="${m.id}" data-i="${i}">Mark finished</button></div></div>`
    : `<div class="row"><div><b>Next game</b><div class="meta">Waiting for the official YouTube VOD / automatic sync</div></div>
       <div class="wait">Not available yet</div></div>`;

  // Exactly ONE generic locked line, regardless of whether this is a 2- or 3-game series.
  const hidden = `<div class="row locked"><div><b>Next game</b><div class="meta">Hidden until the current game is finished</div></div></div>`;
  return current + hidden;
}

function render(data){
  const p=getP(), app=document.getElementById('app');
  app.innerHTML=(data.stages||[]).map(s=>`
    <section class="stage"><h2>${s.name}</h2>
    ${(s.days||[]).length ? s.days.map(d=>`
      <div><div class="daytitle">${d.label}</div>
      ${(d.matches||[]).map(m=>`<article class="match">
        <div class="matchhead"><b>${m.teamA} vs ${m.teamB}</b><span class="meta">${m.round||''}</span></div>
        <div class="games">${seriesBody(p,m)}</div></article>`).join('')}
      </div>`).join('') : `<div class="notice">Main Event matches will appear here automatically after the official individual-game VODs are uploaded and the GitHub sync runs.</div>`}
    </section>`).join('');

  document.querySelectorAll('.done').forEach(b=>b.onclick=()=>{
    const q=getP(); q[key(b.dataset.m,Number(b.dataset.i))]=true; saveP(q); render(data);
  });
}
fetch('matches.json',{cache:'no-store'}).then(r=>r.json()).then(render);
document.getElementById('reset').onclick=()=>{if(confirm('Reset all watched progress?')){localStorage.removeItem(KEY);location.reload()}};
