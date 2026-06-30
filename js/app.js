"use strict";
/*  LAYER 12: Helpers + Init                                       */
/* ═══════════════════════════════════════════════════════════════ */
function showToast(msg,color){ const t=document.createElement('div'); t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:'+(color||'#111827')+';color:#fff;padding:10px 20px;border-radius:20px;font-size:14px;z-index:300;'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2000); }

function checkMidRoundResume(){
  const sr=DB.loadCurrentRound(); if(!sr||sr.status!=='active') return;
  showConfirm('你有未完成的练习，是否继续？',()=>{ AppState.currentRound=sr; AppState.pendingMode=sr.mode; navigateTo('active-round'); renderActiveQuestion(); });
  const oc=document.getElementById('confirm-cancel'); oc.addEventListener('click',function h(){ DB.clearCurrentRound(); document.getElementById('confirm-overlay').classList.remove('show'); _cr=null; oc.removeEventListener('click',h); },{once:true});
}

function init(){
  loadSettings(); AppState.diagnosticCompleted=DB.isDiagCompleted(); renderHome(); setTimeout(checkMidRoundResume,500);
}

document.addEventListener('DOMContentLoaded',init);
document.getElementById('diagnosis-modal').addEventListener('click',function(e){ if(e.target===this) closeDiagnosis(); });
