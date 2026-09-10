"use strict";
/*  LAYER 2: Browser-local data store                              */
/* ═══════════════════════════════════════════════════════════════ */
const DATA_SCHEMA_VERSION = 2;
const STORAGE_LIMITS = { answerHistory:2000, diagnosisLog:100 };
const DATA_KEYS = ['answerHistory','weaknessProfile','dailyState','settings','currentRound','diagnosisLog','diagCompleted','reviewPool'];

function sGet(k,f) { try { const v=localStorage.getItem('as_'+k); return v!==null?JSON.parse(v):f; } catch(e) { return f; } }
function sSet(k,v) { try { localStorage.setItem('as_'+k, JSON.stringify(v)); return true; } catch(e) { return false; } }
function evictFIFO(a,n) { return a.length>n?a.slice(-n):a; }
function localDateKey(ts){ const d=new Date(ts||Date.now()); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

function normalizeAttempt(r){
  const tid=r.template_id||r.templateId||'';
  const meta=typeof TRAINING_META!=='undefined'?(TRAINING_META[tid]||{}):{};
  const submitted=r.submitted_at||r.timestamp||Date.now();
  const duration=Number(r.duration_ms!==undefined?r.duration_ms:(r.timeSpentMs||0));
  const correct=r.is_correct!==undefined?!!r.is_correct:!!(r.result&&r.result.isCorrect);
  const target=Number(r.target_time_ms||meta.target_time_ms||30000);
  const skipped=r.is_skipped!==undefined?!!r.is_skipped:!!r.isSkipped;
  const normalized={
    ...r,
    attempt_id:r.attempt_id||r.id||('ans_'+submitted),
    question_id:r.question_id||(r.question&&r.question.id)||((r.roundId||r.session_id||'session')+'_'+(r.questionIndex||0)),
    session_id:r.session_id||r.roundId||'',
    question_text:r.question_text||(r.question&&r.question.text)||'',
    template_id:tid,
    skill:r.skill||meta.skill||'综合计算',
    cognitive_load:r.cognitive_load||meta.cognitive_load||'中',
    number_structure:r.number_structure||meta.number_structure||'一般数字结构',
    best_strategy:r.best_strategy||meta.best_strategy||'先判断结构再计算',
    target_time_ms:target,
    target_time:target,
    shown_at:r.shown_at||(submitted-duration),
    submitted_at:submitted,
    duration_ms:duration,
    user_answer:r.user_answer!==undefined?r.user_answer:(r.result?r.result.selectedPosition:null),
    answer:r.answer!==undefined?r.answer:(r.result?r.result.correctValue:null),
    is_correct:correct,
    is_slow:r.is_slow!==undefined?!!r.is_slow:(correct&&duration>target),
    is_skipped:skipped,
    attempt_type:r.attempt_type||((r.mode==='review')?'review':(r.mode==='diagnostic'?'diagnostic':'practice'))
  };
  normalized.passed=normalized.is_correct&&!normalized.is_slow&&!normalized.is_skipped;
  normalized.id=normalized.attempt_id;
  normalized.roundId=normalized.session_id;
  normalized.timestamp=normalized.submitted_at;
  normalized.templateId=normalized.template_id;
  normalized.timeSpentMs=normalized.duration_ms;
  normalized.isSkipped=normalized.is_skipped;
  normalized.result={...(r.result||{}),isCorrect:normalized.is_correct,selectedPosition:normalized.user_answer,correctValue:normalized.answer};
  return normalized;
}

const DB = {
  ensureSchema(){ if(!localStorage.getItem('as_schemaVersion')) localStorage.setItem('as_schemaVersion',String(DATA_SCHEMA_VERSION)); },
  getAnswers(){ return sGet('answerHistory',[]).map(normalizeAttempt); },
  getAttempts(){ return this.getAnswers(); },
  appendAnswer(r){ let a=this.getAnswers(); a.push(normalizeAttempt(r)); a=evictFIFO(a,STORAGE_LIMITS.answerHistory); return sSet('answerHistory',a); },
  getWrongAnswers(){ return this.getAnswers().filter(r=>!r.is_correct||r.is_skipped); },
  removeWrongAnswer(id){ let a=this.getAnswers(); a=a.filter(r=>r.attempt_id!==id); return sSet('answerHistory',a); },
  getProfile(){ return sGet('weaknessProfile',{totalWrong:0,byTemplate:{},byTrap:{},byErrorStage:{comprehension_error:0,transformation_error:0,computation_error:0},lastUpdated:0}); },
  saveProfile(p){ p.lastUpdated=Date.now(); return sSet('weaknessProfile',p); },
  getDailyState(){
    const today=localDateKey();
    let ds=sGet('dailyState',{date:today,roundsCompleted:0,questionsAnswered:0,questionsCorrect:0,roundIds:[]});
    if(ds.date!==today){ ds={date:today,roundsCompleted:0,questionsAnswered:0,questionsCorrect:0,roundIds:[]}; sSet('dailyState',ds); }
    return ds;
  },
  saveDailyState(ds){ return sSet('dailyState',ds); },
  getSettings(){ return {...{coachMode:'moderate'},...sGet('settings',{})}; },
  saveSettings(s){ return sSet('settings',s); },
  saveCurrentRound(r){ return sSet('currentRound',r); },
  loadCurrentRound(){ const r=sGet('currentRound',null); if(!r) return null; if(Date.now()-r.startedAt>7200000){ sSet('currentRound',null); return null; } return r; },
  clearCurrentRound(){ sSet('currentRound',null); },
  getDiagnosisLog(){ return sGet('diagnosisLog',[]); },
  appendDiagnosis(e){ let a=this.getDiagnosisLog(); a.push(e); a=evictFIFO(a,STORAGE_LIMITS.diagnosisLog); return sSet('diagnosisLog',a); },
  isDiagCompleted(){ return sGet('diagCompleted',false); },
  setDiagCompleted(){ sSet('diagCompleted',true); },
  getReviewPool(){ return sGet('reviewPool',[]); },
  saveReviewPool(items){ return sSet('reviewPool',items); },
  getReviewTargets(includeFuture){
    const now=Date.now(),active=this.getReviewPool().filter(x=>x.status!=='mastered'),due=active.filter(x=>(x.due_at||0)<=now);
    return (includeFuture?active:due).sort((a,b)=>(a.due_at||0)-(b.due_at||0));
  },
  upsertReviewFailure(attempt,reasons){
    const key=attempt.skill+'|'+attempt.number_structure,now=Date.now(),pool=this.getReviewPool(); let item=pool.find(x=>x.key===key);
    if(!item){ item={key,skill:attempt.skill,number_structure:attempt.number_structure,template_id:attempt.template_id,reasons:[],due_at:now,success_streak:0,status:'active',created_at:now}; pool.push(item); }
    item.template_id=attempt.template_id; item.reasons=[...new Set([...(item.reasons||[]),...reasons])]; item.due_at=now; item.success_streak=0; item.status='active'; item.last_failure_at=now; item.last_attempt_at=now;
    this.saveReviewPool(pool); return item;
  },
  advanceReview(attempt){
    const key=attempt.skill+'|'+attempt.number_structure,pool=this.getReviewPool(),item=pool.find(x=>x.key===key&&x.status!=='mastered');
    if(!item) return null;
    const now=Date.now(); item.success_streak=(item.success_streak||0)+1; item.last_attempt_at=now;
    if(item.success_streak>=3){ item.status='mastered'; item.due_at=null; }
    else { item.status='active'; item.due_at=now+(item.success_streak===1?86400000:259200000); }
    this.saveReviewPool(pool); return item;
  },
  exportSnapshot(){ const data={}; DATA_KEYS.forEach(k=>data[k]=sGet(k,null)); return {app:'AI速算',schema_version:DATA_SCHEMA_VERSION,exported_at:new Date().toISOString(),data}; },
  importSnapshot(snapshot){
    if(!snapshot||snapshot.app!=='AI速算'||!snapshot.data||typeof snapshot.data!=='object') throw new Error('不是有效的AI速算数据文件');
    DATA_KEYS.forEach(k=>{ if(Object.prototype.hasOwnProperty.call(snapshot.data,k)&&snapshot.data[k]!==null) sSet(k,snapshot.data[k]); else localStorage.removeItem('as_'+k); });
    localStorage.setItem('as_schemaVersion',String(DATA_SCHEMA_VERSION)); return true;
  },
  async sync(){ return; }
};
