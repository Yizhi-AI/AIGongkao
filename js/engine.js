"use strict";
/*  LAYER 3: Helpers + Template Selection                          */
/* ═══════════════════════════════════════════════════════════════ */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function randFloat(a,b,d){ const v=Math.random()*(b-a)+a; const p=Math.pow(10,d||2); return Math.round(v*p)/p; }
function randChoice(a){ return a[Math.floor(Math.random()*a.length)]; }
function randProb(p){ return Math.random()<p; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]; } return a; }

const _specialFractions = [
  {pct:12.5,frac:'1/8',n:8},{pct:14.3,frac:'≈1/7',n:7},{pct:16.7,frac:'≈1/6',n:6},
  {pct:25,frac:'1/4',n:4},{pct:33.3,frac:'≈1/3',n:3},{pct:20,frac:'1/5',n:5},
  {pct:11.1,frac:'≈1/9',n:9},{pct:9.1,frac:'≈1/11',n:11},{pct:50,frac:'1/2',n:2},{pct:6.25,frac:'1/16',n:16}
];

function _sf() { return randChoice(_specialFractions); }
function _baseNum(d){ const m=Math.pow(10,d-1),M=Math.pow(10,d)-1; let v=randInt(m,M); return Math.round(v/5)*5||m; }

let _cooldown = {};
function _cooldownWeight(id){ return (_cooldown[id]&&_cooldown[id]>0)?0.2:1; }
function _applyCooldown(ids){ ids.forEach(id=>{_cooldown[id]=3;}); Object.keys(_cooldown).forEach(k=>{if(!ids.includes(k)&&_cooldown[k]>0)_cooldown[k]--;}); }

function selectTemplates(mode, tagLabels, count){
  let pool = ALL_TEMPLATES.slice();
  if(mode==='selftrain'&&tagLabels&&tagLabels.length>0){ const ids=new Set(); tagLabels.forEach(l=>{(TAG_GROUPS[l]||[]).forEach(id=>ids.add(id));}); pool=pool.filter(t=>ids.has(t.id)); }
  if(mode==='review'){ const wrongs=DB.getWrongAnswers(); const ids=[...new Set(wrongs.map(r=>r.templateId))]; pool=pool.filter(t=>ids.includes(t.id)); if(pool.length===0) pool=ALL_TEMPLATES.slice(); }
  if(pool.length===0) pool=ALL_TEMPLATES.slice();

  let items=pool.map(t=>({id:t.id, weight:(mode==='basic'?([0,0.30,0.25,0.15,0.12,0.10,0.08][t.level]||0.1):mode==='advanced'?([0,0.05,0.08,0.12,0.15,0.30,0.30][t.level]||0.1):1)*_cooldownWeight(t.id)}));
  items.forEach(it=>{ it.weight=Math.max(it.weight,0.01); });

  const sel=[], rem=items.slice();
  for(let i=0;i<count&&rem.length>0;i++){ const tw=rem.reduce((s,it)=>s+it.weight,0); let r=Math.random()*tw,idx=0; for(;idx<rem.length;idx++){ r-=rem[idx].weight; if(r<=0) break; } if(idx>=rem.length) idx=rem.length-1; sel.push(rem[idx].id); rem.splice(idx,1); }
  while(sel.length<count){ const tid=randChoice(ALL_TEMPLATES).id; if(!sel.includes(tid)) sel.push(tid); }
  _applyCooldown(sel); return sel;
}

/* ═══════════════════════════════════════════════════════════════ */
/*  LAYER 4: Strategy-First Question Generators                    */
/* ═══════════════════════════════════════════════════════════════ */
function _fm(v){ if(v===null||v===undefined||isNaN(v)) return '?'; if(Number.isInteger(v)&&Math.abs(v)<1000000) return v.toLocaleString(); if(Math.abs(v)<1) return (v*100).toFixed(1)+'%'; if(Math.abs(v)<100) return v.toFixed(1); return v.toFixed(0); }
function _d(v,k,t){ return {value:v,display:'',trapKey:k,trapType:t||'cognitive'}; }

function makeQ(tid, text, expr, ans, ansDisp, dist, gl){
  const tmpl=TEMPLATE_MAP[tid];
  dist.forEach(d=>{ if(d.display===undefined||d.display===null) d.display=_fm(d.value); });
  while(dist.length<3) dist.push(_d(ans*1.25,'brute_force_all','execution'));
  if(dist.length>3) dist.length=3;
  const allV=[ans]; dist.forEach(d=>allV.push(d.value));
  for(let i=1;i<allV.length;i++){ for(let j=0;j<i;j++){ const mg=Math.max(Math.abs(allV[j])*0.02,0.5); if(Math.abs(allV[i]-allV[j])<mg) allV[i]=allV[j]+(allV[i]>=allV[j]?mg:-mg); } }
  dist.forEach((d,i)=>{ d.value=allV[i+1]; d.display=_fm(d.value); });
  const opts=[]; dist.forEach(d=>opts.push({value:d.value,display:d.display,trapKey:d.trapKey,trapType:d.trapType}));
  opts.push({value:ans,display:ansDisp,trapKey:null,trapType:null}); shuffle(opts);
  const labels=['A','B','C','D']; const options=opts.map((o,i)=>({position:labels[i],...o}));
  options.forEach(o=>{ if(!o.display&&o.display!==0) o.display=_fm(o.value); });
  return {id:'q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),templateId:tid,templateName:tmpl?tmpl.name:tid,level:tmpl?tmpl.level:1,gapLevel:gl,question:{text,expression:expr},correct:{value:ans,display:ansDisp},options};
}

// ── A: 纯算式加减 ────────────────────────────────────────────
function gen_A(gl){
  const s=randChoice(['round','pair','cancel','digit']);
  let t,ans,dist;
  if(s==='round'){ const a=Math.round(_baseNum(3)/10)*10,b=Math.round(_baseNum(2)/5)*5,c=Math.round(_baseNum(2)/5)*5; ans=a+b+c; t=a+' + '+b+' + '+c+' = ?'; dist=[_d(a+(b%10)*10+(c%10)*10,'carry_overlook','execution'),_d(a+b-c,'parenthesis_sign','execution'),_d(Math.round(a/10)*10+Math.round(b/10)*10+Math.round(c/10)*10,'decimal_misalign','execution')]; }
  else if(s==='pair'){ const p1=_baseNum(2),p2=100-p1+randInt(-2,2),ex=_baseNum(2); ans=p1+p2+ex; t=[p1,p2,ex].join(' + ')+' = ?'; dist=[_d(ans+5,'carry_overlook','execution'),_d(ans-ex-2,'missing_term','execution'),_d(p1+p2+ex+10,'carry_overlook','execution')]; }
  else if(s==='cancel'){ const x=_baseNum(3),d1=randInt(5,50),d2=randInt(5,50); ans=d1-d2; t='('+x+' + '+d1+') - ('+x+' + '+d2+') = ?'; dist=[_d(x+d1-d2,'cancel_blindness','cognitive'),_d(x+d1+d2,'parenthesis_sign','execution'),_d(-(d1+d2),'inner_sign_miss','cognitive')]; }
  else { const a=_baseNum(4);let b=_baseNum(4); const c=_baseNum(3); ans=a-b+c; t=a.toLocaleString()+' - '+b.toLocaleString()+' + '+c.toLocaleString()+' = ?'; dist=[_d(ans+10,'carry_overlook','execution'),_d(ans-20,'borrow_error','execution'),_d(a-b-c,'parenthesis_sign','execution')]; }
  return makeQ('A_pure_arithmetic',t,'',ans,_fm(ans),dist,gl);
}

// ── N: 基础直除 ──────────────────────────────────────────────
function gen_N(gl){
  const s=randChoice(['nice','trunc','pct']);
  if(s==='nice'){ const d=_baseNum(3); const r=randChoice([0.25,0.333,0.5,0.667,0.75,0.2,0.4,0.6,0.8]); const n=Math.round(d*r+randInt(-5,5)); const ans=n/d; const t=n.toLocaleString()+' ÷ '+d.toLocaleString()+' ≈ ?'; return makeQ('N_simple_division',t,'',ans,_fm(ans),[_d(d/n,'num_denom_flip','cognitive'),_d(ans*1.5,'first_quotient_misjudge','cognitive'),_d(ans*0.5,'first_quotient_misjudge','cognitive')],gl); }
  else if(s==='trunc'){ const n=_baseNum(4),d=_baseNum(4); const ans=n/d; const tn=Math.round(n/100)*100,td=Math.round(d/100)*100,ta=tn/td; const t=n.toLocaleString()+' ÷ '+d.toLocaleString()+' ≈ ?'; return makeQ('N_simple_division',t,'',ans,_fm(ans),[_d(ta,'truncation_too_short','cognitive'),_d(d/n,'num_denom_flip','cognitive'),_d(ans/10,'decimal_place_quotient','cognitive')],gl); }
  else { const n=_baseNum(3),d=_baseNum(4); const pa=n/d*100; const t=n.toLocaleString()+' ÷ '+d.toLocaleString()+' ≈ ?%'; return makeQ('N_simple_division',t,'',pa,pa.toFixed(1)+'%',[_d(d/n*100,'num_denom_flip','cognitive'),_d(pa/10,'decimal_place_quotient','cognitive'),_d(pa*0.7,'first_quotient_misjudge','cognitive')],gl); }
}

// ── S: 年均增量 ──────────────────────────────────────────────
function gen_S(gl){ const n=randInt(3,7),inc=_baseNum(3),sV=_baseNum(3),eV=sV+inc*n+randInt(-5,5); const ans=(eV-sV)/n; return makeQ('S_avg_annual_increment','('+eV.toLocaleString()+' - '+sV.toLocaleString()+') ÷ '+n+' = ?','',ans,_fm(ans),[_d((eV-sV)/(n+1),'base_period_wrong','cognitive'),_d((sV-eV)/n,'num_denom_flip','cognitive'),_d((eV-sV-10)/n,'subtraction_error','execution')],gl); }

// ── G: 基础乘法 ──────────────────────────────────────────────
function gen_G(gl){ const sp=randProb(0.65); let b,pct,ans,t; if(sp){ const sf=_sf(); pct=sf.pct; b=Math.round(_baseNum(3)/sf.n)*sf.n; if(b<100) b=b*sf.n; ans=b*pct/100; t=b.toLocaleString()+' × '+pct+'% = ?'; } else { b=_baseNum(2); pct=randFloat(3,68,1); ans=b*pct/100; t=b.toLocaleString()+' × '+pct.toFixed(1)+'% = ?'; } return makeQ('G_basic_multiply',t,'',ans,_fm(ans),[_d(ans*10,'decimal_place_quotient','cognitive'),_d(ans*1.25,'special_percent_miss','cognitive'),_d(ans+b*0.02,'multiply_carry_error','execution')],gl); }

// ── E: 累加估范围 ────────────────────────────────────────────
function gen_E(gl){ const n=randInt(5,8),terms=[];let sum=0;for(let i=0;i<n;i++){const v=_baseNum(randInt(2,3));terms.push(v);sum+=v;} const ans=sum,g=sum*0.06; const t=terms.map(v=>v.toLocaleString()).join(' + ')+' ≈ ?'; const r=[[Math.round(ans-g*1.8),Math.round(ans-g*0.5)],[Math.round(ans-g*0.3),Math.round(ans+g*0.3)],[Math.round(ans+g*0.5),Math.round(ans+g*1.8)],[Math.round(ans-g),Math.round(ans+g*1.2)]]; const tr=['boundary_misjudge',null,'rounding_overreach','missing_term']; const opts=r.map((r,i)=>({position:['A','B','C','D'][i],value:(r[0]+r[1])/2,display:r[0].toLocaleString()+' ~ '+r[1].toLocaleString(),trapKey:tr[i],trapType:tr[i]?'cognitive':null})); return {id:'q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),templateId:'E_accumulation_range',templateName:'多位数累加估范围',level:1,gapLevel:gl,question:{text:t,expression:terms.join('+')},correct:{value:ans,display:ans.toLocaleString()},options:opts}; }

// ── U: 增长率 ─────────────────────────────────────────────────
function gen_U(gl){ const base=_baseNum(3),rate=randFloat(0.05,0.65,2),eV=Math.round(base*(1+rate)); const ans=rate*100; return makeQ('U_growth_rate','('+eV.toLocaleString()+' - '+base.toLocaleString()+') ÷ '+base.toLocaleString()+' ≈ ?%','',ans,ans.toFixed(1)+'%',[_d((eV-base)/eV*100,'base_period_wrong','cognitive'),_d(ans/10,'decimal_place_quotient','cognitive'),_d(-ans,'direction_flip','cognitive')],gl); }

// ── B: 百分号嵌套 ────────────────────────────────────────────
function gen_B(gl){ let t,ans; if(randProb(0.4)){ const x=randFloat(20,70,1),a=randFloat(0.5,5,1),b=randFloat(0.5,5,1); ans=b-a; t='('+x.toFixed(1)+'% - '+a.toFixed(1)+'%) - ('+x.toFixed(1)+'% - '+b.toFixed(1)+'%) = ?百分点'; } else { const a=randFloat(20,70,1),b=randFloat(0.5,8,1),c=randFloat(10,50,1),d=randFloat(0.5,5,1); ans=a+b-c+d; t='('+a.toFixed(1)+'% + '+b.toFixed(1)+'%) - ('+c.toFixed(1)+'% - '+d.toFixed(1)+'%) = ?百分点'; } return makeQ('B_percent_nested',t,'',ans,ans.toFixed(1)+'pp',[_d(-ans,'inner_sign_miss','cognitive'),_d(ans*10,'permille_percent_mix','cognitive'),_d(ans+(randProb(0.5)?2:-2),'parenthesis_sign','execution')],gl); }

// ── K: 分配律 ─────────────────────────────────────────────────
function gen_K(gl){ const f=_baseNum(3),p1=randFloat(8,55,1),p2=randFloat(8,55,1),dp=Math.abs(p1-p2); const ans=f*dp/100; return makeQ('K_distributive',f.toLocaleString()+' × '+p1.toFixed(1)+'% - '+f.toLocaleString()+' × '+p2.toFixed(1)+'% = ?','',ans,_fm(ans),[_d(f*(p1+p2)/100,'factor_blindness','cognitive'),_d(f*(p1-p2),'r_percent_mishandle','cognitive'),_d(f*dp/100*0.5,'subtraction_error','execution')],gl); }

// ── M: 间隔增长率 ─────────────────────────────────────────────
function gen_M(gl){ const a=randFloat(3,35,1),b=randFloat(3,35,1); const ans=a+b+a*b/100; return makeQ('M_compound_growth','r₁='+a.toFixed(1)+'% r₂='+b.toFixed(1)+'% → 间隔增长率 r = ?','',ans,ans.toFixed(1)+'%',[_d(a+b,'interval_growth_miss','cognitive'),_d(a+b+a*b,'cross_product_magnitude','cognitive'),_d(Math.abs(a-b),'direction_flip','cognitive')],gl); }

// ── H: 因子变形 ───────────────────────────────────────────────
function gen_H(gl){ const base=_baseNum(3),pos=randProb(0.6),r=pos?randFloat(0.05,1.8,2):randFloat(-0.35,-0.03,2); const ans=base*(1+r),rPct=(r*100).toFixed(1); return makeQ('H_factor_shift',base.toLocaleString()+' × (1 '+(r>=0?'+':'')+rPct+'%) = ?','',ans,_fm(ans),[_d(base*(1-r),'one_plus_r_sign_flip','cognitive'),_d(base*r,'r_percent_mishandle','cognitive'),_d(ans*1.1,'multiply_carry_error','execution')],gl); }

// ── P: 求基期 ─────────────────────────────────────────────────
function gen_P(gl){ const sf=_sf(),r=sf.pct/100; let eV=Math.round(_baseNum(3)/(sf.n+1))*(sf.n+1); const ans=eV/(1+r); return makeQ('P_base_period',eV.toLocaleString()+' ÷ (1 + '+sf.pct+'%) = ?','',ans,_fm(ans),[_d(eV*(1+r),'one_plus_r_sign_flip','cognitive'),_d(eV/(1-r),'one_plus_r_sign_flip','cognitive'),_d(eV*(1-r),'r_percent_mishandle','cognitive')],gl); }

// ── T: 百化分求增长量 ────────────────────────────────────────
function gen_T(gl){ const sf=_sf(),r=sf.pct/100; let A=Math.round(_baseNum(3)/(sf.n+1))*(sf.n+1); const ans=A/(1+r)*r; return makeQ('T_growth_amount',A.toLocaleString()+' ÷ (1 + '+sf.pct+'%) × '+sf.pct+'% = ?','',ans,_fm(ans),[_d(A*r,'hundred_transform_dir','cognitive'),_d(A/sf.n,'hundred_transform_dir','cognitive'),_d(A*r/10,'r_percent_mishandle','cognitive')],gl); }

// ── O: 求和除 ─────────────────────────────────────────────────
function gen_O(gl){ const n=randInt(3,5),num=[];for(let i=0;i<n;i++) num.push(_baseNum(randInt(2,3))); const d=_baseNum(3),ns=num.reduce((s,v)=>s+v,0),isPct=randProb(0.5),raw=ns/d,ans=isPct?raw*100:raw; const t='('+num.join(' + ')+') ÷ '+d.toLocaleString()+' ≈ ?'+(isPct?'%':''); const disp=v=>isPct?v.toFixed(1)+'%':_fm(v); const ns1=num.slice(0,-1).reduce((s,v)=>s+v,0); return makeQ('O_sum_division',t,'',ans,disp(ans),[_d(isPct?ns1/d*100:ns1/d,'missing_term','execution'),_d(isPct?d/ns*100:d/ns,'num_denom_flip','cognitive'),_d(isPct?ans*1.2:ans*1.2,'first_quotient_misjudge','cognitive')],gl); }

// ── C: 增量阈值（需先计算再判定）──────────────────────────────
function gen_C(gl){
  const strat=randChoice(['products','sums','differences']);
  const n=randInt(4,6); const th=_baseNum(randInt(2,4));
  let items=[],t,ans=0;
  if(strat==='products'){
    // A×r% 中大于阈值的有几个
    for(let i=0;i<n;i++){ const a=_baseNum(randInt(3,4)),pct=randFloat(2,45,1); const v=Math.round(a*pct/100); items.push(a.toLocaleString()+'×'+pct.toFixed(1)+'%'); if(v>th) ans++; }
    t=items.join('、')+'。计算结果大于 '+th.toLocaleString()+' 的有几个？';
  } else if(strat==='sums'){
    // 多项求和，大于阈值的有几个
    for(let i=0;i<n;i++){ const tc=randInt(2,4);let sum=0;const parts=[]; for(let j=0;j<tc;j++){const v=_baseNum(randInt(2,3));sum+=v;parts.push(v.toLocaleString());} items.push(parts.join('+')); if(sum>th) ans++; }
    t='各组求和: '+items.join(', ')+'。和超过 '+th.toLocaleString()+' 的有几组？';
  } else {
    // A-B 差值中大于阈值的有几个
    for(let i=0;i<n;i++){ const a=_baseNum(randInt(3,4)),b=_baseNum(randInt(3,4)); const diff=Math.abs(a-b); items.push(a.toLocaleString()+'−'+b.toLocaleString()); if(diff>th) ans++; }
    t='各组差: '+items.join(', ')+'。差值超过 '+th.toLocaleString()+' 的有几组？';
  }
  return makeQ('C_increment_threshold',t,'',ans,ans+'个',[_d(Math.min(n,ans+1),'counting_error','execution'),_d(Math.max(0,ans-1),'miss_first_last','cognitive'),_d(n-ans,'threshold_direction_rev','cognitive')],gl);
}

// ── D: 多组比较 ───────────────────────────────────────────────
function gen_D(gl){ const n=4,grps=[];for(let i=0;i<n;i++){const tc=randInt(2,3);let sum=0,ex=[];for(let j=0;j<tc;j++){const sgn=j===0?1:(randProb(0.5)?1:-1),v=_baseNum(randInt(2,3));sum+=sgn*v;ex.push((sgn>0&&j>0?'+':'')+(sgn<0?'-':'')+v);}grps.push({sum,expr:ex.join(''),lbl:String.fromCharCode(65+i)});}
  const askMax=randProb(0.5); if(askMax){ const sorted=[...grps].sort((a,b)=>b.sum-a.sum),mx=sorted[0]; const t=grps.map(g=>g.lbl+': '+g.expr).join(', ')+' → 最大的是？'; const opts=grps.map(g=>({position:'ABCD'[grps.indexOf(g)],value:g.lbl.charCodeAt(0),display:g.lbl,trapKey:g===mx?null:'first_digit_misjudge',trapType:'cognitive'})); return {id:'q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),templateId:'D_multi_group_compare',templateName:'多组求和/差比较',level:2,gapLevel:gl,question:{text:t,expression:''},correct:{value:mx.lbl.charCodeAt(0),display:mx.lbl},options:opts}; }
  else { const ans=grps.reduce((s,g)=>s+g.sum,0),t=grps.map(g=>g.expr).join(' + ')+' = ?'; return makeQ('D_multi_group_compare',t,'',ans,_fm(ans),[_d(ans+randInt(10,30),'carry_overlook','execution'),_d(ans-randInt(10,30),'missing_term','execution'),_d(ans*0.8,'sign_ignore','cognitive')],gl); }
}

// ── Generator Registry ──────────────────────────────────────
const GENERATORS = {
  A_pure_arithmetic:gen_A,E_accumulation_range:gen_E,N_simple_division:gen_N,S_avg_annual_increment:gen_S,
  B_percent_nested:gen_B,C_increment_threshold:gen_C,D_multi_group_compare:gen_D,U_growth_rate:gen_U,
  G_basic_multiply:gen_G,H_factor_shift:gen_H,K_distributive:gen_K,M_compound_growth:gen_M,
  O_sum_division:gen_O,P_base_period:gen_P,T_growth_amount:gen_T,
};

function generateQuestion(tid, gl){ const g=GENERATORS[tid]; if(g) return g(gl); const tmpl=TEMPLATE_MAP[tid]; if(!tmpl) return gen_A(gl); const s=tmpl.operation_structure; if(s&&(s.includes('division')||s.includes('ratio')||s==='growth_rate'||s==='average_annual_increment'||s==='growth_amount_formula')) return gen_N(gl); if(s&&(s.includes('multiply')||s==='compound_growth_rate')) return gen_G(gl); return gen_A(gl); }

/* ═══════════════════════════════════════════════════════════════ */
/*  LAYER 5: Diagnostic Test (20 fixed questions)                  */
/* ═══════════════════════════════════════════════════════════════ */
const DIAGNOSTIC_TEST = [
  // A: 5 Qs
  {id:'diag_01',tid:'A_pure_arithmetic',text:'893 + 99 + 33 = ?',ans:1025,opts:[{v:1025,t:null},{v:950,t:'carry_overlook'},{v:992,t:'carry_overlook'},{v:1019,t:'borrow_error'}]},
  {id:'diag_02',tid:'A_pure_arithmetic',text:'5374 + 4107 + 2499 = ?',ans:11980,opts:[{v:11980,t:null},{v:11567,t:'missing_term'},{v:11887,t:'carry_overlook'},{v:11998,t:'decimal_misalign'}]},
  {id:'diag_03',tid:'A_pure_arithmetic',text:'23 + 25.1 + 29.3 + 28.5 + 31.8 = ?',ans:137.7,opts:[{v:137.7,t:null},{v:117.2,t:'missing_term'},{v:97.4,t:'missing_term'},{v:77.5,t:'missing_term'}]},
  {id:'diag_04',tid:'A_pure_arithmetic',text:'(50.2+11.3) - (53.3+11) = ?',ans:-2.8,opts:[{v:-2.8,t:null},{v:-1.4,t:'cancel_blindness'},{v:-4.2,t:'inner_sign_miss'},{v:-5.6,t:'parenthesis_sign'}]},
  {id:'diag_05',tid:'A_pure_arithmetic',text:'30.58 + 30.58 - 1.47 = ?',ans:59.69,opts:[{v:59.69,t:null},{v:58.22,t:'decimal_misalign'},{v:61.16,t:'carry_overlook'},{v:62.63,t:'carry_overlook'}]},
  // N: 5 Qs
  {id:'diag_06',tid:'N_simple_division',text:'657 ÷ 1934 ≈ ?%',ans:34,opts:[{v:34,t:null},{v:12,t:'num_denom_flip'},{v:23,t:'first_quotient_misjudge'},{v:45,t:'first_quotient_misjudge'}]},
  {id:'diag_07',tid:'N_simple_division',text:'25040 ÷ 46266 ≈ ?',ans:0.54,opts:[{v:'不到50%',t:'first_quotient_misjudge'},{v:'50%-60%',t:null},{v:'60%-70%',t:'first_quotient_misjudge'},{v:'超过70%',t:'first_quotient_misjudge'}]},
  {id:'diag_08',tid:'N_simple_division',text:'195779 ÷ 1370000 ≈ ?%',ans:14.3,opts:[{v:14.3,t:null},{v:9.2,t:'truncation_too_short'},{v:19.4,t:'first_quotient_misjudge'},{v:24.5,t:'first_quotient_misjudge'}]},
  {id:'diag_09',tid:'N_simple_division',text:'15 ÷ (221+48+17+15) ≈ ?%',ans:5,opts:[{v:5,t:null},{v:6,t:'missing_term'},{v:8,t:'sum_before_divide_miss'},{v:16,t:'num_denom_flip'}]},
  {id:'diag_10',tid:'N_simple_division',text:'(864.8+701.2) ÷ 3155 ≈ ?%',ans:50,opts:[{v:50,t:null},{v:55,t:'first_quotient_misjudge'},{v:45,t:'first_quotient_misjudge'},{v:40,t:'truncation_too_short'}]},
  // S: 3 Qs
  {id:'diag_11',tid:'S_avg_annual_increment',text:'(3009.4 - 2627.5) ÷ 2 = ?',ans:191,opts:[{v:191,t:null},{v:179,t:'subtraction_error'},{v:167,t:'subtraction_error'},{v:127,t:'num_denom_flip'}]},
  {id:'diag_12',tid:'S_avg_annual_increment',text:'(49222 - 48355) ÷ 2 = ?',ans:434,opts:[{v:434,t:null},{v:867,t:'num_denom_flip'},{v:629,t:'base_period_wrong'},{v:315,t:'subtraction_error'}]},
  {id:'diag_13',tid:'S_avg_annual_increment',text:'(4405 - 2807) ÷ 7 = ?',ans:228,opts:[{v:228,t:null},{v:233,t:'subtraction_error'},{v:238,t:'subtraction_error'},{v:244,t:'base_period_wrong'}]},
  // G: 4 Qs
  {id:'diag_14',tid:'G_basic_multiply',text:'4245 × 12.5% ≈ ?',ans:531,opts:[{v:531,t:null},{v:499,t:'special_percent_miss'},{v:555,t:'special_percent_miss'},{v:583,t:'multiply_carry_error'}]},
  {id:'diag_15',tid:'G_basic_multiply',text:'15.6 × 58.4% ≈ ?',ans:9,opts:[{v:9,t:null},{v:10,t:'first_quotient_misjudge'},{v:11,t:'multiply_carry_error'},{v:12,t:'multiply_carry_error'}]},
  {id:'diag_16',tid:'G_basic_multiply',text:'27227 × 5% ≈ ?',ans:1361,opts:[{v:1361,t:null},{v:1425,t:'multiply_carry_error'},{v:1476,t:'multiply_carry_error'},{v:1493,t:'decimal_place_quotient'}]},
  {id:'diag_17',tid:'G_basic_multiply',text:'391 × 67.0% ≈ ?',ans:262,opts:[{v:262,t:null},{v:256,t:'first_quotient_misjudge'},{v:267,t:'multiply_carry_error'},{v:273,t:'multiply_carry_error'}]},
  // Mixed: 3 Qs
  {id:'diag_18',tid:'U_growth_rate',text:'(12.5-4.8) ÷ 4.8 ≈ ?%',ans:160,opts:[{v:160,t:null},{v:62.5,t:'num_denom_flip'},{v:38.4,t:'base_period_wrong'},{v:16,t:'decimal_place_quotient'}]},
  {id:'diag_19',tid:'M_compound_growth',text:'7.2% + 5.8% + 7.2%×5.8% = ?%',ans:13.4,opts:[{v:13.4,t:null},{v:13.0,t:'interval_growth_miss'},{v:13.8,t:'cross_product_magnitude'},{v:1.4,t:'direction_flip'}]},
  {id:'diag_20',tid:'K_distributive',text:'22.1万 × 26.8% - 22.1万 × 23.6% ≈ ?',ans:7000,opts:[{v:7000,t:null},{v:8000,t:'subtraction_error'},{v:28000,t:'factor_blindness'},{v:30000,t:'factor_blindness'}]},
];

/* ── Diagnostic Flow ───────────────────────────────────────── */
function createDiagnosticRound(){
  const qs=DIAGNOSTIC_TEST.map(dq=>{ const opts=shuffle(dq.opts.map((o,i)=>({position:['A','B','C','D'][i],value:o.v,display:String(o.v),trapKey:o.t,trapType:o.t?'cognitive':null}))); opts.forEach((o,i)=>o.position=['A','B','C','D'][i]);
    return {id:dq.id,templateId:dq.tid,templateName:(TEMPLATE_MAP[dq.tid]||{}).name||dq.tid,level:1,gapLevel:'narrow',question:{text:dq.text,expression:dq.text},correct:{value:dq.ans,display:String(dq.ans)},options:opts}; });
  return {id:'diag_'+Date.now(),mode:'diagnostic',gapLevel:'narrow',status:'active',questions:qs,currentIndex:0,answers:new Array(20).fill(null),coachWarnings:[],startedAt:Date.now(),completedAt:null,_hintShown:false,_skipShown:false};
}

function handleStartDiagnostic(){
  const r=createDiagnosticRound(); AppState.currentRound=r; AppState.pendingMode='diagnostic'; navigateTo('active-round'); renderActiveQuestion();
}
function skipDiagnostic(){ DB.setDiagCompleted(); AppState.diagnosticCompleted=true; renderHome(); }
