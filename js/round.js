"use strict";
/*  LAYER 7: Timer + Coach                                         */
/* ═══════════════════════════════════════════════════════════════ */
let _ti=null,_ts=0,_te=0,_tr=false;
function startTimer(){ _ts=Date.now();_te=0;_tr=true;_ti=setInterval(()=>{if(_tr){_te=Date.now()-_ts;updateTimerDisplay();coachCheck();}},1000); }
function pauseTimer(){_tr=false;} function resumeTimer(){_tr=true;_ts=Date.now()-_te;}
function stopTimer(){if(_ti)clearInterval(_ti);_tr=false;return _te;}
function getElapsed(){return _tr?Date.now()-_ts:_te;}
function updateTimerDisplay(){ const e=document.getElementById('round-timer'); if(!e) return; const s=Math.floor(getElapsed()/1000); e.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
document.addEventListener('visibilitychange',()=>{ if(!AppState.currentRound||AppState.currentRound.status!=='active') return; if(document.hidden) pauseTimer(); else resumeTimer(); });

function coachCheck(){
  if(AppState.coachMode!=='moderate') return; const r=AppState.currentRound; if(!r||r.status!=='active') return;
  const elapsed=getElapsed(),ans=r.answers.filter(a=>a!==null),r3=ans.slice(-3).filter(a=>!a.isCorrect).length,r5=ans.slice(-5).filter(a=>!a.isCorrect).length;
  const b=document.getElementById('coach-banner'); let h='';
  if(elapsed>=60000){ r._skipShown=true; h='⏰ 超过1分钟 <button class="btn btn-sm btn-outline" onclick="handleCoachSkip()" style="margin-left:6px">跳过</button>'; b.className='coach-banner skip show'; }
  else if(elapsed>=40000){ r._hintShown=true; h='💡 超过40秒了，试试换个思路？'; b.className='coach-banner hint show'; }
  else if(r5>=5&&r5>(r._lastWarnCount||0)){ h='⚠️ 连续5题错误！<button class="btn btn-sm btn-outline" onclick="handleEndRound()" style="margin-left:6px">结束本轮</button>'; b.className='coach-banner warn5 show'; r._lastWarnCount=5; }
  else if(r3>=3&&r3>(r._lastWarnCount||0)){ h='⚠️ 连错3题，放慢节奏检查一下？'; b.className='coach-banner warn3 show'; r._lastWarnCount=3; }
  else return;
  if(h) b.innerHTML=h;
}
function handleCoachSkip(){ const r=AppState.currentRound; if(!r) return; const idx=r.currentIndex; stopTimer(); r.answers[idx]={questionIndex:idx,selectedPosition:null,timeMs:getElapsed(),isCorrect:false,isSkipped:true}; r._hintShown=false;r._skipShown=false;r._lastWarnCount=0; document.getElementById('coach-banner').className='coach-banner'; if(idx<r.questions.length-1){ r.currentIndex=idx+1; DB.saveCurrentRound(r); renderActiveQuestion(); } else handleCompleteRound(); }
function clearCoachBanner(){ document.getElementById('coach-banner').className='coach-banner'; document.getElementById('coach-banner').innerHTML=''; if(AppState.currentRound){AppState.currentRound._hintShown=false;AppState.currentRound._skipShown=false;AppState.currentRound._lastWarnCount=0;} }

/* ═══════════════════════════════════════════════════════════════ */
/*  LAYER 8: RoundManager                                          */
/* ═══════════════════════════════════════════════════════════════ */
function createRound(mode,tags){
  const gl=MODE_CONFIG[mode]?MODE_CONFIG[mode].gapLevel:'medium';
  const tids=selectTemplates(mode,tags,10);
  const qs=tids.map(tid=>generateQuestion(tid,gl));
  const r={id:'round_'+Date.now(),mode,gapLevel:gl,status:'active',questions:qs,currentIndex:0,answers:new Array(10).fill(null),coachWarnings:[],startedAt:Date.now(),completedAt:null,_hintShown:false,_skipShown:false};
  AppState.currentRound=r; DB.saveCurrentRound(r); return r;
}

function handleStartRound(){
  const ds=DB.getDailyState(),mode=AppState.pendingMode;
  if(mode!=='review'&&mode!=='diagnostic'&&ds.roundsCompleted>=5){ showToast('今日5轮已完成，明天再来或解锁升级版','#4F46E5'); return; }
  if(mode==='review'){ const w=DB.getWrongAnswers(); if(w.length===0){ showToast('暂无错题记录'); return; } }
  const r=createRound(mode,AppState.pendingTags); navigateTo('active-round'); renderActiveQuestion();
}

function renderActiveQuestion(){
  const r=AppState.currentRound; if(!r||r.status!=='active') return; const idx=r.currentIndex,q=r.questions[idx];
  document.getElementById('round-mode-label').textContent=r.mode==='diagnostic'?'摸底测试':(MODE_CONFIG[r.mode]?MODE_CONFIG[r.mode].name:r.mode);
  const totalQ=r.questions.length;
  document.getElementById('round-progress-text').textContent='第'+(idx+1)+'/'+totalQ+'题';
  document.getElementById('round-progress-fill').style.width=((idx+1)/totalQ*100)+'%';
  document.getElementById('q-number').textContent='Q'+(idx+1);
  document.getElementById('q-text').textContent=q.question.text;
  const g=document.getElementById('options-grid'),already=r.answers[idx]!==null;
  g.innerHTML=q.options.map(o=>{ let c='opt-btn'; if(already){ if(o.trapKey===null) c+=' correct'; else if(o.position===r.answers[idx].selectedPosition) c+=' wrong'; } return '<button class="'+c+'" data-pos="'+o.position+'"'+(already?' disabled':'')+'>'+o.position+'. '+o.display+'</button>'; }).join('');
  if(!already){ g.querySelectorAll('.opt-btn').forEach(b=>{ b.addEventListener('click',function(){submitAnswer(this.dataset.pos);}); }); r._hintShown=false;r._skipShown=false; clearCoachBanner(); startTimer(); }
  else updateTimerDisplay();
}

function submitAnswer(pos){
  const r=AppState.currentRound; if(!r||r.status!=='active') return; const idx=r.currentIndex,elapsed=stopTimer(); clearCoachBanner();
  const q=r.questions[idx],sel=q.options.find(o=>o.position===pos),isCorrect=sel&&sel.trapKey===null;
  r.answers[idx]={questionIndex:idx,selectedPosition:pos,timeMs:elapsed,isCorrect,trapHit:sel?sel.trapKey:null,trapType:sel?sel.trapType:null,isSkipped:false}; r._hintShown=false;r._skipShown=false;
  document.querySelectorAll('.opt-btn').forEach(b=>{ b.disabled=true; if(b.dataset.pos===pos) b.classList.add(isCorrect?'correct':'wrong'); const o=q.options.find(o=>o.position===b.dataset.pos); if(o&&o.trapKey===null) b.classList.add('correct'); });
  const rec={id:'ans_'+Date.now()+'_'+idx,roundId:r.id,timestamp:Date.now(),mode:r.mode,questionIndex:idx,templateId:q.templateId,question:{text:q.question.text},result:{isCorrect,selectedPosition:pos,correctPosition:q.options.find(o=>o.trapKey===null)?.position||'?',selectedValue:sel?sel.value:null,correctValue:q.correct.value},trap:sel&&sel.trapKey?{hit:sel.trapKey,type:sel.trapType,stage:getErrorStage(sel.trapKey),tip:TRAP_TIPS[sel.trapKey]?TRAP_TIPS[sel.trapKey].label:''}:null,timeSpentMs:elapsed,gapLevel:r.gapLevel,isSkipped:false};
  DB.appendAnswer(rec);
  if(!isCorrect&&!r.answers[idx].isSkipped) updateWeaknessProfile(rec);
  if(r.mode!=='review'){ const ds=DB.getDailyState(); ds.questionsAnswered++; if(isCorrect) ds.questionsCorrect++; DB.saveDailyState(ds); }
  DB.saveCurrentRound(r);
  setTimeout(()=>{ if(idx<r.questions.length-1){ r.currentIndex=idx+1; DB.saveCurrentRound(r); renderActiveQuestion(); } else handleCompleteRound(); },800);
}

function handleCompleteRound(){
  stopTimer(); clearCoachBanner(); const r=AppState.currentRound; if(!r) return; r.status='completed'; r.completedAt=Date.now(); DB.clearCurrentRound();
  if(r.mode==='diagnostic'){ DB.setDiagCompleted(); AppState.diagnosticCompleted=true; }
  if(r.mode!=='review'&&r.mode!=='diagnostic'){ const ds=DB.getDailyState(); ds.roundsCompleted++; ds.roundIds.push(r.id); DB.saveDailyState(ds); }
  if(r.mode==='review'){ r.answers.forEach(a=>{ if(a&&a.isCorrect&&!a.isSkipped){ const wrongs=DB.getWrongAnswers(); const match=wrongs.find(w=>w.templateId===r.questions[a.questionIndex].templateId); if(match) DB.removeWrongAnswer(match.id); } }); }
  AppState.currentRound=r; navigateTo('round-result');
}

function handleEndRound(){ stopTimer(); clearCoachBanner(); showConfirm('确定结束本轮？已答题目不保存。',()=>{ if(AppState.currentRound){ AppState.currentRound.status='abandoned'; DB.clearCurrentRound(); } AppState.currentRound=null; navigateTo('home'); }); }

/* ═══════════════════════════════════════════════════════════════ */
/*  LAYER 9: Diagnosis Engine                                      */
/* ═══════════════════════════════════════════════════════════════ */
function updateWeaknessProfile(rec){ const p=DB.getProfile(); p.totalWrong++; const tid=rec.templateId; if(!p.byTemplate[tid]) p.byTemplate[tid]={wrong:0,total:0}; p.byTemplate[tid].wrong++;p.byTemplate[tid].total++; if(rec.trap&&rec.trap.hit){ const tk=rec.trap.hit; if(!p.byTrap[tk]) p.byTrap[tk]={wrong:0,totalExposed:0}; p.byTrap[tk].wrong++;p.byTrap[tk].totalExposed++; p.byErrorStage[rec.trap.stage]++; } DB.saveProfile(p); }

function checkDiagnosisTrigger(){
  const p=DB.getProfile(); if(p.totalWrong<8) return null;
  const tT=Object.values(p.byTrap).some(t=>t.wrong>=3),tTmpl=Object.values(p.byTemplate).some(t=>t.wrong>=3),tS=Object.values(p.byErrorStage).some(s=>s>=3);
  if(!(tT||tTmpl||tS)) return null;
  const log=DB.getDiagnosisLog(); if(log.length>0){ const last=log[log.length-1],ds=DB.getDailyState(),roundsSince=ds.roundIds.indexOf(last.afterRoundId); if(roundsSince>=0&&roundsSince<2) return null; }
  return getDiagnosisReport();
}

function getDiagnosisReport(){
  const p=DB.getProfile(); const bt=Object.entries(p.byTrap).sort((a,b)=>b[1].wrong-a[1].wrong),bTm=Object.entries(p.byTemplate).sort((a,b)=>b[1].wrong-a[1].wrong);
  const tr=bt.slice(0,3).map(([k,v])=>({key:k,...v,label:TRAP_TIPS[k]?TRAP_TIPS[k].label:k}));
  const tm=bTm.slice(0,3).map(([k,v])=>({key:k,...v,name:TEMPLATE_MAP[k]?TEMPLATE_MAP[k].name:k}));
  let s=''; if(tr.length>0) s+='最常踩陷阱:"'+tr[0].label+'"'; if(tm.length>0) s+='，薄弱模板:"'+tm[0].name+'"';
  return {summary:s||'数据积累中',topTraps:tr,topTemplates:tm,stageBreakdown:p.byErrorStage,recommendation:p.byErrorStage.comprehension_error>p.byErrorStage.computation_error?'建议优先基础巩固':'建议拔高挑战练习技巧'};
}

/* ═══════════════════════════════════════════════════════════════ */
/*  LAYER 10: Round Result + Diagnosis UI                           */
/* ═══════════════════════════════════════════════════════════════ */
function renderRoundResult(){
  const r=AppState.currentRound; if(!r){ navigateTo('home'); return; }
  const va=r.answers.filter(a=>a!==null&&!a.isSkipped),correct=va.filter(a=>a.isCorrect).length,totalT=va.reduce((s,a)=>s+a.timeMs,0),avgT=va.length?Math.round(totalT/va.length/1000):0,score=va.length?Math.round(correct/va.length*100):0;
  let sc='good'; if(score<60) sc='bad'; else if(score<80) sc='ok';
  document.getElementById('result-score').textContent=correct+'/'+r.questions.length;
  document.getElementById('result-score').className='score '+sc;
  document.getElementById('result-meta').textContent='正确率'+score+'% · 用时'+Math.floor(totalT/60000)+'分'+Math.round((totalT%60000)/1000)+'秒 · 平均'+avgT+'秒/题';
  const diag=checkDiagnosisTrigger(),dd=document.getElementById('diag-trigger');
  if(diag){ dd.style.display='block'; dd.innerHTML='<strong>📋 弱点诊断已触发</strong><br>'+diag.summary+'<br><button class="btn btn-sm btn-outline mt-8" onclick="renderDiagnosis()">查看完整画像</button>'; DB.appendDiagnosis({triggeredAt:Date.now(),triggerType:'automatic',afterRoundId:r.id}); }
  else dd.style.display='none';
  document.getElementById('feedback-list').innerHTML=r.questions.map((q,i)=>{ const a=r.answers[i]; if(!a) return '<div class="feedback-item"><div class="fb-header"><span class="fb-q">Q'+(i+1)+' '+q.templateName+'</span><span class="text-muted text-xs">未答</span></div></div>';
    const icon=a.isCorrect?'✓':'✗',cls=a.isCorrect?'fb-correct':'fb-wrong'; let detail='';
    if(!a.isCorrect&&!a.isSkipped&&a.trapHit&&TRAP_TIPS[a.trapHit]){ const tp=TRAP_TIPS[a.trapHit]; detail='<div style="color:#EF4444;margin-top:4px">你选: '+a.selectedPosition+'</div><div style="color:#10B981;margin-top:2px">正确: '+q.correct.display+'</div><span class="trap-tag">'+tp.label+'</span><div class="tip-text">'+tp.tip+'</div><div class="mnemonic">📝 '+tp.mnemonic+'</div>'; }
    else if(a.isSkipped) detail='<div style="color:#9CA3AF;margin-top:4px">已跳过</div>';
    return '<div class="feedback-item" onclick="toggleFB(this)"><div class="fb-header"><span class="fb-q '+cls+'">'+icon+' Q'+(i+1)+' '+q.templateName+'</span><span class="text-muted text-xs">'+Math.round((a.timeMs||0)/1000)+'秒</span></div><div class="fb-detail">'+detail+'</div></div>'; }).join('');
  const nb=document.getElementById('btn-next-round');
  if(r.mode!=='review'){ const ds=DB.getDailyState(); if(ds.roundsCompleted>=5){ nb.textContent='明天再来 / 解锁升级版'; nb.disabled=true; } else { nb.textContent='再来一轮'; nb.disabled=false; } }
  else { const wr=DB.getWrongAnswers().length; nb.textContent=wr>0?'再练一轮错题('+wr+'题)':'错题已清空'; nb.disabled=wr===0; }
}
function toggleFB(el){ const d=el.querySelector('.fb-detail'); if(d) d.classList.toggle('open'); }
function goNextRound(){ const pr=AppState.currentRound; if(pr){ AppState.pendingMode=pr.mode; AppState.pendingTags=[]; handleStartRound(); } else navigateTo('home'); }
function renderDiagnosis(){
  const diag=getDiagnosisReport();
  if(DB.getProfile().totalWrong<5){ document.getElementById('diagnosis-content').innerHTML='<div class="text-center text-muted" style="padding:20px">还不够5道错题，再练几轮吧。</div>'; }
  else { document.getElementById('diagnosis-content').innerHTML='<div class="card mb-12"><strong>📝 '+diag.summary+'</strong></div><h3 style="margin-bottom:8px">错误阶段分布</h3><div class="stage-bars">'+['comprehension_error','transformation_error','computation_error'].map(s=>{ const labels={comprehension_error:'理解层(读题)',transformation_error:'转换层(策略)',computation_error:'计算层(执行)'},c=diag.stageBreakdown[s]||0,mx=Math.max(1,...Object.values(diag.stageBreakdown)),pct=Math.round(c/mx*100); return '<div class="stage-bar-row"><span class="stage-label">'+labels[s]+'</span><div class="stage-track"><div class="stage-fill '+s.slice(0,4)+'" style="width:'+pct+'%"></div></div><span>'+c+'次</span></div>'; }).join('')+'</div><h3 style="margin-bottom:8px">薄弱模板 TOP3</h3><div class="weakness-list">'+diag.topTemplates.map(t=>'<div class="weakness-item"><span class="w-name">'+t.name+'</span><span class="w-count">'+t.wrong+'次</span></div>').join('')+'</div><h3 style="margin-bottom:8px">最常踩陷阱 TOP3</h3><div class="weakness-list">'+diag.topTraps.map(t=>'<div class="weakness-item"><span class="w-name">'+t.label+'</span><span class="w-count">'+t.wrong+'次</span></div>').join('')+'</div><div class="card text-sm text-muted"><strong>建议：</strong>'+diag.recommendation+'</div>'; }
  document.getElementById('diagnosis-modal').classList.add('show');
}
function closeDiagnosis(){ document.getElementById('diagnosis-modal').classList.remove('show'); }

/*  LAYER 11: History Screen                                       */
/* ═══════════════════════════════════════════════════════════════ */
function renderHistory(){
  const all=DB.getAnswers(); if(all.length===0){ document.getElementById('history-list').innerHTML='<div class="text-center text-muted mt-12">暂无练习记录</div>'; return; }
  const bd={}; all.forEach(r=>{ const d=new Date(r.timestamp).toISOString().slice(0,10); if(!bd[d]) bd[d]={rounds:{},list:[]}; const rk=r.roundId; if(!bd[d].rounds[rk]){ bd[d].rounds[rk]={mode:r.mode,correct:0,total:0,totalTime:0,count:0}; bd[d].list.push(bd[d].rounds[rk]); } bd[d].rounds[rk].total++;bd[d].rounds[rk].totalTime+=r.timeSpentMs; if(r.result.isCorrect) bd[d].rounds[rk].correct++; });
  const dates=Object.keys(bd).sort().reverse(); let h=''; dates.forEach(d=>{ h+='<div class="history-day"><div class="day-label">'+d+'</div>'; bd[d].list.forEach(r=>{ const nm=MODE_CONFIG[r.mode]?MODE_CONFIG[r.mode].name:r.mode,pct=Math.round(r.correct/r.total*100),sec=Math.round(r.totalTime/1000); h+='<div class="history-round"><span>'+nm+'</span><span style="color:'+(pct>=80?'#10B981':pct>=60?'#F59E0B':'#EF4444')+';font-weight:700">'+r.correct+'/'+r.total+' ('+pct+'%)</span><span class="text-muted text-xs">'+Math.floor(sec/60)+'分'+(sec%60)+'秒</span></div>'; }); h+='</div>'; });
  document.getElementById('history-list').innerHTML=h;
}
