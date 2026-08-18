const KEY='ti2026Progress';
const getP=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return{}}};
const saveP=p=>localStorage.setItem(KEY,JSON.stringify(p));
const k=(m,i)=>`${m}:g${i+1}`;
const watched=(p,m,i)=>!!p[k(m,i)];
const reveal=(p,m,i)=>i===0||watched(p,m.id,i-1);

function gameRow(p,m,g,i){
  if(!reveal(p,m,i)) return `<div class="row locked"><div><b>Next game</b><div class="meta">Hidden to prevent series-length spoilers</div></div></div>`;
  if(!g || !g.youtubeId) return `<div class="row"><div><b>Next game</b><div class="meta">No additional game is currently available.</div></div></div>`;
  const w=watched(p,m.id,i);
  const url=`https://www.youtube.com/watch?v=${encodeURIComponent(g.youtubeId)}`;
  return `<div class="row"><div><b>Game ${i+1}</b><div class="${w?'watched':'meta'}">${w?'Watched':'Ready to watch'}</div></div><div class="actions"><a class="watch" href="${url}" target="_blank" rel="noopener">Watch on YouTube</a><button class="done" data-m="${m.id}" data-i="${i}">${w?'Watched ✓':'Mark finished'}</button></div></div>`;
}

function render(data){
  const p=getP(),app=document.getElementById('app');
  app.innerHTML=(data.stages||[]).map(s=>`<section class="stage"><h2>${s.name}</h2>${(s.days||[]).map(d=>`<div><div class="daytitle">${d.label}</div>${(d.matches||[]).map(m=>`<article class="match"><div class="matchhead"><b>${m.teamA} vs ${m.teamB}</b><span class="meta">${m.round||''}</span></div><div class="games">${(m.games||[]).map((g,i)=>gameRow(p,m,g,i)).join('')}</div></article>`).join('')}</div>`).join('')}</section>`).join('');
  document.querySelectorAll('.done').forEach(b=>b.onclick=()=>{const q=getP();q[k(b.dataset.m,Number(b.dataset.i))]=true;saveP(q);render(data)});
}
fetch('matches.json',{cache:'no-store'}).then(r=>r.json()).then(render);
document.getElementById('reset').onclick=()=>{if(confirm('Reset all watched progress?')){localStorage.removeItem(KEY);location.reload()}};
