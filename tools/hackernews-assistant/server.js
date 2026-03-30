// ─────────────────────────────────────────────────────────────
// Hacker News comment assistant — dashboard (like devto-assistant)
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import express from "express";
import { readFile, writeFile, mkdir } from "fs/promises";
import { CONFIG } from "./config.js";
import { fetchAllStories } from "./fetch-stories.js";
import { draftComments } from "./draft-comments.js";
import { DATA_DIR, POSTS_FILE, DRAFTS_FILE } from "./paths.js";

const app = express();
app.use(express.json());

async function getDrafts() {
  try {
    return JSON.parse(await readFile(DRAFTS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

async function saveDrafts(d) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DRAFTS_FILE, JSON.stringify(d, null, 2));
}

app.get("/api/drafts", async (req, res) => {
  const drafts = await getDrafts();
  const status = req.query.status;
  res.json(status ? drafts.filter((d) => d.status === status) : drafts);
});

app.post("/api/drafts/:index/posted", async (req, res) => {
  const drafts = await getDrafts();
  const i = parseInt(req.params.index, 10);
  if (drafts[i]) {
    drafts[i].status = "posted";
    drafts[i].postedAt = new Date().toISOString();
    await saveDrafts(drafts);
  }
  res.json({ ok: true });
});

app.post("/api/drafts/:index/skip", async (req, res) => {
  const drafts = await getDrafts();
  const i = parseInt(req.params.index, 10);
  if (drafts[i]) {
    drafts[i].status = "skipped";
    await saveDrafts(drafts);
  }
  res.json({ ok: true });
});

app.post("/api/drafts/:index/edit", async (req, res) => {
  const drafts = await getDrafts();
  const i = parseInt(req.params.index, 10);
  if (drafts[i] && req.body.comment) {
    drafts[i].comment = req.body.comment;
    drafts[i].wordCount = req.body.comment.split(/\s+/).length;
    await saveDrafts(drafts);
  }
  res.json({ ok: true });
});

app.get("/api/articles", async (_req, res) => {
  try {
    const raw = await readFile(POSTS_FILE, "utf-8");
    const stories = JSON.parse(raw);
    const list = Array.isArray(stories) ? stories : [];
    res.json({
      count: list.length,
      articles: list.map((a) => ({
        id: a.id,
        title: a.title,
        url: a.url,
        primaryTag: a.primaryTag,
        ups: a.ups,
        numComments: a.numComments,
      })),
    });
  } catch {
    res.json({ count: 0, articles: [] });
  }
});

app.post("/api/fetch", async (_req, res) => {
  try {
    const p = await fetchAllStories();
    res.json({ ok: true, count: p.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/draft", async (_req, res) => {
  try {
    const d = await draftComments();
    res.json({ ok: true, count: d.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/clear-drafts", async (_req, res) => {
  await saveDrafts([]);
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(HTML);
});

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HN Comment Assistant</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;color:#e8e8e8;line-height:1.5}
.c{max-width:960px;margin:0 auto;padding:16px}
h1{font-size:22px;margin-bottom:4px}
.hn{color:#ff6600;font-weight:700}
.sub{color:#888;font-size:13px;margin-bottom:20px}
.actions{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
button{background:#ff6600;color:#111;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
button:hover{background:#ff8533}button:disabled{opacity:.4;cursor:not-allowed}
.sec{background:#333;color:#e8e8e8;font-weight:500}.dan{background:#dc2626;color:#fff}.suc{background:#16a34a;color:#fff}
.stats{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.st{background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:10px 14px;flex:1;min-width:100px}
.st-v{font-size:24px;font-weight:700}.st-l{font-size:11px;color:#888;margin-top:2px}
.tabs{display:flex;gap:0;border-bottom:1px solid #333;margin-bottom:16px;flex-wrap:wrap}
.tab{padding:8px 16px;cursor:pointer;font-size:13px;color:#888;border-bottom:2px solid transparent}
.tab:hover{color:#e8e8e8}.tab.active{color:#ff8533;border-bottom-color:#ff6600}
.post-group{margin-bottom:24px;border:1px solid #333;border-radius:8px;overflow:hidden}
.post-header{background:#141414;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #222}
.post-header a{color:#ff8533;text-decoration:none;font-size:14px;font-weight:600;flex:1}
.post-header a:hover{text-decoration:underline}
.badges{display:flex;gap:6px;align-items:center;flex-shrink:0}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.b-high{background:#dc262630;color:#f87171}.b-med{background:#d9770630;color:#fb923c}.b-low{background:#333;color:#888}
.b-sub{background:#3d2200;color:#ff8533}
.b-ups{background:#14532d40;color:#4ade80}
.fetch-row{padding:12px 16px;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.fetch-row:hover{background:#111}
.fetch-row a{color:#ff8533;text-decoration:none;font-weight:600;flex:1;font-size:14px}
.hint{font-size:12px;color:#888;margin-top:8px;padding:0 4px}
.load-error{font-size:12px;color:#f87171;margin:8px 0;padding:8px 12px;background:#3f1a1a40;border-radius:6px;border:1px solid #7f1d1d50}
.fetched-panel-wrap{margin-bottom:16px}
.fetched-panel{background:#141414;border:1px solid #333;border-radius:8px;overflow:hidden}
.fetched-panel-h{padding:10px 14px;background:#0a0a0a;border-bottom:1px solid #333;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.fetched-panel-h span.l{color:#888;font-weight:400;font-size:12px}
.fetched-panel-body{max-height:min(320px,45vh);overflow-y:auto}
.fetched-panel-body .fetch-row:last-child{border-bottom:none}
.option{padding:12px 16px;border-bottom:1px solid #222;display:flex;gap:12px;align-items:flex-start}
.option:last-child{border-bottom:none}
.option:hover{background:#111}
.opt-num{background:#262626;color:#888;width:24px;height:24px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:2px}
.opt-body{flex:1}
.opt-comment{font-size:14px;white-space:pre-wrap;margin-bottom:6px}
.opt-meta{display:flex;gap:8px;align-items:center;font-size:11px;color:#666;flex-wrap:wrap}
.score{font-weight:700}.score-high{color:#4ade80}.score-med{color:#fbbf24}.score-low{color:#888}
.opt-style{color:#a78bfa;font-size:11px}.opt-style.witty{color:#fbbf24;background:#fbbf2415;padding:1px 6px;border-radius:8px}
.opt-actions{display:flex;gap:6px;flex-shrink:0;align-items:flex-start;margin-top:2px}
.opt-actions button{font-size:11px;padding:4px 10px}
.copy-btn.copied{background:#16a34a}
textarea.edit{width:100%;background:#0d0d0d;border:1px solid #333;border-radius:4px;padding:8px;font-size:13px;color:#e8e8e8;font-family:inherit;resize:vertical;min-height:60px;margin:6px 0}
.empty{text-align:center;padding:40px;color:#666}
.factors{font-size:10px;color:#4ade80}
</style>
</head>
<body>
<div class="c">
<h1><span class="hn">HN</span> Comment Assistant</h1>
<p class="sub">4 reply options per thread &middot; MegaLLM score &middot; copy → paste on news.ycombinator.com</p>

<div class="actions">
  <button onclick="fetchPosts()" id="fetchBtn">Fetch stories</button>
  <button onclick="draftAll()" id="draftBtn">Draft comments (4 per thread)</button>
  <button class="sec" onclick="clearDrafts()">Clear all drafts</button>
</div>

<div class="stats" id="stats"></div>
<div id="loadError" class="load-error" role="status"></div>
<div id="fetchedPanelWrap" class="fetched-panel-wrap"></div>

<div class="tabs">
  <div class="tab active" data-tab="draft" onclick="switchTab('draft')">Drafts</div>
  <div class="tab" data-tab="posted" onclick="switchTab('posted')">Posted</div>
  <div class="tab" data-tab="skipped" onclick="switchTab('skipped')">Skipped</div>
  <div class="tab" data-tab="fetched" onclick="switchTab('fetched')">Fetched stories</div>
</div>

<div id="content"></div>
</div>

<script>
let tab='draft',all=[],cachedArticles=[];

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

async function load(){
  const errEl=document.getElementById('loadError');
  if(errEl)errEl.textContent='';
  try{
    const [dr,ar]=await Promise.all([fetch('/api/drafts'),fetch('/api/articles')]);
    if(!dr.ok)throw new Error('drafts HTTP '+dr.status);
    if(!ar.ok)throw new Error('stories HTTP '+ar.status);
    all=await dr.json();
    const aj=await ar.json();
    cachedArticles=Array.isArray(aj.articles)?aj.articles:[];
    renderStats();
    renderFetchedPanel();
    render();
  }catch(e){
    console.error(e);
    if(errEl)errEl.textContent='Load error: '+e.message;
  }
}

function renderFetchedPanel(){
  const el=document.getElementById('fetchedPanelWrap');
  if(!el)return;
  if(!cachedArticles.length){
    el.innerHTML='<p class="hint" style="margin:0 0 8px 0">No stories in cache — click <strong>Fetch stories</strong> (writes <code style="color:#ff8533">data/posts.json</code>).</p>';
    return;
  }
  const rows=cachedArticles.map(function(a){
    return '<div class="fetch-row">'+
      '<a href="'+esc(a.url)+'" target="_blank" rel="noopener">'+esc(a.title)+'</a>'+
      '<div class="badges" style="flex-shrink:0">'+
      '<span class="badge b-sub">'+esc(a.primaryTag||'?')+'</span>'+
      '<span class="badge b-ups">'+(a.ups||0)+' pts</span>'+
      '<span class="badge b-low">'+(a.numComments||0)+' cmt</span>'+
      '</div></div>';
  }).join('');
  el.innerHTML='<div class="fetched-panel">'+
    '<div class="fetched-panel-h"><span>Cached stories</span><span class="l">data/posts.json</span><span class="badge b-ups">'+cachedArticles.length+'</span></div>'+
    '<div class="fetched-panel-body">'+rows+'</div></div>';
}

function renderStats(){
  const s={draft:0,posted:0,skipped:0,highPri:0,avgScore:0};
  let scoreSum=0;
  all.forEach(d=>{s[d.status]=(s[d.status]||0)+1;if(d.viralPotential==='high')s.highPri++;scoreSum+=d.megallmScore||0});
  s.avgScore=all.length?Math.round(scoreSum/all.length):0;
  document.getElementById('stats').innerHTML=
    st('Stories cached',cachedArticles.length)+st('Drafts',s.draft)+st('Posted',s.posted)+st('High pri',s.highPri)+st('Avg score',s.avgScore);
}

function st(l,v){return '<div class="st"><div class="st-v">'+v+'</div><div class="st-l">'+l+'</div></div>'}

function render(){
  if(tab==='fetched'){renderFetched();return}
  const filtered=all.map((d,i)=>({...d,_i:i})).filter(d=>d.status===tab);
  if(!filtered.length){
    let msg='<div class="empty">no '+tab+' comments</div>';
    if(tab==='draft'&&cachedArticles.length){
      msg+='<p class="hint">You have <strong>'+cachedArticles.length+'</strong> stories cached. Run <strong>Draft comments</strong> to generate options (opens thread on copy).</p>';
    }
    document.getElementById('content').innerHTML=msg;
    return;
  }
  const groups={};
  filtered.forEach(d=>{
    if(!groups[d.postId])groups[d.postId]={post:d,options:[]};
    groups[d.postId].options.push(d);
  });
  document.getElementById('content').innerHTML=Object.values(groups).map(g=>renderGroup(g)).join('');
}

function renderFetched(){
  if(!cachedArticles.length){
    document.getElementById('content').innerHTML='<div class="empty">no cached stories. click <strong>Fetch stories</strong> first.</div>';
    return;
  }
  const rows=cachedArticles.map(function(a){
    return '<div class="fetch-row">'+
      '<a href="'+esc(a.url)+'" target="_blank" rel="noopener">'+esc(a.title)+'</a>'+
      '<div class="badges" style="flex-shrink:0">'+
      '<span class="badge b-sub">'+esc(a.primaryTag||'?')+'</span>'+
      '<span class="badge b-ups">'+(a.ups||0)+' pts</span>'+
      '<span class="badge b-low">'+(a.numComments||0)+' comments</span>'+
      '</div></div>';
  }).join('');
  document.getElementById('content').innerHTML=
    '<div class="post-group" style="margin-bottom:12px"><div class="post-header"><span style="font-size:13px;color:#888">'+cachedArticles.length+' stories — ready to draft</span></div></div>'+rows;
}

function renderGroup(g){
  const p=g.post;
  const vb=p.viralPotential==='high'?'b-high':p.viralPotential==='medium'?'b-med':'b-low';
  const vl=p.viralPotential?p.viralPotential.toUpperCase():'';
  const vr=p.viralReasons?p.viralReasons.join(', '):'';
  return '<div class="post-group">'+
    '<div class="post-header">'+
      '<a href="'+esc(p.postUrl)+'" target="_blank" rel="noopener">'+esc(p.postTitle)+'</a>'+
      '<div class="badges">'+
        '<span class="badge b-sub">'+esc(p.primaryTag||'')+'</span>'+
        '<span class="badge b-ups">'+p.postUps+' pts</span>'+
        (vl?'<span class="badge '+vb+'">'+vl+'</span>':'')+
      '</div></div>'+
    (vr?'<div style="padding:4px 16px;background:#141414;font-size:10px;color:#f87171">'+esc(vr)+'</div>':'')+
    g.options.sort((a,b)=>(b.megallmScore||0)-(a.megallmScore||0)).map(o=>renderOption(o)).join('')+
  '</div>';
}

function renderOption(d){
  const i=d._i;
  const sc=d.megallmScore||0;
  const scClass=sc>=40?'score-high':sc>=20?'score-med':'score-low';
  const factors=(d.megallmFactors||[]).join(', ');
  return '<div class="option" id="opt-'+i+'">'+
    '<div class="opt-num">'+(d.optionNumber||'?')+'</div>'+
    '<div class="opt-body">'+
      '<div class="opt-comment" id="text-'+i+'">'+esc(d.comment)+'</div>'+
      '<textarea class="edit" id="edit-'+i+'" style="display:none" onblur="saveEdit('+i+')">'+esc(d.comment)+'</textarea>'+
      '<div class="opt-meta">'+
        '<span class="score '+scClass+'">score: '+sc+'</span>'+
        '<span class="opt-style'+(d.isWitty?' witty':'')+'">'+(d.optionStyle||'')+'</span>'+
        '<span>'+d.wordCount+'w</span>'+
        (d.mentionsProduct?'<span style="color:#a78bfa">mentions product</span>':'')+
        (factors?'<span class="factors">'+esc(factors)+'</span>':'')+
      '</div></div>'+
    '<div class="opt-actions">'+
      (d.status==='draft'?(
        '<button class="copy-btn" onclick="copyOpen('+i+')">Copy + open thread</button>'+
        '<button class="sec" onclick="toggleEdit('+i+')">Edit</button>'+
        '<button class="suc" onclick="posted('+i+')">Posted</button>'+
        '<button class="dan" onclick="skip('+i+')">Skip</button>'
      ):'<span style="font-size:11px;color:#666">'+(d.postedAt?timeAgo(d.postedAt):d.status)+'</span>')+
    '</div></div>';
}

function timeAgo(d){const m=Math.floor((Date.now()-new Date(d))/6e4);return m<60?m+'m ago':m<1440?Math.floor(m/60)+'h ago':Math.floor(m/1440)+'d ago'}

async function copyOpen(i){
  await navigator.clipboard.writeText(all[i].comment);
  const b=document.querySelector('#opt-'+i+' .copy-btn');
  if(b){b.textContent='Copied!';b.classList.add('copied');setTimeout(()=>{b.textContent='Copy + open thread';b.classList.remove('copied')},1500)}
  window.open(all[i].postUrl,'_blank');
}

function toggleEdit(i){
  const t=document.getElementById('text-'+i),e=document.getElementById('edit-'+i);
  if(e.style.display==='none'){e.style.display='block';t.style.display='none';e.focus()}
  else{e.style.display='none';t.style.display='block'}
}

async function saveEdit(i){
  const e=document.getElementById('edit-'+i),t=document.getElementById('text-'+i);
  await fetch('/api/drafts/'+i+'/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({comment:e.value})});
  all[i].comment=e.value;t.textContent=e.value;e.style.display='none';t.style.display='block';
}

async function posted(i){
  await fetch('/api/drafts/'+i+'/posted',{method:'POST'});
  all[i].status='posted';renderStats();renderFetchedPanel();render();
}
async function skip(i){
  await fetch('/api/drafts/'+i+'/skip',{method:'POST'});
  all[i].status='skipped';renderStats();renderFetchedPanel();render();
}

function switchTab(s){
  tab=s;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelector('[data-tab="'+s+'"]').classList.add('active');
  render();
}

async function fetchPosts(){
  const b=document.getElementById('fetchBtn');b.disabled=true;b.textContent='Fetching...';
  try{
    const res=await fetch('/api/fetch',{method:'POST'});
    const r=await res.json();
    if(!res.ok)throw new Error(r.error||'fetch failed');
    b.textContent='Fetched '+r.count+'!';
    await load();
    setTimeout(function(){b.textContent='Fetch stories';b.disabled=false},2000);
  }catch(e){
    b.textContent='Error';
    b.disabled=false;
    setTimeout(function(){b.textContent='Fetch stories'},3000);
  }
}

async function draftAll(){
  const b=document.getElementById('draftBtn');b.disabled=true;b.textContent='Drafting...';
  try{
    const res=await fetch('/api/draft',{method:'POST'});
    let r={};
    try{r=await res.json();}catch(_){}
    if(!res.ok)throw new Error(r.error||'draft failed (HTTP '+res.status+')');
    b.textContent='Drafted '+r.count+'!';
    await load();
    setTimeout(()=>{b.textContent='Draft comments (4 per thread)';b.disabled=false},2000);
  }catch(e){
    const err=document.getElementById('loadError');
    if(err)err.textContent='Draft error: '+(e.message||String(e));
    b.textContent='Error';
    setTimeout(()=>{b.textContent='Draft comments (4 per thread)';b.disabled=false},4000);
  }
}

async function clearDrafts(){
  if(!confirm('Clear all drafts?'))return;
  await fetch('/api/clear-drafts',{method:'POST'});
  all=[];renderStats();renderFetchedPanel();render();
}

load();
</script>
</body></html>`;

app.listen(CONFIG.port, () => {
  console.log("");
  console.log("  HN Comment Assistant");
  console.log("  http://localhost:" + CONFIG.port);
  console.log("");
  console.log("  Fetch: Firebase API (top/new/best) → data/posts.json");
  console.log("  Draft: MegaLLM → data/drafts.json");
  console.log("");
});
