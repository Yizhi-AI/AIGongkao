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
  if(screen==='mastery') renderMastery();
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
  const valid=all.filter(r=>!r.is_skipped),correct=valid.filter(r=>r.is_correct).length;
  const acc=Math.round(correct/Math.max(1,valid.length)*100);
  const medianSec=Math.round(median(valid.map(r=>r.duration_ms))/1000);
  const profile=DB.getProfile();
  const topTrap=Object.entries(profile.byTrap).sort((a,b)=>b[1].wrong-a[1].wrong)[0];
  const topTrapName=topTrap&&TRAP_TIPS[topTrap[0]]?TRAP_TIPS[topTrap[0]].label:'';

  let level,stars;
  if(acc>=85&&medianSec<25){ level='速算高手'; stars='⭐⭐⭐⭐⭐'; }
  else if(acc>=75&&medianSec<40){ level='进阶练习者'; stars='⭐⭐⭐⭐'; }
  else if(acc>=65){ level='稳定发挥'; stars='⭐⭐⭐'; }
  else if(acc>=50){ level='成长中'; stars='⭐⭐'; }
  else { level='新手起步'; stars='⭐'; }

  return {level,stars,acc,medianSec,totalQ:valid.length,topTrapName};
}

function renderHome(){
  const ds=DB.getDailyState();
  const r=getRating();
  const rc=document.getElementById('rating-card');
  if(r){
    rc.style.display='flex';
    rc.querySelector('.r-level').textContent=r.level;
    rc.querySelector('.r-stars').textContent=r.stars;
    rc.querySelector('.r-stats').innerHTML='正确率 <b>'+r.acc+'%</b> · 中位每题 <b>'+r.medianSec+'s</b> · 共 '+r.totalQ+' 题';
    rc.querySelector('.r-weakness').textContent=r.topTrapName?'弱项: '+r.topTrapName:'';
  } else { rc.style.display='none'; }

  const today=getTodaySummary(),pending=DB.getReviewTargets(true).length,focus=getRecommendedFocus();
  document.getElementById('daily-bar').innerHTML='<div class="label">今日练习 · 随时开始，不设固定进度</div><div class="progress-track"><div class="progress-fill" style="width:'+(today.count?Math.round(today.accuracy*100):0)+'%"></div></div><div class="stats">'+today.count+'题 · 正确率'+Math.round(today.accuracy*100)+'% · 中位'+Math.round(today.median_ms/1000)+'秒 · 待强化'+pending+'类</div><div class="today-focus">建议重点：'+focus+'</div>';
  const reviewBtn=document.getElementById('review-btn'); if(reviewBtn){ reviewBtn.textContent=pending?'🔄 待强化训练（'+pending+'类）':'🔄 暂无待强化内容'; reviewBtn.disabled=pending===0; }
  document.getElementById('diag-banner').style.display=DB.isDiagCompleted()?'none':'block';
}

function showPlaceholder(name){ const t=document.createElement('div'); t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 20px;border-radius:20px;font-size:14px;z-index:300;'; t.textContent='🔒 '+name+' — 付费版'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000); }

function handleModeClick(mode){
  if(mode==='review'){ const w=DB.getReviewTargets(true); if(w.length===0){ showToast('暂无待强化内容'); return; } AppState.pendingMode='review'; AppState.pendingTags=[]; handleStartRound(); return; }
  AppState.pendingMode=mode; AppState.pendingTags=[]; navigateTo('mode-select');
}
function renderModeSelect(){
  const m=AppState.pendingMode; const cfg={smart:{name:'智能训练',desc:'优先安排错题、慢题、不稳定结构和到期复习。'},random:{name:'随机出题',desc:'从已完成的题型生成器中随机抽取10题。'},basic:{name:'基础巩固',desc:'数字更友好（2-3位为主），更多百化分特殊值。'},advanced:{name:'拔高挑战',desc:'数字更大（3-4位），步骤更多，陷阱更隐蔽。'},selftrain:{name:'自选练习',desc:'按运算类型选择模板分组。'}}[m]||{name:m,desc:''};
  document.getElementById('mode-select-title').textContent=cfg.name; document.getElementById('mode-select-desc').textContent=cfg.desc;
  const tp=document.getElementById('tag-panel'),tc=document.getElementById('tag-chips');
  if(m==='selftrain'){ tp.style.display='block'; const tags=['加减法','乘法','除法','复合/比较']; tc.innerHTML=tags.map(t=>'<span class="tag-chip" data-tag="'+t+'" onclick="toggleTag(this)">'+t+'</span>').join(''); }
  else { tp.style.display='none'; AppState.pendingTags=[]; }
}
function toggleTag(el){ el.classList.toggle('selected'); AppState.pendingTags=[...document.querySelectorAll('#tag-chips .tag-chip.selected')].map(e=>e.dataset.tag); }

function renderMastery(){
  const stats=getMasteryStats(),root=document.getElementById('mastery-content');
  if(!stats.length){ root.innerHTML='<div class="card text-center text-muted">完成一轮练习后，这里会按技能和数字结构显示熟练度。</div>'; return; }
  const counts={'未掌握':0,'会做但慢':0,'不稳定':0,'已自动化':0}; stats.forEach(x=>counts[x.mastery_level]++);
  let h='<div class="mastery-summary">'+Object.entries(counts).map(([k,v])=>'<div><strong>'+v+'</strong><span>'+k+'</span></div>').join('')+'</div>';
  h+=stats.map(x=>'<div class="mastery-card"><div class="mastery-head"><strong>'+x.skill+'</strong><span class="mastery-level level-'+x.mastery_level+'">'+x.mastery_level+'</span></div><div class="mastery-structure">'+x.number_structure+'</div><div class="mastery-meta">练习 '+x.attempt_count+' 次 · 正确率 '+Math.round(x.accuracy*100)+'% · 中位 '+Math.round(x.median_time/1000)+' 秒</div></div>').join('');
  root.innerHTML=h;
}
