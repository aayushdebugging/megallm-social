// ─────────────────────────────────────────────────────────────
// Reddit Comment Assistant — Web Dashboard v2
// Multiple options per post, scoring, viral tags, employee UX
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import express from "express";
import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { CONFIG } from "./config.js";
import { fetchAllPosts } from "./fetch-posts.js";
import { draftComments } from "./draft-comments.js";
import { DATA_DIR, DRAFTS_FILE, POSTS_FILE, SIMS_DIR } from "./paths.js";

const app = express();
app.use(express.json());

async function getDrafts() {
  try { return JSON.parse(await readFile(DRAFTS_FILE, "utf-8")); }
  catch { return []; }
}
async function saveDrafts(d) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DRAFTS_FILE, JSON.stringify(d, null, 2));
}

// ── API ──────────────────────────────────────────────────

app.get("/api/drafts", async (req, res) => {
  const drafts = await getDrafts();
  const status = req.query.status;
  res.json(status ? drafts.filter(d => d.status === status) : drafts);
});

app.post("/api/drafts/:index/posted", async (req, res) => {
  const drafts = await getDrafts();
  const i = parseInt(req.params.index);
  if (drafts[i]) { drafts[i].status = "posted"; drafts[i].postedAt = new Date().toISOString(); await saveDrafts(drafts); }
  res.json({ ok: true });
});

app.post("/api/drafts/:index/skip", async (req, res) => {
  const drafts = await getDrafts();
  const i = parseInt(req.params.index);
  if (drafts[i]) { drafts[i].status = "skipped"; await saveDrafts(drafts); }
  res.json({ ok: true });
});

app.post("/api/drafts/:index/edit", async (req, res) => {
  const drafts = await getDrafts();
  const i = parseInt(req.params.index);
  if (drafts[i] && req.body.comment) {
    drafts[i].comment = req.body.comment;
    drafts[i].wordCount = req.body.comment.split(/\s+/).length;
    await saveDrafts(drafts);
  }
  res.json({ ok: true });
});

app.post("/api/fetch", async (_req, res) => {
  try { const p = await fetchAllPosts(); res.json({ ok: true, count: p.length }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/draft", async (_req, res) => {
  try { const d = await draftComments(); res.json({ ok: true, count: d.length }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/clear-drafts", async (_req, res) => {
  await saveDrafts([]);
  res.json({ ok: true });
});

// ── Simulation API ──────────────────────────────────────

async function getSimulations() {
  try {
    await mkdir(SIMS_DIR, { recursive: true });
    const files = (await readdir(SIMS_DIR)).filter(f => f.endsWith(".json")).sort().reverse();
    const sims = [];
    for (const f of files) {
      try { sims.push({ filename: f, ...JSON.parse(await readFile(`${SIMS_DIR}/${f}`, "utf-8")) }); } catch {}
    }
    return sims;
  } catch { return []; }
}

async function saveSimulation(filename, data) {
  await mkdir(SIMS_DIR, { recursive: true });
  await writeFile(`${SIMS_DIR}/${filename}`, JSON.stringify(data, null, 2));
}

app.get("/api/simulations", async (_req, res) => {
  const sims = await getSimulations();
  res.json(sims.map((s, i) => ({
    index: i + 1, filename: s.filename,
    subreddit: s.metadata?.subreddit || s.post?.subreddit || "?",
    theme: s.metadata?.theme || "?",
    title: s.post?.title || "untitled",
    upvotes: s.post?.upvotes || 0,
    totalComments: s.totalComments || 0,
    userCount: s.metadata?.userCount || 0,
    megallmSeeds: s.metadata?.megallmSeeds || 0,
    generatedAt: s.metadata?.generatedAt || "",
    postedItems: countStatus(s, "posted"),
    totalItems: countAllItems(s),
  })));
});

app.get("/api/simulations/:filename", async (req, res) => {
  try {
    const data = JSON.parse(await readFile(`${SIMS_DIR}/${req.params.filename}`, "utf-8"));
    res.json(data);
  } catch { res.status(404).json({ error: "not found" }); }
});

app.post("/api/simulations/:filename/mark", async (req, res) => {
  const path = `${SIMS_DIR}/${req.params.filename}`;
  let sim;
  try { sim = JSON.parse(await readFile(path, "utf-8")); } catch { return res.status(404).json({ error: "not found" }); }
  const { id, status } = req.body;
  if (id === "post") {
    sim.post._status = status;
    if (status === "posted") sim.post._postedAt = new Date().toISOString();
  } else {
    walkMark(sim.comments, id, status);
  }
  await saveSimulation(req.params.filename, sim);
  res.json({ ok: true });
});

function walkMark(comments, id, status) {
  for (const c of comments || []) {
    if (c.id === id) { c._status = status; if (status === "posted") c._postedAt = new Date().toISOString(); return true; }
    if (c.replies && walkMark(c.replies, id, status)) return true;
  }
  return false;
}

function countStatus(sim, status) {
  let n = sim.post?._status === status ? 1 : 0;
  (function walk(cs) { for (const c of cs || []) { if (c._status === status) n++; if (c.replies) walk(c.replies); } })(sim.comments);
  return n;
}

function countAllItems(sim) {
  let n = 1;
  (function walk(cs) { for (const c of cs || []) { n++; if (c.replies) walk(c.replies); } })(sim.comments);
  return n;
}

app.post("/api/simulate", async (_req, res) => {
  try {
    const { simulatePost } = await import("./simulate-post.js");
    await simulatePost();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Dashboard ────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(HTML);
});

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reddit Comment Assistant</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;line-height:1.5}
.c{max-width:960px;margin:0 auto;padding:16px}
h1{font-size:22px;margin-bottom:4px}
.sub{color:#888;font-size:13px;margin-bottom:20px}
.actions{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
button{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px}
button:hover{background:#1d4ed8}button:disabled{opacity:.4;cursor:not-allowed}
.sec{background:#333;}.dan{background:#dc2626;}.suc{background:#16a34a;}
.stats{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.st{background:#141414;border:1px solid #262626;border-radius:8px;padding:10px 14px;flex:1;min-width:100px}
.st-v{font-size:24px;font-weight:700}.st-l{font-size:11px;color:#888;margin-top:2px}
.tabs{display:flex;gap:0;border-bottom:1px solid #262626;margin-bottom:16px}
.tab{padding:8px 16px;cursor:pointer;font-size:13px;color:#888;border-bottom:2px solid transparent}
.tab:hover{color:#e0e0e0}.tab.active{color:#e0e0e0;border-bottom-color:#2563eb}
.post-group{margin-bottom:24px;border:1px solid #262626;border-radius:8px;overflow:hidden}
.post-header{background:#141414;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #1a1a1a}
.post-header a{color:#60a5fa;text-decoration:none;font-size:14px;font-weight:600;flex:1}
.post-header a:hover{text-decoration:underline}
.badges{display:flex;gap:6px;align-items:center;flex-shrink:0}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.b-high{background:#dc262630;color:#f87171}.b-med{background:#d9770630;color:#fb923c}.b-low{background:#26262660;color:#888}
.b-sub{background:#1e3a5f;color:#60a5fa}
.b-ups{background:#16a34a20;color:#4ade80}
.option{padding:12px 16px;border-bottom:1px solid #1a1a1a;display:flex;gap:12px;align-items:flex-start}
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
textarea.edit{width:100%;background:#0d0d0d;border:1px solid #333;border-radius:4px;padding:8px;font-size:13px;color:#e0e0e0;font-family:inherit;resize:vertical;min-height:60px;margin:6px 0}
.empty{text-align:center;padding:40px;color:#666}
.viral-reasons{font-size:10px;color:#f87171;margin-left:4px}
.factors{font-size:10px;color:#4ade80}

/* ── Simulations ── */
.sim-index{list-style:none;padding:0}
.sim-card{background:#141414;border:1px solid #262626;border-radius:8px;padding:14px 18px;margin-bottom:10px;cursor:pointer;transition:border-color .15s}
.sim-card:hover{border-color:#2563eb}
.sim-card-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px}
.sim-num{background:#2563eb;color:#fff;width:28px;height:28px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.sim-title{flex:1;font-size:14px;font-weight:600;color:#e0e0e0}
.sim-meta{display:flex;gap:8px;font-size:11px;color:#888;flex-wrap:wrap}
.sim-progress{margin-top:8px;display:flex;align-items:center;gap:8px}
.sim-bar{flex:1;height:6px;background:#262626;border-radius:3px;overflow:hidden}
.sim-bar-fill{height:100%;background:#2563eb;border-radius:3px;transition:width .3s}
.sim-bar-pct{font-size:11px;color:#888;width:36px;text-align:right}
.sim-detail-back{font-size:13px;color:#60a5fa;cursor:pointer;margin-bottom:16px;display:inline-block}
.sim-detail-back:hover{text-decoration:underline}
.sim-post-block{background:#141414;border:1px solid #262626;border-radius:8px;padding:16px;margin-bottom:16px}
.sim-post-title{font-size:16px;font-weight:700;margin-bottom:8px}
.sim-post-body{font-size:14px;white-space:pre-wrap;color:#ccc;margin-bottom:10px;line-height:1.6}
.sim-post-meta{display:flex;gap:10px;font-size:11px;color:#888;flex-wrap:wrap;margin-bottom:10px}
.sim-post-actions{display:flex;gap:8px;align-items:center}
.comment-thread{margin-left:0;margin-top:4px}
.sim-comment{border-left:2px solid #262626;padding:10px 0 10px 14px;margin-bottom:2px}
.sim-comment.depth-0{border-left-color:#333}
.sim-comment.depth-1{margin-left:24px;border-left-color:#2a2a2a}
.sim-comment.depth-2{margin-left:48px;border-left-color:#222}
.sim-comment.is-posted{border-left-color:#16a34a40}
.sim-comment-header{display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:4px;flex-wrap:wrap}
.sim-author{color:#60a5fa;font-weight:600}
.sim-author.op{color:#2563eb;background:#2563eb15;padding:0 6px;border-radius:8px}
.sim-pts{color:#4ade80;font-weight:600}
.sim-sentiment{color:#a78bfa;font-size:10px;background:#a78bfa12;padding:1px 6px;border-radius:8px}
.sim-sentiment.megallm{color:#fbbf24;background:#fbbf2415}
.sim-time{color:#555}
.sim-comment-text{font-size:14px;white-space:pre-wrap;margin-bottom:6px;line-height:1.5}
.sim-comment-actions{display:flex;gap:6px;align-items:center}
.status-badge{font-size:10px;padding:2px 8px;border-radius:8px;font-weight:600}
.status-posted{background:#16a34a25;color:#4ade80}
.status-pending{background:#26262660;color:#888}
</style>
</head>
<body>
<div class="c">
<h1>Reddit Comment Assistant</h1>
<p class="sub">3 options per post &middot; scored for megallm benefit &middot; viral detection</p>

<div class="actions">
  <button onclick="fetchPosts()" id="fetchBtn">Fetch New Posts</button>
  <button onclick="draftAll()" id="draftBtn">Draft Comments (3 per post)</button>
  <button onclick="runSimulation()" id="simBtn">Generate Simulation</button>
  <button class="sec" onclick="clearDrafts()">Clear All Drafts</button>
</div>

<div class="stats" id="stats"></div>

<div class="tabs">
  <div class="tab active" data-tab="draft" onclick="switchTab('draft')">Drafts</div>
  <div class="tab" data-tab="posted" onclick="switchTab('posted')">Posted</div>
  <div class="tab" data-tab="skipped" onclick="switchTab('skipped')">Skipped</div>
  <div class="tab" data-tab="simulations" onclick="switchTab('simulations')" style="border-left:1px solid #262626;margin-left:8px">Simulations</div>
</div>

<div id="content"></div>
</div>

<script>
let tab='draft',all=[],sims=[],currentSim=null;

async function load(){
  all=await(await fetch('/api/drafts')).json();
  renderStats();render();
}

function renderStats(){
  const s={draft:0,posted:0,skipped:0,highPri:0,avgScore:0};
  let scoreSum=0;
  all.forEach(d=>{s[d.status]=(s[d.status]||0)+1;if(d.viralPotential==='high')s.highPri++;scoreSum+=d.megallmScore||0});
  s.avgScore=all.length?Math.round(scoreSum/all.length):0;
  document.getElementById('stats').innerHTML=
    st('Drafts',s.draft)+st('Posted',s.posted)+st('High Priority',s.highPri)+st('Avg Score',s.avgScore);
}

function st(l,v){return '<div class="st"><div class="st-v">'+v+'</div><div class="st-l">'+l+'</div></div>'}

function render(){
  if(tab==='simulations'){renderSimulations();return}
  const filtered=all.map((d,i)=>({...d,_i:i})).filter(d=>d.status===tab);
  if(!filtered.length){document.getElementById('content').innerHTML='<div class="empty">no '+tab+' comments</div>';return}
  const groups={};
  filtered.forEach(d=>{
    if(!groups[d.postId])groups[d.postId]={post:d,options:[]};
    groups[d.postId].options.push(d);
  });
  document.getElementById('content').innerHTML=Object.values(groups).map(g=>renderGroup(g)).join('');
}

function renderGroup(g){
  const p=g.post;
  const vb=p.viralPotential==='high'?'b-high':p.viralPotential==='medium'?'b-med':'b-low';
  const vl=p.viralPotential?p.viralPotential.toUpperCase():'';
  const vr=p.viralReasons?p.viralReasons.join(', '):'';

  return '<div class="post-group">'+
    '<div class="post-header">'+
      '<a href="'+esc(p.postUrl)+'" target="_blank">'+esc(p.postTitle)+'</a>'+
      '<div class="badges">'+
        '<span class="badge b-sub">r/'+esc(p.subreddit)+'</span>'+
        '<span class="badge b-ups">'+p.postUps+' pts</span>'+
        (vl?'<span class="badge '+vb+'">'+vl+'</span>':'')+
      '</div>'+
    '</div>'+
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
      '</div>'+
    '</div>'+
    '<div class="opt-actions">'+
      (d.status==='draft'?(
        '<button class="copy-btn" onclick="copyOpen('+i+')">Copy</button>'+
        '<button class="sec" onclick="toggleEdit('+i+')">Edit</button>'+
        '<button class="suc" onclick="posted('+i+')">Posted</button>'+
        '<button class="dan" onclick="skip('+i+')">Skip</button>'
      ):'<span style="font-size:11px;color:#666">'+(d.postedAt?timeAgo(d.postedAt):d.status)+'</span>')+
    '</div>'+
  '</div>';
}

/* ── Simulations ── */
// Text store: maps item IDs to their copyable text (avoids quote-escaping hell)
let simTextStore={};

async function loadSims(){
  sims=await(await fetch('/api/simulations')).json();
}

async function renderSimulations(){
  await loadSims();
  if(currentSim){renderSimDetail();return}
  if(!sims.length){
    document.getElementById('content').innerHTML='<div class="empty">no simulations yet. click "generate simulation" to create one.</div>';
    return;
  }
  let h='<ul class="sim-index">';
  sims.forEach(function(s){
    const pct=s.totalItems?Math.round(s.postedItems/s.totalItems*100):0;
    h+='<li><div class="sim-card" data-file="'+esc(s.filename)+'">'+
      '<div class="sim-card-top">'+
        '<div class="sim-num">'+s.index+'</div>'+
        '<div class="sim-title">'+esc(s.title)+'</div>'+
        '<div class="badges">'+
          '<span class="badge b-sub">r/'+esc(s.subreddit)+'</span>'+
          '<span class="badge b-low">'+esc(s.theme)+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="sim-meta">'+
        '<span>'+s.upvotes+' upvotes</span>'+
        '<span>'+s.totalComments+' comments</span>'+
        '<span>'+s.userCount+' users</span>'+
        '<span>'+s.megallmSeeds+' seeds</span>'+
        '<span>'+s.postedItems+'/'+s.totalItems+' posted</span>'+
        '<span>'+shortDate(s.generatedAt)+'</span>'+
      '</div>'+
      '<div class="sim-progress">'+
        '<div class="sim-bar"><div class="sim-bar-fill" style="width:'+pct+'%"></div></div>'+
        '<div class="sim-bar-pct">'+pct+'%</div>'+
      '</div>'+
    '</div></li>';
  });
  h+='</ul>';
  document.getElementById('content').innerHTML=h;
  // Attach click handlers via delegation
  document.querySelectorAll('.sim-card[data-file]').forEach(function(el){
    el.onclick=function(){openSim(el.dataset.file)};
  });
}

async function openSim(filename){
  currentSim=await(await fetch('/api/simulations/'+encodeURIComponent(filename))).json();
  currentSim._filename=filename;
  renderSimDetail();
}

function renderSimDetail(){
  const s=currentSim;
  const p=s.post;
  const postPosted=p._status==='posted';
  simTextStore={};
  // Store post text for copy
  simTextStore['post']=p.title+'\\n\\n'+p.body;

  let h='<div class="sim-detail-back" id="simBack">&larr; Back to simulations</div>';

  // Post block
  h+='<div class="sim-post-block">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
  h+='<div>';
  h+='<div class="sim-post-meta">';
  h+='<span class="badge b-sub">r/'+esc(p.subreddit)+'</span>';
  if(p.flair)h+='<span class="badge b-low">'+esc(p.flair)+'</span>';
  h+='<span>u/'+esc(p.author)+'</span>';
  h+='<span>'+p.upvotes+' pts</span>';
  h+='<span>'+esc(p.timeAgo||'')+'</span>';
  h+='</div>';
  h+='<div class="sim-post-title">'+esc(p.title)+'</div>';
  h+='</div>';
  h+='<span class="status-badge '+(postPosted?'status-posted':'status-pending')+'">'+(postPosted?'POSTED':'PENDING')+'</span>';
  h+='</div>';
  h+='<div class="sim-post-body">'+esc(p.body)+'</div>';
  h+='<div class="sim-post-actions">';
  if(!postPosted){
    h+='<button class="copy-btn" data-copyid="post">Copy Title + Body</button>';
    h+='<button class="suc" data-markid="post" data-markstatus="posted">Mark Posted</button>';
  } else {
    h+='<span style="font-size:11px;color:#4ade80">posted '+(p._postedAt?timeAgo(p._postedAt):'')+'</span>';
    h+='<button class="sec" style="font-size:11px;padding:4px 10px" data-markid="post" data-markstatus="draft">Undo</button>';
  }
  h+='</div></div>';

  // Comments header
  const totalC=countItems(s.comments);
  const postedC=countPostedItems(s.comments);
  const commentPct=totalC?Math.round(postedC/totalC*100):0;
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div style="font-size:15px;font-weight:600">Comments ('+postedC+'/'+totalC+' posted)</div>';
  h+='<div class="sim-progress" style="width:200px"><div class="sim-bar"><div class="sim-bar-fill" style="width:'+commentPct+'%"></div></div><div class="sim-bar-pct">'+commentPct+'%</div></div>';
  h+='</div>';

  // Comment tree
  h+='<div class="comment-thread">';
  (s.comments||[]).forEach(function(c){h+=renderSimComment(c,0)});
  h+='</div>';

  document.getElementById('content').innerHTML=h;

  // Attach event handlers via data attributes
  document.getElementById('simBack').onclick=closeSim;
  document.querySelectorAll('[data-copyid]').forEach(function(btn){
    btn.onclick=function(){simCopy(btn.dataset.copyid,btn)};
  });
  document.querySelectorAll('[data-markid]').forEach(function(btn){
    btn.onclick=function(){simMark(btn.dataset.markid,btn.dataset.markstatus)};
  });
}

function renderSimComment(c,depth){
  const isPosted=c._status==='posted';
  const isSeed=(c.sentiment||'').includes('megallm');
  const isOP=c.isOP;
  // Store text for copy
  simTextStore[c.id]=c.text;

  let h='<div class="sim-comment depth-'+Math.min(depth,2)+(isPosted?' is-posted':'')+'">';

  // Header
  h+='<div class="sim-comment-header">';
  h+='<span class="sim-author'+(isOP?' op':'')+'">u/'+esc(c.author)+(isOP?' [OP]':'')+'</span>';
  h+='<span class="sim-pts">'+(c.upvotes>=0?'+':'')+c.upvotes+'</span>';
  if(c.sentiment)h+='<span class="sim-sentiment'+(isSeed?' megallm':'')+'">'+esc(c.sentiment)+'</span>';
  if(c.postedAfter)h+='<span class="sim-time">'+esc(c.postedAfter)+'</span>';
  if(c.accountAge)h+='<span class="sim-time">'+esc(c.accountAge)+'</span>';
  h+='<span class="status-badge '+(isPosted?'status-posted':'status-pending')+'">'+(isPosted?'POSTED':'PENDING')+'</span>';
  h+='</div>';

  // Text
  h+='<div class="sim-comment-text">'+esc(c.text)+'</div>';

  // Actions
  h+='<div class="sim-comment-actions">';
  if(!isPosted){
    h+='<button class="copy-btn" data-copyid="'+esc(c.id)+'" style="font-size:11px;padding:4px 10px">Copy</button>';
    h+='<button class="suc" data-markid="'+esc(c.id)+'" data-markstatus="posted" style="font-size:11px;padding:4px 10px">Mark Posted</button>';
  } else {
    h+='<span style="font-size:10px;color:#4ade80">posted '+(c._postedAt?timeAgo(c._postedAt):'')+'</span>';
    h+='<button class="sec" data-markid="'+esc(c.id)+'" data-markstatus="draft" style="font-size:10px;padding:3px 8px">Undo</button>';
  }
  h+='</div>';

  // Nested replies
  if(c.replies&&c.replies.length){
    c.replies.forEach(function(r){h+=renderSimComment(r,depth+1)});
  }
  h+='</div>';
  return h;
}

function countItems(comments){
  let n=0;
  (comments||[]).forEach(function(c){n++;if(c.replies)n+=countItems(c.replies)});
  return n;
}
function countPostedItems(comments){
  let n=0;
  (comments||[]).forEach(function(c){if(c._status==='posted')n++;if(c.replies)n+=countPostedItems(c.replies)});
  return n;
}

async function simCopy(id,btnEl){
  const text=simTextStore[id]||'';
  await navigator.clipboard.writeText(text);
  if(btnEl){
    const orig=btnEl.textContent;
    btnEl.textContent='Copied!';btnEl.classList.add('copied');
    setTimeout(function(){btnEl.textContent=orig;btnEl.classList.remove('copied')},1500);
  }
}

async function simMark(id,status){
  await fetch('/api/simulations/'+encodeURIComponent(currentSim._filename)+'/mark',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,status:status})
  });
  currentSim=await(await fetch('/api/simulations/'+encodeURIComponent(currentSim._filename))).json();
  currentSim._filename=currentSim._filename;
  renderSimDetail();
}

function closeSim(){currentSim=null;renderSimulations()}

function shortDate(d){if(!d)return'';const dt=new Date(d);return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})}

/* ── Common ── */

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function timeAgo(d){const m=Math.floor((Date.now()-new Date(d))/6e4);return m<60?m+'m ago':m<1440?Math.floor(m/60)+'h ago':Math.floor(m/1440)+'d ago'}

async function copyOpen(i){
  await navigator.clipboard.writeText(all[i].comment);
  const b=document.querySelector('#opt-'+i+' .copy-btn');
  b.textContent='Copied!';b.classList.add('copied');
  setTimeout(()=>{b.textContent='Copy';b.classList.remove('copied')},1500);
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

async function posted(i){await fetch('/api/drafts/'+i+'/posted',{method:'POST'});all[i].status='posted';renderStats();render()}
async function skip(i){await fetch('/api/drafts/'+i+'/skip',{method:'POST'});all[i].status='skipped';renderStats();render()}

function switchTab(s){
  tab=s;currentSim=null;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelector('[data-tab="'+s+'"]').classList.add('active');
  render();
}

async function fetchPosts(){
  const b=document.getElementById('fetchBtn');b.disabled=true;b.textContent='Fetching...';
  try{const r=await(await fetch('/api/fetch',{method:'POST'})).json();b.textContent='Fetched '+r.count+'!';setTimeout(()=>{b.textContent='Fetch New Posts';b.disabled=false},2000)}
  catch(e){b.textContent='Error';b.disabled=false}
}

async function draftAll(){
  const b=document.getElementById('draftBtn');b.disabled=true;b.textContent='Drafting (takes ~1 min)...';
  try{const r=await(await fetch('/api/draft',{method:'POST'})).json();b.textContent='Drafted '+r.count+'!';await load();setTimeout(()=>{b.textContent='Draft Comments (3 per post)';b.disabled=false},2000)}
  catch(e){b.textContent='Error: '+e.message;b.disabled=false}
}

async function runSimulation(){
  const b=document.getElementById('simBtn');b.disabled=true;b.textContent='Generating (takes ~2 min)...';
  try{
    const r=await fetch('/api/simulate',{method:'POST'});
    const data=await r.json();
    if(!r.ok||data.error){
      b.textContent='Error: '+(data.error||'unknown').slice(0,50);
      setTimeout(()=>{b.textContent='Generate Simulation';b.disabled=false},4000);
      return;
    }
    b.textContent='Generated!';
    switchTab('simulations');
    setTimeout(()=>{b.textContent='Generate Simulation';b.disabled=false},2000);
  }catch(e){b.textContent='Error: '+e.message;setTimeout(()=>{b.textContent='Generate Simulation';b.disabled=false},4000)}
}

async function clearDrafts(){
  if(!confirm('Clear all drafts?'))return;
  await fetch('/api/clear-drafts',{method:'POST'});all=[];renderStats();render();
}

load();
</script>
</body></html>`;

// ── Start ────────────────────────────────────────────────

app.listen(CONFIG.port, () => {
  console.log("");
  console.log("  Reddit Comment Assistant v2");
  console.log("  http://localhost:" + CONFIG.port);
  console.log("");
  console.log("  Features:");
  console.log("  - 3 comment options per post (short, personal, perspective)");
  console.log("  - MegaLLM benefit score (0-100)");
  console.log("  - Viral potential detection (HIGH/MEDIUM/LOW)");
  console.log("  - Grouped by post, sorted by score");
  console.log("  - Simulated posts: full thread generation with 30-40 users");
  console.log("");
});
