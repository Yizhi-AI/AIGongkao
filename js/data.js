"use strict";
/*  LAYER 1: Data — Enums, Templates, Traps, Mode Config          */

const ERROR_STAGE = { COMPREHENSION:'comprehension_error', TRANSFORMATION:'transformation_error', COMPUTATION:'computation_error' };

const COGNITIVE_TRAP_STAGE = {
  cancel_blindness:'comprehension_error',inner_sign_miss:'comprehension_error',nested_structure_miss:'comprehension_error',
  factor_blindness:'comprehension_error',cancel_opportunity_miss:'comprehension_error',special_percent_miss:'transformation_error',
  interval_growth_miss:'transformation_error',cross_product_magnitude:'transformation_error',one_plus_r_sign_flip:'transformation_error',
  r_percent_mishandle:'transformation_error',hundred_transform_dir:'transformation_error',direction_flip:'comprehension_error',
  permille_percent_mix:'comprehension_error',unit_misread:'comprehension_error',threshold_direction_rev:'comprehension_error',
  speed_up_down_reverse:'comprehension_error',decline_expand_shrink:'comprehension_error',miss_first_last:'comprehension_error',
  miss_sudden_drop:'comprehension_error',count_base_year:'comprehension_error',row_misread:'comprehension_error',
  sum_before_divide_miss:'comprehension_error',magnitude_blind:'comprehension_error',sign_ignore:'comprehension_error',
  first_digit_misjudge:'comprehension_error',first_quotient_misjudge:'comprehension_error',cumulative_vs_single:'comprehension_error',
  base_period_wrong:'comprehension_error',boundary_misjudge:'comprehension_error',num_denom_flip:'transformation_error',
  precedence_error:'transformation_error',truncation_too_short:'transformation_error',truncation_overkill:'transformation_error',
  decimal_place_quotient:'comprehension_error',fraction_direction_confusion:'comprehension_error',homogenize_target_wrong:'transformation_error'
};

const EXECUTION_ERROR_STAGE = {
  carry_overlook:'computation_error',borrow_error:'computation_error',parenthesis_sign:'computation_error',
  decimal_misalign:'computation_error',missing_term:'computation_error',counting_error:'computation_error',
  subtraction_error:'computation_error',multiply_carry_error:'computation_error',chained_rounding_loss:'computation_error',
  unit_convert_error:'computation_error',truncation_carry_error:'computation_error',remainder_zero_miss:'computation_error',
  quotient_digit_error:'computation_error',intermediate_mem_loss:'computation_error',brute_force_all:'computation_error',
  rounding_overreach:'computation_error'
};

function getErrorStage(k) { return COGNITIVE_TRAP_STAGE[k] || EXECUTION_ERROR_STAGE[k] || 'computation_error'; }

/* ── TRAP_TIPS (54 entries) ────────────────────────────────── */
function _tip(l,t,m) { return {label:l,tip:t,mnemonic:m}; }
const TRAP_TIPS = {};
TRAP_TIPS.cancel_blindness=_tip('没看出可抵消','先扫算式找相同数。抵消后再算，省一半力气。','先抵消，后计算');
TRAP_TIPS.inner_sign_miss=_tip('括号内符号看漏','去括号前确认每项符号。减号开括号→里面全变号。','去括号先看符号');
TRAP_TIPS.nested_structure_miss=_tip('没识别嵌套结构','有多个括号时从内层往外算。别跳步。','从内到外逐层算');
TRAP_TIPS.factor_blindness=_tip('没看出公因式','两个乘积相加减看有没有相同乘数。提出来再算。','找公因式再化简');
TRAP_TIPS.cancel_opportunity_miss=_tip('可约分没看出','除法和乘法混合时先看能不能约分。','先约分再计算');
TRAP_TIPS.special_percent_miss=_tip('特殊百分数未识别','16.7%≈1/6, 14.3%≈1/7, 12.5%=1/8。','百化分:1/6≈16.7%');
TRAP_TIPS.interval_growth_miss=_tip('忘了a×b乘积项','间隔增长率r=a+b+ab。三部分缺一不可。','r=a+b+ab');
TRAP_TIPS.cross_product_magnitude=_tip('a%×b%数量级搞错','两个百分数相乘结果要再除100。','百分相乘再除百');
TRAP_TIPS.one_plus_r_sign_flip=_tip('1+r和1-r用反','增长用1+r，下降用1-r。先问增还是减。','增则加，减则减');
TRAP_TIPS.r_percent_mishandle=_tip('%忘了除100','18.5%代入公式要写成0.185。','百分号=小数点前移2位');
TRAP_TIPS.hundred_transform_dir=_tip('百化分方向反','r=1/N时增长量=现期/(N+1)。r>0用N+1。','正N+1负N-1');
TRAP_TIPS.direction_flip=_tip('方向搞反','高/低、多/少、上升/下降，看清题干问哪个方向。','看清"比"字前后');
TRAP_TIPS.permille_percent_mix=_tip('‰和%混淆','3.6‰=0.36%，别当3.6%。','‰→%要除10');
TRAP_TIPS.unit_misread=_tip('单位换算错','万还是亿、元还是万元，先统一单位。','先统一单位');
TRAP_TIPS.threshold_direction_rev=_tip('>和<判定反','超过还是不足，一字之差结果相反。','超过>，不足<');
TRAP_TIPS.speed_up_down_reverse=_tip('提高/回落方向反','提高X个百分点=加，回落X个百分点=减。','提高=加回落=减');
TRAP_TIPS.decline_expand_shrink=_tip('降幅扩大/收窄处理错','降幅扩大=变得更负，降幅收窄=回正。','扩大=更负收窄=回正');
TRAP_TIPS.miss_first_last=_tip('漏首尾项','看表格先确认起止年。','确认起止再数');
TRAP_TIPS.miss_sudden_drop=_tip('漏骤降项','表格中异常小的数最易漏。','异常值停下来看');
TRAP_TIPS.count_base_year=_tip('多算基年','N年差=N，基年本身不算。','N年差=N不是N+1');
TRAP_TIPS.row_misread=_tip('看串行','表格数据多用手指跟着走。','手指跟着数据走');
TRAP_TIPS.sum_before_divide_miss=_tip('求和除时漏项','逐项列出来加总，别心算跳过。','逐项列加总');
TRAP_TIPS.magnitude_blind=_tip('量级盲区','先看数字是几位数。量级差一位答案差十倍。','先判数量级');
TRAP_TIPS.sign_ignore=_tip('没注意到负值','增长率有正有负，先标出正负号。','先标正负号');
TRAP_TIPS.first_digit_misjudge=_tip('首数误判','首位数可能进位。','注意进位对首数影响');
TRAP_TIPS.first_quotient_misjudge=_tip('首商估错','试商后乘回验证。','试商后乘回验证');
TRAP_TIPS.cumulative_vs_single=_tip('累计与单月混淆','累计值是总和，当月值只是一个月。','累计≠单月');
TRAP_TIPS.base_period_wrong=_tip('基期选错','比谁就以谁为基。','比谁以谁为基');
TRAP_TIPS.boundary_misjudge=_tip('区间边界判断错','卡在边界时仔细判断归哪边。','卡边界仔细判');
TRAP_TIPS.num_denom_flip=_tip('分子分母搞反','部分量÷总量。小÷大是占比。','小在上大在下');
TRAP_TIPS.precedence_error=_tip('运算优先级错','先乘除后加减，有括号先算括号。','先乘除后加减');
TRAP_TIPS.truncation_too_short=_tip('截位精度不足','选项差距<5%时截3位，>10%时截2位。','窄截三宽截二');
TRAP_TIPS.truncation_overkill=_tip('截位过度精算','差距大就省时间。','差距大省时间');
TRAP_TIPS.decimal_place_quotient=_tip('商的小数点位置错','做完除法回头估算数量级。','先估量级再算精度');
TRAP_TIPS.fraction_direction_confusion=_tip('分子大分母也大不敢判','分子大+分母小→必大。','一大一小直接秒');
TRAP_TIPS.homogenize_target_wrong=_tip('化同方向选错','化同法选数值接近的那边来化。','化近不化远');
// Execution errors
TRAP_TIPS.carry_overlook=_tip('进位遗漏','满十进一，别忘标记。','满十进一');
TRAP_TIPS.borrow_error=_tip('借位方向错','借一当十，高位减一。','借一当十高位减一');
TRAP_TIPS.parenthesis_sign=_tip('去括号忘变号','减号去括号全变号。','减号去括号全变号');
TRAP_TIPS.decimal_misalign=_tip('小数点对错','小数点对齐不够补0。','小数点对齐');
TRAP_TIPS.missing_term=_tip('多项运算漏项','项多逐个数一遍。','逐个数一遍');
TRAP_TIPS.counting_error=_tip('计数环节数错','逐项标记再计数。','逐项标记');
TRAP_TIPS.subtraction_error=_tip('基本减法算错','做完用加法验算。','做完加法验算');
TRAP_TIPS.multiply_carry_error=_tip('乘法进位错','进位写小最后统加。','进位写小');
TRAP_TIPS.chained_rounding_loss=_tip('连乘精度丢','连乘中不截，最后截。','连乘不截最后截');
TRAP_TIPS.unit_convert_error=_tip('单位换算执行错','写下换算过程别心算。','写下过程');
TRAP_TIPS.truncation_carry_error=_tip('截位后进位错','商×除数≈被除数。','乘回验证');
TRAP_TIPS.remainder_zero_miss=_tip('余数忘补零','余数补0继续除。','余数补0');
TRAP_TIPS.quotient_digit_error=_tip('商错位','商位对准被除数。','商位对准');
TRAP_TIPS.intermediate_mem_loss=_tip('中间结果忘掉','记在纸上别存脑子。','记纸上');
TRAP_TIPS.brute_force_all=_tip('全精算不先排','先排除再精算。','先排除再精算');
TRAP_TIPS.rounding_overreach=_tip('凑整累积误差过大','留一项精确值。','留一项精确');

/* ── TAG_GROUPS + MODE_CONFIG ──────────────────────────────── */
const TAG_GROUPS = {
  '加减法':['A_pure_arithmetic','E_accumulation_range','B_percent_nested','C_increment_threshold','D_multi_group_compare','F_trend_cumulative'],
  '乘法':['G_basic_multiply','H_factor_shift','K_distributive','M_compound_growth','I_chained_multiply','J_mixed_multiply_add','L_multi_product_compare'],
  '除法':['N_simple_division','S_avg_annual_increment','U_growth_rate','O_sum_division','P_base_period','Q_mixed_division','R_division_threshold','T_growth_amount'],
  '复合/比较':['X_fraction_comparison','V_two_ratio_diff','W_ratio_transformation']
};

const MODE_CONFIG = {
  random:{name:'随机出题',gapLevel:'medium'},
  basic:{name:'基础巩固',gapLevel:'medium'},
  advanced:{name:'拔高挑战',gapLevel:'narrow'},
  selftrain:{name:'自选练习',gapLevel:'medium'},
  review:{name:'错题重练',gapLevel:'medium'},
  diagnostic:{name:'摸底测试',gapLevel:'narrow'},
};

/* ── ALL_TEMPLATES (24) ────────────────────────────────────── */
const ALL_TEMPLATES = [
  {id:'A_pure_arithmetic',name:'纯算式直接算',level:1,operation_structure:'single_step',solution_strategy:['tail_method','direct_calculation','rounding_estimation'],cognitive_trap:[],execution_error:['carry_overlook','borrow_error','parenthesis_sign','decimal_misalign'],simplification:'none',params:{}},
  {id:'E_accumulation_range',name:'多位数累加估范围',level:1,operation_structure:'cumulative_series', solution_strategy:['rounding_estimation'],cognitive_trap:['boundary_misjudge','unit_misread'],execution_error:['rounding_overreach','missing_term'],simplification:'none',params:{}},
  {id:'N_simple_division',name:'基础直除 A÷B',level:1,operation_structure:'simple_division', solution_strategy:['truncation_method','reverse_check','estimate_then_adjust'],cognitive_trap:['truncation_too_short','num_denom_flip','first_quotient_misjudge','decimal_place_quotient'],execution_error:['truncation_carry_error','remainder_zero_miss'],simplification:'none',params:{}},
  {id:'S_avg_annual_increment',name:'年均增量 (A-B)÷n',level:1,operation_structure:'average_annual_increment', solution_strategy:['simplify_then_divide','truncation_method'],cognitive_trap:['base_period_wrong','num_denom_flip','decimal_place_quotient'],execution_error:['subtraction_error','quotient_digit_error'],simplification:'none',params:{}},
  {id:'B_percent_nested',name:'百分号嵌套运算',level:2,operation_structure:'nested_brackets', solution_strategy:['cancellation','direct_calculation'],cognitive_trap:['cancel_blindness','inner_sign_miss','direction_flip','permille_percent_mix'],execution_error:['parenthesis_sign','carry_overlook'],simplification:'cancellation',params:{}},
  {id:'C_increment_threshold',name:'增量阈值判定',level:2,operation_structure:'table_difference', solution_strategy:['digit_estimation'],cognitive_trap:['miss_first_last','threshold_direction_rev','row_misread'],execution_error:['subtraction_error','counting_error'],simplification:'none',params:{}},
  {id:'D_multi_group_compare',name:'多组求和/差比较',level:2,operation_structure:'multi_group_compare', solution_strategy:['option_elimination','digit_estimation'],cognitive_trap:['magnitude_blind','sign_ignore','first_digit_misjudge'],execution_error:['brute_force_all','carry_overlook'],simplification:'none',params:{}},
  {id:'F_trend_cumulative',name:'趋势与累计判定',level:2,operation_structure:'trend_sequence', solution_strategy:['sign_judgment','rounding_estimation'],cognitive_trap:['cumulative_vs_single','base_period_wrong','direction_flip'],execution_error:['subtraction_error'],simplification:'none',params:{}},
  {id:'X_fraction_comparison',name:'纯分数比较',level:2,operation_structure:'fraction_comparison', solution_strategy:['direct_comparison','homogenization','difference_method','cross_multiply'],cognitive_trap:['fraction_direction_confusion','homogenize_target_wrong','magnitude_blind'],execution_error:['brute_force_all','multiply_carry_error'],simplification:'none',params:{}},
  {id:'U_growth_rate',name:'增长率计算 (A-B)÷B',level:2,operation_structure:'growth_rate', solution_strategy:['simplify_then_divide','truncation_method'],cognitive_trap:['num_denom_flip','base_period_wrong','decimal_place_quotient'],execution_error:['subtraction_error','quotient_digit_error'],simplification:'none',params:{}},
  {id:'G_basic_multiply',name:'基础乘法 A×r%',level:3,operation_structure:'single_factor_multiply', solution_strategy:['special_fraction','rounding_estimation'],cognitive_trap:['special_percent_miss','decimal_place_quotient','unit_misread'],execution_error:['multiply_carry_error'],simplification:'special_fraction',params:{}},
  {id:'H_factor_shift',name:'因子变形 A×(1±r)',level:3,operation_structure:'factor_with_shift', solution_strategy:['cancellation','special_fraction'],cognitive_trap:['one_plus_r_sign_flip','inner_sign_miss'],execution_error:['parenthesis_sign','multiply_carry_error'],simplification:'special_fraction',params:{}},
  {id:'K_distributive',name:'分配律简化',level:3,operation_structure:'distributive_property', solution_strategy:['factor_extraction'],cognitive_trap:['factor_blindness','direction_flip'],execution_error:['parenthesis_sign','subtraction_error'],simplification:'factor_extraction',params:{}},
  {id:'M_compound_growth',name:'间隔增长率',level:3,operation_structure:'compound_growth_rate', solution_strategy:['formula_application'],cognitive_trap:['interval_growth_miss','cross_product_magnitude','direction_flip'],execution_error:['multiply_carry_error'],simplification:'formula',params:{}},
  {id:'I_chained_multiply',name:'连乘',level:4,operation_structure:'chained_multiply', solution_strategy:['cancellation','special_fraction'],cognitive_trap:['cancel_blindness','decimal_place_quotient'],execution_error:['chained_rounding_loss'],simplification:'cancellation',params:{}},
  {id:'J_mixed_multiply_add',name:'乘加减混合',level:4,operation_structure:'mixed_multiply_add', solution_strategy:['cancellation','rounding_estimation'],cognitive_trap:['precedence_error','inner_sign_miss','cancel_blindness'],execution_error:['parenthesis_sign','missing_term'],simplification:'cancellation',params:{}},
  {id:'L_multi_product_compare',name:'乘积计数/比较',level:4,operation_structure:'multi_product_compare', solution_strategy:['magnitude_first','digit_estimation'],cognitive_trap:['threshold_direction_rev','magnitude_blind','first_digit_misjudge'],execution_error:['multiply_carry_error','brute_force_all'],simplification:'none',params:{}},
  {id:'O_sum_division',name:'求和除',level:5,operation_structure:'sum_division', solution_strategy:['simplify_then_divide','truncation_method'],cognitive_trap:['sum_before_divide_miss','num_denom_flip','truncation_too_short','decimal_place_quotient'],execution_error:['carry_overlook','missing_term'],simplification:'none',params:{}},
  {id:'P_base_period',name:'求基期 A÷(1±r)',level:5,operation_structure:'base_period_division', solution_strategy:['base_period_formula','truncation_method','special_fraction'],cognitive_trap:['one_plus_r_sign_flip','r_percent_mishandle','truncation_too_short','num_denom_flip'],execution_error:['truncation_carry_error'],simplification:'special_fraction',params:{}},
  {id:'Q_mixed_division',name:'含乘除法',level:5,operation_structure:'mixed_division', solution_strategy:['simplify_then_divide','cancellation'],cognitive_trap:['precedence_error','cancel_opportunity_miss'],execution_error:['multiply_carry_error','truncation_carry_error'],simplification:'cancellation',params:{}},
  {id:'R_division_threshold',name:'除法阈值判定',level:5,operation_structure:'division_threshold', solution_strategy:['digit_estimation','magnitude_first'],cognitive_trap:['miss_first_last','threshold_direction_rev'],execution_error:['counting_error'],simplification:'none',params:{}},
  {id:'T_growth_amount',name:'百化分求增长量',level:5,operation_structure:'growth_amount_formula', solution_strategy:['special_fraction','base_period_formula'],cognitive_trap:['special_percent_miss','hundred_transform_dir','one_plus_r_sign_flip'],execution_error:['multiply_carry_error'],simplification:'special_fraction',params:{}},
  {id:'V_two_ratio_diff',name:'两期差值',level:6,operation_structure:'two_ratio_diff', solution_strategy:['simplify_then_divide','truncation_method','digit_estimation'],cognitive_trap:['num_denom_flip','direction_flip','truncation_too_short'],execution_error:['subtraction_error','truncation_carry_error'],simplification:'none',params:{}},
  {id:'W_ratio_transformation',name:'比重变形',level:6,operation_structure:'ratio_transformation', solution_strategy:['formula_application','special_fraction'],cognitive_trap:['num_denom_flip','one_plus_r_sign_flip','cross_product_magnitude'],execution_error:['multiply_carry_error','chained_rounding_loss'],simplification:'formula',params:{}}
];

const TEMPLATE_MAP = {}; ALL_TEMPLATES.forEach(t => TEMPLATE_MAP[t.id] = t);
