"use strict";
/*  LAYER 2: Storage (DB)                                         */
/* ═══════════════════════════════════════════════════════════════ */
const STORAGE_LIMITS = { answerHistory:200, diagnosisLog:50 };

function sGet(k,f) { try { const v=localStorage.getItem('as_'+k); return v!==null?JSON.parse(v):f; } catch(e) { return f; } }
function sSet(k,v) { try { localStorage.setItem('as_'+k, JSON.stringify(v)); return true; } catch(e) { return false; } }
function evictFIFO(a,n) { return a.length>n?a.slice(-n):a; }

const DB = {
  getAnswers(){ return sGet('answerHistory',[]); },
  appendAnswer(r){ let a=this.getAnswers(); a.push(r); a=evictFIFO(a,STORAGE_LIMITS.answerHistory); return sSet('answerHistory',a); },
  getWrongAnswers(){ return this.getAnswers().filter(r=>!r.result.isCorrect); },
  removeWrongAnswer(id){ let a=this.getAnswers(); a=a.filter(r=>r.id!==id); return sSet('answerHistory',a); },
  getProfile(){ return sGet('weaknessProfile',{totalWrong:0,byTemplate:{},byTrap:{},byErrorStage:{comprehension_error:0,transformation_error:0,computation_error:0},lastUpdated:0}); },
  saveProfile(p){ p.lastUpdated=Date.now(); return sSet('weaknessProfile',p); },
  getDailyState(){
    const today=new Date().toISOString().slice(0,10);
    let ds=sGet('dailyState',{date:today,roundsCompleted:0,questionsAnswered:0,questionsCorrect:0,roundIds:[]});
    if(ds.date!==today){ ds={date:today,roundsCompleted:0,questionsAnswered:0,questionsCorrect:0,roundIds:[]}; sSet('dailyState',ds); }
    return ds;
  },
  saveDailyState(ds){ return sSet('dailyState',ds); },
  getSettings(){ return sGet('settings',{coachMode:'moderate'}); },
  saveSettings(s){ return sSet('settings',s); },
  saveCurrentRound(r){ return sSet('currentRound',r); },
  loadCurrentRound(){ const r=sGet('currentRound',null); if(!r) return null; if(Date.now()-r.startedAt>7200000){ sSet('currentRound',null); return null; } return r; },
  clearCurrentRound(){ sSet('currentRound',null); },
  getDiagnosisLog(){ return sGet('diagnosisLog',[]); },
  appendDiagnosis(e){ let a=this.getDiagnosisLog(); a.push(e); a=evictFIFO(a,STORAGE_LIMITS.diagnosisLog); return sSet('diagnosisLog',a); },
  isDiagCompleted(){ return sGet('diagCompleted',false); },
  setDiagCompleted(){ sSet('diagCompleted',true); },
  async sync(){ return; }
};
