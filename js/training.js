"use strict";
/*  LAYER 5: Training metrics, reinforcement and export             */
/* ═══════════════════════════════════════════════════════════════ */
function median(values){
  const nums=values.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b); if(!nums.length) return 0;
  const m=Math.floor(nums.length/2); return nums.length%2?nums[m]:(nums[m-1]+nums[m])/2;
}

function groupKey(skill,structure){ return skill+'|'+structure; }

function getMasteryStats(){
  const groups={};
  DB.getAttempts().filter(a=>!a.is_skipped).forEach(a=>{
    const key=groupKey(a.skill,a.number_structure);
    if(!groups[key]) groups[key]={key,skill:a.skill,number_structure:a.number_structure,template_id:a.template_id,attempts:[]};
    groups[key].attempts.push(a);
  });
  return Object.values(groups).map(g=>{
    const all=g.attempts.sort((a,b)=>a.submitted_at-b.submitted_at),recent=all.slice(-5);
    const correct=all.filter(a=>a.is_correct).length,passRecent=recent.filter(a=>a.passed).length;
    const ratios=recent.map(a=>a.target_time_ms>0?a.duration_ms/a.target_time_ms:1);
    const medianRatio=median(ratios),medianMs=Math.round(median(all.map(a=>a.duration_ms)));
    let mastery='未掌握';
    if(recent.length>=5&&passRecent>=4&&medianRatio<=1) mastery='已自动化';
    else if(all.length>=3&&correct/all.length>=0.8&&medianRatio>1) mastery='会做但慢';
    else if(recent.length>=5&&passRecent>=2&&passRecent<=3) mastery='不稳定';
    return {...g,attempt_count:all.length,accuracy:all.length?correct/all.length:0,median_time:medianMs,median_time_ratio:medianRatio,mastery_level:mastery,last_practiced_at:all.length?all[all.length-1].submitted_at:0,recent_pass_count:passRecent};
  }).sort((a,b)=>{
    const rank={'未掌握':0,'会做但慢':1,'不稳定':2,'已自动化':3};
    return rank[a.mastery_level]-rank[b.mastery_level]||b.last_practiced_at-a.last_practiced_at;
  });
}

function updateTrainingState(attempt){
  const reasons=[];
  if(!attempt.is_correct||attempt.is_skipped) reasons.push('wrong');
  if(attempt.is_slow) reasons.push('slow');
  if(reasons.length){ DB.upsertReviewFailure(attempt,reasons); return; }
  const active=DB.getReviewPool().find(x=>x.key===groupKey(attempt.skill,attempt.number_structure)&&x.status!=='mastered');
  if(active){ DB.advanceReview(attempt); return; }
  const same=DB.getAttempts().filter(a=>!a.is_skipped&&groupKey(a.skill,a.number_structure)===groupKey(attempt.skill,attempt.number_structure)).slice(-5);
  const passed=same.filter(a=>a.passed).length;
  if(same.length>=5&&passed>=2&&passed<=3) DB.upsertReviewFailure(attempt,['unstable']);
}

function getPlanningWeight(template){
  let weight=1;
  const now=Date.now(),key=groupKey(template.skill,template.number_structure);
  const review=DB.getReviewPool().find(x=>x.key===key&&x.status!=='mastered');
  if(review) weight+=(review.due_at||0)<=now?5:2;
  const stat=getMasteryStats().find(x=>x.key===key);
  if(!stat) return weight;
  if(stat.mastery_level==='未掌握') weight+=2.5;
  else if(stat.mastery_level==='会做但慢') weight+=2.2;
  else if(stat.mastery_level==='不稳定') weight+=2.8;
  else if(stat.mastery_level==='已自动化') weight*=0.25;
  return weight;
}

function getTodaySummary(){
  const today=localDateKey(),items=DB.getAttempts().filter(a=>localDateKey(a.submitted_at)===today&&!a.is_skipped);
  const correct=items.filter(a=>a.is_correct).length,slow=items.filter(a=>a.is_slow).length;
  const bySkill={}; items.forEach(a=>{ if(!bySkill[a.skill]) bySkill[a.skill]={skill:a.skill,total:0,fail:0,slow:0}; const x=bySkill[a.skill]; x.total++; if(!a.is_correct)x.fail++; if(a.is_slow)x.slow++; });
  const weakest=Object.values(bySkill).sort((a,b)=>(b.fail+b.slow)-(a.fail+a.slow))[0];
  return {date:today,count:items.length,correct,accuracy:items.length?correct/items.length:0,median_ms:Math.round(median(items.map(a=>a.duration_ms))),slow_count:slow,weakest_skill:weakest?weakest.skill:'暂无'};
}

function getRecommendedFocus(){
  const due=DB.getReviewTargets(false); if(due.length) return due[0].skill+' · '+due[0].number_structure;
  const active=DB.getReviewTargets(true); if(active.length) return active[0].skill+' · '+active[0].number_structure;
  const weak=getMasteryStats().find(x=>x.mastery_level!=='已自动化');
  return weak?weak.skill+' · '+weak.number_structure:'先自由练一轮，系统再给建议';
}

function downloadText(filename,text,type){
  const blob=new Blob([text],{type:type||'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportAllJSON(){
  const snap=DB.exportSnapshot(); downloadText('AI速算_完整数据_'+localDateKey()+'.json',JSON.stringify(snap,null,2),'application/json;charset=utf-8'); showToast('完整数据已导出');
}

function csvCell(value){ const s=value===null||value===undefined?'':String(value); return '"'+s.replace(/"/g,'""')+'"'; }
function exportAttemptsCSV(){
  const cols=['attempt_id','question_id','session_id','shown_at','submitted_at','duration_ms','user_answer','answer','is_correct','is_slow','skill','cognitive_load','number_structure','best_strategy','target_time_ms','attempt_type','question_text'];
  const rows=DB.getAttempts().map(a=>cols.map(k=>csvCell(k.endsWith('_at')&&a[k]?new Date(a[k]).toISOString():a[k])).join(','));
  downloadText('AI速算_学习记录_'+localDateKey()+'.csv','\uFEFF'+cols.join(',')+'\n'+rows.join('\n'),'text/csv;charset=utf-8'); showToast('学习记录CSV已导出');
}

function exportDailyMarkdown(){
  const s=getTodaySummary(),focus=getRecommendedFocus(),stats=getMasteryStats(),auto=stats.filter(x=>x.mastery_level==='已自动化').length;
  const text=['# AI速算每日训练报告','','日期：'+s.date,'','- 今日题数：'+s.count,'- 正确率：'+Math.round(s.accuracy*100)+'%','- 中位耗时：'+Math.round(s.median_ms/1000)+'秒','- 慢题数：'+s.slow_count,'- 当前最弱技能：'+s.weakest_skill,'- 下一轮建议：'+focus,'- 已自动化项目：'+auto+'/'+stats.length,''].join('\n');
  downloadText('AI速算_每日报告_'+s.date+'.md',text,'text/markdown;charset=utf-8'); showToast('每日报告已导出');
}

let _pendingImport=null;
function handleImportFile(event){
  const file=event.target.files&&event.target.files[0]; event.target.value=''; if(!file) return;
  if(file.size>10*1024*1024){ showToast('文件过大，请选择10MB以内的备份','#EF4444'); return; }
  const reader=new FileReader();
  reader.onload=()=>{ try { _pendingImport=JSON.parse(reader.result); showConfirm('导入会覆盖当前本地训练数据，确定继续？',()=>{ try{ DB.importSnapshot(_pendingImport); _pendingImport=null; location.reload(); }catch(e){ showToast(e.message,'#EF4444'); } }); } catch(e){ showToast('JSON文件无法读取','#EF4444'); } };
  reader.readAsText(file,'utf-8');
}
