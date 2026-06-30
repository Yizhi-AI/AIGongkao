"use strict";
/*  LAYER 6: App State + Navigation                                */
/* ═══════════════════════════════════════════════════════════════ */
let AppState={currentScreen:'home',previousScreen:null,currentRound:null,pendingMode:null,pendingTags:[],coachMode:'moderate',diagnosticCompleted:false};

function navigateTo(screen){
  const guard=(AppState.currentScreen==='active-round'&&AppState.currentRound&&AppState.currentRound.status==='active');
  if(guard&&screen!=='active-round'&&screen!=='round-result'){ showConfirm('确定退出本轮？进度将丢失。',()=>doNav(screen)); }
  else doNav(screen);
}
function doNav(screen){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const t=document.getElementById(screen+'-screen'); if(t) t.classList.add('active');
  AppState.previousScreen=AppState.currentScreen; AppState.currentScreen=screen;
  if(screen==='home') renderHome();
  if(screen==='history') renderHistory();
  if(screen==='mode-select') renderModeSelect();
  if(screen==='round-result') renderRoundResult();
}

let _cr=null;
function showConfirm(msg,onOk){ document.getElementById('confirm-msg').textContent=msg; document.getElementById('confirm-overlay').classList.add('show'); _cr=onOk; }
document.getElementById('confirm-ok').addEventListener('click',()=>{ document.getElementById('confirm-overlay').classList.remove('show'); if(_cr){_cr();_cr=null;} });
document.getElementById('confirm-cancel').addEventListener('click',()=>{ document.getElementById('confirm-overlay').classList.remove('show'); _cr=null; });

function loadSettings(){ const s=DB.getSettings(); if(s.coachMode) AppState.coachMode=s.coachMode; updateCoachToggle(); }
function saveSettings(){ DB.saveSettings({coachMode:AppState.coachMode}); }
function setCoachMode(v){ AppState.coachMode=v; saveSettings(); updateCoachToggle(); }
function updateCoachToggle(){ document.querySelectorAll('#coach-toggle .toggle-opt').forEach(e=>e.classList.toggle('active',e.dataset.val===AppState.coachMode)); }

function getRating(){
  const all=DB.getAnswers(); if(all.length<10) return null;
  const correct=all.filter(r=>r.result.isCorrect).length;
  const acc=Math.round(correct/all.length*100);
  const avgMs=Math.round(all.reduce((s,r)=>s+r.timeSpentMs,0)/all.length);
  const avgSec=Math.round(avgMs/1000);
  const profile=DB.getProfile();
  const topTrap=Object.entries(profile.byTrap).sort((a,b)=>b[1].wrong-a[1].wrong)[0];
  const topTrapName=topTrap&&TRAP_TIPS[topTrap[0]]?TRAP_TIPS[topTrap[0]].label:'';

  let level,stars;
  if(acc>=85&&avgSec<25){ level='速算高手'; stars='⭐⭐⭐⭐⭐'; }
  else if(acc>=75&&avgSec<40){ level='进阶练习者'; stars='⭐⭐⭐⭐'; }
  else if(acc>=65){ level='稳定发挥'; stars='⭐⭐⭐'; }
  else if(acc>=50){ level='成长中'; stars='⭐⭐'; }
  else { level='新手起步'; stars='⭐'; }

  return {level,stars,acc,avgSec,totalQ:all.length,topTrapName};
}

function renderHome(){
  const ds=DB.getDailyState();
  const r=getRating();
  const rc=document.getElementById('rating-card');
  if(r){
    rc.style.display='flex';
    rc.querySelector('.r-level').textContent=r.level;
    rc.querySelector('.r-stars').textContent=r.stars;
    rc.querySelector('.r-stats').innerHTML='正确率 <b>'+r.acc+'%</b> · 平均每题 <b>'+r.avgSec+'s</b> · 共 '+r.totalQ+' 题';
    rc.querySelector('.r-weakness').textContent=r.topTrapName?'弱项: '+r.topTrapName:'';
  } else { rc.style.display='none'; }

  document.getElementById('daily-bar').innerHTML='<div class="label">今日练习</div><div class="progress-track"><div class="progress-fill" style="width:'+(ds.roundsCompleted/5*100)+'%"></div></div><div class="stats">'+ds.roundsCompleted+'/5轮 · 共'+ds.questionsAnswered+'题 · 正确'+ds.questionsCorrect+'题</div>';
  document.getElementById('diag-banner').style.display=DB.isDiagCompleted()?'none':'block';
}

function showPlaceholder(name){ const t=document.createElement('div'); t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 20px;border-radius:20px;font-size:14px;z-index:300;'; t.textContent='🔒 '+name+' — 付费版'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000); }

function handleModeClick(mode){
  if(mode==='review'){ const w=DB.getWrongAnswers(); if(w.length===0){ showToast('暂无错题记录'); return; } AppState.pendingMode='review'; AppState.pendingTags=[]; handleStartRound(); return; }
  AppState.pendingMode=mode; AppState.pendingTags=[]; navigateTo('mode-select');
}
function renderModeSelect(){
  const m=AppState.pendingMode; const cfg={random:{name:'随机出题',desc:'从全部模板均匀随机抽取10题。'},basic:{name:'基础巩固',desc:'数字更友好（2-3位为主），更多百化分特殊值。'},advanced:{name:'拔高挑战',desc:'数字更大（3-4位），步骤更多，陷阱更隐蔽。'},selftrain:{name:'自选练习',desc:'按运算类型选择模板分组。'}}[m]||{name:m,desc:''};
  document.getElementById('mode-select-title').textContent=cfg.name; document.getElementById('mode-select-desc').textContent=cfg.desc;
  const tp=document.getElementById('tag-panel'),tc=document.getElementById('tag-chips');
  if(m==='selftrain'){ tp.style.display='block'; const tags=['加减法','乘法','除法','复合/比较']; tc.innerHTML=tags.map(t=>'<span class="tag-chip" data-tag="'+t+'" onclick="toggleTag(this)">'+t+'</span>').join(''); }
  else { tp.style.display='none'; AppState.pendingTags=[]; }
}
function toggleTag(el){ el.classList.toggle('selected'); AppState.pendingTags=[...document.querySelectorAll('#tag-chips .tag-chip.selected')].map(e=>e.dataset.tag); }
