# 模型审计与契约设计——养老金桥接 / 积累持续成功率 / 支取策略正名 / 费雪双口径

- 审计日期：2026-11-21。方法：全量精读源码（引用均为 `文件:行号`）+ 独立手算复核（所有期望值由审计员按公式独立推导并用 node 算术复核，**未以现有实现输出为真值**）。
- 基线实测：`cargo test`（src/wasm）——lib 单元 15 通过 + integration 53 通过 = 68 全绿（本次审计实际执行）。前端无测试装置（package.json scripts 仅 dev/build/preview/check:size/check:currency/check:a11y；无任何 *.test.* 文件）。
- 外部评估三项 P0 主会话已初步定位；本文 §2 给出代码级实锤与决策误导推演（README.md:86 的 27.10 万案例）。

## §1 现状行为（源码实证）

### 1.1 estimate_pension（src/wasm/src/pension.rs）

- 输入 `PensionInput`（pension.rs:32-77）= BaselineInput 全字段 + 养老金专属 7 字段（currentAge 16–70 / retireAge 40–75 须大于当前年龄 / contribYears 0–50 / contribIndex [0,10] / accountBalance / avgMonthlyWage / monthsDivisor 1–600）。校验顺序固定（pension.rs:139-160）。
- `retire_age` 全部消费点（穷尽）：
  1. pension.rs:151-152 校验（40–75 整数、须大于 currentAge）；
  2. pension.rs:162 `years_to_retire = retire_age − current_age`——**仅作为输出字段**（PensionOutput.yearsToRetire，pension.rs:82-83；PensionPanel.tsx:186-188 展示「距退休 N 年」），不参与任何金额计算；
  3. 前端联动：pensionParams.ts:20-27 `effectiveMonthsDivisor(monthsDivisor, retireAge, monthsSynced)` 按 retireAge 查计发月数表（pensionParams.ts:11-15：50→195 / 55→170 / 60→139），经 PensionPanel.tsx:49-53 与 :58-62（`calcPension({ ...baseline, ...pensionInputs, monthsDivisor: effectiveMonths })`）进入 monthsDivisor → accountPensionMonthly（pension.rs:203-207）。
  **结论：retire_age 只影响金额（且仅经计发月数联动间接影响）与 yearsToRetire 展示；不存在任何「养老金自 retireAge 起才覆盖开销」的时间口径逻辑。**
- 金额算法：multiplier = round2(12 ÷ 实际回报率小数)（pension.rs:179-183，与 baseline 同口径）；basic = round2((社平 + 社平×指数)÷2×年限÷100)（:185-200）；account = round2(余额÷计发月数)（:203-207）；pension = basic+account（:208）；coverage = round2(pension÷月开销，开销 0 → 0，不封顶)（:211-215）。
- **adjusted_monthly_expense（pension.rs:216-224）= max(0, monthlyExpense − pensionMonthly)——把养老金当「即时全额覆盖」直扣**；adjustedCriticalValue（:226-241）= adjusted × multiplier + 附加项，与 calculate_baseline 同构（恒等式由 integration.rs:958-982 锁定）。全程 rust_decimal，round2（common.rs:15）。
- PensionOutput 全字段（pension.rs:81-107）：yearsToRetire / basicPensionMonthly / accountPensionMonthly / pensionMonthly / coverageRatio / adjustedMonthlyExpense / adjustedCriticalValue / multiplier / error。错误两分支：业务错误（实际回报 ≤ 0，:166-177，yearsToRetire 仍返回）与解析/校验失败 error_output（:117-133，全 0）。

### 1.2 simulate_accumulation（src/wasm/src/accumulation.rs）

- 随机流（:210-257）：`StdRng::seed_from_u64(seed)`；路径外层、年份内层，每年**先名义回报样本、后通胀样本**（:226-233）；每路径固定消费 2×years 个样本、全程不提前终止（路径图需要全程曲线）；递推 `assets = assets×(1+r) + (月收入−月支出)×12×cum_infl`（:236-237，年储蓄随通胀上行）；资产下限钳 0 后继续（:239-244，与耗尽语义不同）。
- **hit_year 判定 = 首触即达**：t=0 判定 `assets0 ≥ target0 → Some(0)`（:221）；循环内仅 `hit_year.is_none()` 时判定 `assets ≥ target×cum_infl` 即记录（:246-252），**首触后不再有任何存续检查**——第 t 年达标、第 t+1 年暴跌至零的路径仍计入「达成」。
- 统计输出：fiProbability = 达成路径数 ÷ paths（6 位小数，:270）；neverReachedShare 独立重算（:271）；首达年限五个分位**只在达成样本内**取 type-7 线性插值、两位小数，无达成样本一律 −1.0（:273-286，common.rs:134）；期末资产分位基于全部路径（:288-311）；samplePaths 固定 50 条（索引公式 :202-208）。
- 与 montecarlo 的随机流关系：同 `StdRng::seed_from_u64`、同正态分布构造（:183-192 vs montecarlo.rs:195-204）、同「路径外层/年份内层/先回报后通胀」顺序；差异仅在现金流方向（+储蓄流入 vs −支出流出）与终止语义（钳 0 继续 vs 耗尽 break）。

### 1.3 run_monte_carlo / bootstrap / withdrawal（三策略与随机流）

- 三策略语义（montecarlo.rs:245-262 → withdrawal.rs）：
  - **fixed（缺省，montecarlo.rs:249-251）**：`spend *= 1.0 + infl`——**名为「固定名义」（withdrawal.rs:50 注释、i18n zh-CN.ts:449），实为逐年按通胀样本上行**（bridge.ts:356 自己写明 `spend_t = annualSpend × cum_infl_t`）。语义与命名背离。
  - threshold（withdrawal.rs:161-188）：wr0 = annualSpend÷currentAssets（montecarlo.rs:189）；第 1 年恒通胀上调（:166-168）；t≥2 按序：超带降支×(1−cut)×(1+π)（:175-177，距终点严格大于 noCut 才降支）→ 低于带升支（:179-181）→ 负收益年带内冻结（:183-185）→ 常规通胀上调（:187）。
  - percent（withdrawal.rs:227-264）：实际口径摊还（annuitize :192-213）→ 名义化 → 上限（cap_base 请求级缓存，montecarlo.rs:190）→ 地板 → 可用资产钳制；耗尽判定窗口第 1..years−1 年末（montecarlo.rs:273-276，终点年归零不计耗尽）。
- 耗尽判定（montecarlo.rs:268-292）：任一年末资产 ≤ 0 → 该路径耗尽、终止递推，当年及以后记 0、计入 depletionProb；正溢出钳 f64::MAX（:277-279）。
- 随机流：正态模式每年先回报后通胀（montecarlo.rs:233-241）；**历史 bootstrap 模式每年先抽序列元素索引（均匀有放回）、再抽通胀正态样本**（bootstrap.rs:246-255），回报均值/标准差仅校验不参与（bootstrap.rs:8-9、172-184）；策略层为纯函数、**不消耗任何随机数**（withdrawal.rs:11-13）——可复现性铁律（bridge.ts:404-406）。

### 1.4 calculate_baseline / simulate_sequence（简要）

- baseline.rs：realReturnPct = 名义 − 通胀（:99，**近似口径，非费雪精确**）；multiplier = round2(1200 ÷ 实际回报率百分点)（:112-116）；criticalValue = 月开销 × 舍入后乘数 + 附加项（:120-128）；实际回报 ≤ 0 → error + multiplier/critical 0、realReturnPct 与 monthlyExpense 回显（:100-108）。
- sequence.rs：确定性无随机；通胀置 0；支取口径耗尽含终点年（:134-141），积累口径钳 0 继续（:143-149）——序列风险对照专用。

### 1.5 bridge.ts / share.ts / finance.ts / 面板

- bridge.ts 为单一事实来源（:1-23）；PensionInput/Output 契约 :559-600；AccumulationInput/Output :447-518；WithdrawalStrategy :258-259（`"fixed" | "threshold" | "percent"`）。
- share.ts：SHARE_LINK_VERSION = 3（:37），版本注释记录 v2→v3 一次性失效先例（:31-36）；切片形状 ShareState :46-59；解码版本闸 :121（仅接受当前版本）；monteCarlo 切片 strategy/threshold/percent 解码 :146-204（fixed 缺省、枚举外 → null）；accumulation 键清单 :210-213；pension 键清单 :215-218（含 retireAge / monthsDivisor，不含任何时间口径新字段）；不做部分恢复（:12-14）。scenarios.ts:3-4 存档载荷同走 encodeShareState/decodeShareState——版本失效同时波及情景库存档。
- finance.ts：parsePension :353-368 / parseAccumulation :317-344 / parseBaseline :154-165 逐字段轻量校验，新增输出字段须同步。
- 面板：PensionPanel.tsx:58-62 组合调用（计发月数传当刻联动值）；AccumulationPanel.tsx:88-91 目标值联动、:146-157 run 提交、:506-517 fiProbability 进度条；MonteCarloPanel.tsx:133-142 策略切换物化参数、:225-242 run（正态/bootstrap 分支）、:438-450 策略 Radio（value "fixed"）。

## §2 三项 P0 代码级定位

### P0-1 养老金调整后参考线「直扣」——无桥接期时间口径

- **当前行为**：pension.rs:216-218 `monthly_expense − pension_monthly` 即刻直扣——30 岁用户的面板已按「养老金现在就开始发放」计算调整后参考线；养老金实际自 retireAge（如 60）起才可领取（bridge.ts:580 公式本身只管金额，时间维度在契约中缺位）。
- **决策误导场景（README.md:86 案例）**：面板 ⑦ 默认输入（30 岁/60 岁退休/月开销 2,990/养老金 2,842.03/健康预留 20 万）→ 调整后参考线 ¥271,025.6（≈27.10 万）。用户若 30 岁停工，30–60 岁为无工资且无养老金的桥接期，须按全额 2,990/月备资：480 口径全额参考线 = 2,990×480 + 200,000 = **1,635,200 元**（README.md:41 默认临界值同源）。现状把 27.10 万展示为当下的财富自由目标，误导倍数 6.04×；用 27.10 万反推可持续月开销 ≈ 271,025.6÷480 ≈ 564.6 元/月，远低于桥接期所需——用户在 30–60 岁间必然击穿预留并耗尽资产。
- **修正改动点（模块级）**：① pension.rs（输入 target_retire_age + 校验；输出 bridge_years / bridge_funding_needed；错误分支形状）；② bridge.ts §i（类型 + 分段口径注释）；③ finance.ts parsePension；④ PensionPanel.tsx（新字段 + 桥接行展示）与 i18n 三语键；⑤ store/defaults（PensionInputs + 默认值）；⑥ share.ts v4；⑦ integration.rs 新测试（§4 T1–T3）。

### P0-2 积累模拟「首触判定」——达标 ≠ 持续富足

- **当前行为**：accumulation.rs:221（t=0）与 :246-252（循环内）均为首触即记录，此后无任何存续检查；fiProbability 度量的是「曾在某年末 ≥ 通胀上行目标」，不是「达标后可持续支取」。
- **决策误导场景（README 相邻参数推演）**：用户目标 163.5 万、当前 50 万、模拟 40 年。某路径第 18 年首触上行目标计入 fiProbability 与首达分位，第 19 年遭遇 −40% 级回报回落至 60 万且 40 年内不再达标——现状仍计「达成」。用户按中位首达年辞职，遭遇的恰是「达标后序列风险」，而现状没有任何指标度量它（蒙特卡洛面板的耗尽概率是支取口径的独立工具，与积累面板的首触概率不衔接）。
- **修正改动点**：① accumulation.rs（输入 sustain_years；达标时刻快照资产/累计通胀；同路径续接支取阶段 2×N 样本；输出 sustained_probability）；② bridge.ts §g（判定语义 + 随机流裁定理由）；③ finance.ts parseAccumulation；④ AccumulationPanel.tsx 并列展示 + i18n；⑤ defaults（sustainYears 默认 0 = 关）；⑥ share.ts v4；⑦ integration.rs（§4 T4/T5/T8/T10 + 随机流不变回归）。

### P0-3 蒙特卡洛缺省策略「fixed」名实背离

- **当前行为**：montecarlo.rs:249-251 `Strategy::Fixed => spend *= 1.0 + infl`——缺省策略实为通胀上调；命名「fixed / 固定名义」见于 withdrawal.rs:50、bridge.ts:356、i18n zh-CN.ts:449、MonteCarloPanel.tsx:445。
- **决策误导场景（README.md:121 案例）**：默认输入（50 万资产、年支出 3.6 万 ≈ 7.2% 提取率、通胀 2%±1%、30 年）耗尽概率 94.4%。用户按「固定名义」理解会以为支出恒 3.6 万；实际第 30 年支出 = 3.6 万 × 1.02³⁰ ≈ 6.52 万。真正「名义恒定」计划在同参数下耗尽概率必然更低——用户拿通胀上调口径的 94.4% 评估自己的固定名义预算（或反向），策略比较与预算决策被系统性误导。数值本身正确，问题纯在命名与语义对齐。
- **修正改动点**：① withdrawal.rs（resolve_strategy 接受正名 "inflation_uplift"，"fixed" 降级为兼容别名；注释正名）；② montecarlo.rs / bootstrap.rs 注释同步；③ bridge.ts §e 枚举 + 语义注释；④ i18n mc.strategyFixed 文案 + MonteCarloPanel 策略注；⑤ integration.rs 语义断言（§4 T6）+ strategy_resolution_and_validation 扩展。数值路径零改动。

## §3 契约设计草案（字段级 diff）

### 3.1 PensionInput / PensionOutput 增补（+1 输入，+2 输出）

```diff
 interface PensionInput {
   ...
   retireAge: number;            // 不动：仍驱动养老金金额（缴费年限、计发月数联动）
+  targetRetireAge?: number;     // 想停止工作的年龄（16–75，整数；缺省 = retireAge → bridgeYears = 0，现状口径不变）
 }
 interface PensionOutput {
   ...
+  bridgeYears: number;          // 桥接期年数 = max(0, retireAge − max(targetRetireAge, currentAge))；解析/校验失败安全值 0
+  bridgeFundingNeeded: number;  // 桥接期需备资金（元，两位小数）＝ bridgeYears > 0 时
+                               //   round2(monthlyExpense × multiplier + childCount×costPerChild + healthReserve + majorInvestment)
+                               //   （＝ calculate_baseline 同附加项 criticalValue，恒等式测试锁定）；bridgeYears = 0 或实际回报 ≤ 0 时 = 0
 }
```

分段口径说明（写入 bridge.ts §i 注释，UI 分两段展示）：
- **段 1（桥接期，targetRetireAge → retireAge）**：无工资、无养老金，开销 = monthlyExpense 全额；需备资金沿用同一 480 乘数口径——有限年限支取本可用年金因子，但最小 diff 保留乘数口径（对桥接段偏保守/多备），并明示该取舍。
- **段 2（retireAge 之后）**：养老金覆盖 → adjustedMonthlyExpense / adjustedCriticalValue（现状字段语义不变，展示标注「领取后」口径）。
- **养老金金额算法不动**：retire_age 仍驱动金额（pension.rs:185-207 与 pensionParams.ts:20-27 联动均不改）；时间口径全部由 targetRetireAge / bridgeYears 承载——即「金额字段与时间字段解耦」。
- 校验：`to_u32_int("停止工作年龄", v, 16, 75)`（common.rs:79），插在 retire_age 校验（pension.rs:151-152）之后；不与 retireAge 做大小约束（桥接公式 max/saturating 兜底）。错误分支形状：业务错误（实际回报 ≤ 0）→ bridgeYears 仍返回计算值（同 yearsToRetire 先例 pension.rs:166-177）、bridgeFundingNeeded = 0；解析/校验失败 error_output → 两字段 0（pension.rs:117-133 同步）。

> **修订轮勘误（2026-11-21 第二轮，R5）**：本节 bridgeFundingNeeded 公式「monthlyExpense × multiplier + childCount×costPerChild + healthReserve + majorInvestment（= calculate_baseline 同附加项 criticalValue，恒等式测试锁定）」**废止**——附加项单次计入裁定为**归属段 2**：bridgeFundingNeeded = round2(monthlyExpense × multiplier)（纯生活费口径），段 2 adjustedCriticalValue 保持现状公式（pension.rs:226-241 零改动、P-A 锚 271,025.60 零漂移、integration.rs:958-982 恒等式保留），两段相加 = 真实总需（T1 例 1,435,200.00 + 271,025.60 = 1,706,225.60，node 复算）。选择理由与被否决变体见 p7-spec §2.1（修订轮二 R5）。

### 3.2 AccumulationInput / AccumulationOutput 增补（+1 输入，+1 输出）

```diff
 interface AccumulationInput {
   ...
+  sustainYears?: number;          // 达标后接支取模拟年数 N（0–200 整数；缺省 0 = 关闭）
 }
 interface AccumulationOutput {
   fiProbability: number;          // 不动（首触口径）
+  sustainedProbability: number;   // 持续成功率 = 达标且达标后 N 年支取存续的路径占比（0–1，6 位小数）
 }
```

存续判定语义（写入 bridge.ts §g）：
- 首达年 t*（含 0，判定沿用 accumulation.rs:221/:246-252 不变）；达标时刻快照：资产 A*（t*=0 → currentAssets；t*≥1 → 第 t* 年末资产）与累计通胀因子 cumInfl*。
- 支取阶段（**同一路径资产继续支取**）：第 k 年（k = 1..N）先抽名义回报、再抽通胀样本（顺序同积累阶段）；spend_k = 12 × monthlyExpense × cumInfl* × ∏_{j≤k}(1+π_j)（基期支出延续上行，第 1 年即含第 1 个支取年通胀样本——与 montecarlo.rs:250 同语义）；A_k = A_{k−1}×(1+r_k) − spend_k；任一年末 A_k ≤ 0 → 该路径不存续。未达标路径一律不计存续。
- **随机流裁定与理由**：同一路径继续支取——(1) 首触与存续度量同一条财富轨迹，「达标后立刻遭遇序列风险」正是持续成功率要捕捉的机制，跨路径重抽会把达标时资产与后续回报强行独立、系统性低估序列风险；(2) 可复现性铁律（bridge.ts:404-406）：每路径先消费积累阶段 2×years 个样本（数量与顺序不变），支取阶段 2×N 个样本严格顺延——故字段缺省或 sustainYears = 0 时输出与现状逐字节一致；sustainYears > 0 时既有字段仍与 sustainYears = 0 同 seed 完全一致（增量抽样不回灌既有统计），由回归测试锁定。

> **修订轮勘误（2026-11-21 第二轮，R1）**：本节「支取阶段 2×N 个样本严格顺延」的逐路径交错读法被 p7-spec §2.2 的**两段式独立派生流**拓扑取代——pass1 纯积累按原流序（与 sustainYears 无条件解耦、既有字段无条件字节一致），pass2 仅对达标路径以派生种子 `seed ^ ((p+1)×0x9E37_79B9_7F4A_7C15)` 续接支取（耗尽即提前终止、未达标路径零抽样）。理由：逐路径交错会使路径 ≥1 的积累抽样整体后移 2×N、破坏 bridge.ts:404-406 随机流契约——裁定 (c)（sustainYears > 0 时既有字段与 N=0 同 seed 逐字节一致）在交错拓扑下不可能成立（评审 R1 矛盾机理，复核成立）。语义取舍如实登记：**资产路径延续（pass2 自 pass1 快照 A*/cumInfl* 续递推）、随机流隔离（pass2 不消费主 rng 流）**——ChaCha 流不同位置样本独立同分布，统计上与同流顺延无差别，取派生流为工程性质（无条件兼容 / 样本位置稳定 / 无丢弃消费；同流两遍拓扑在 (b)/(c) 断言下不可区分，拓扑字面由 p7-spec §2.2 + bridge.ts §g 注释钉死）。锁定测试以真实量级 σ（r 4.5±12%，p7-spec §3.8）保证可侦测——σ=1e-9 退化输入下交错拓扑平凡通过，不可作锁定测试。

### 3.3 baseline 费雪双口径（+2 输出，480 仍为主输出）

```diff
 interface BaselineOutput {
   realReturnPct / multiplier / criticalValue / monthlyExpense: number;  // 480 教学口径全部不动、仍为主输出
+  multiplierExact: number;      // 精确乘数（费雪口径）＝ round2(12 × (1 + inflationPct/100) ÷ ((nominalReturnPct − inflationPct)/100))，
+                               //   代数恒等于 12 ÷ 实际回报率精确值 ((1+r)/(1+i) − 1)，Decimal 域无中间舍入
+  criticalValueExact: number;   // 精确口径目标本金 ＝ round2(monthlyExpense × multiplierExact + 附加项)（先舍入后相乘，与 480 口径同形）
 }
```

- 4.5%/2% 校验：精确实际回报率 = 0.025/1.02 = 2.450980392…%（≈2.451%）→ multiplierExact = 12×1.02/0.025 = **489.6（精确）**→ criticalValueExact = 2,990×489.6 + 200,000 = **1,663,904.00**，比 480 口径（1,635,200）高 28,704.00——通胀 > 0 时教学口径系统性低估所需本金。
- 错误分支（实际回报 ≤ 0）：两新字段 = 0（与 multiplier/criticalValue 同形状，baseline.rs:100-108 / :70-82 同步）。
- 最小 diff 变体：只加 multiplierExact 1 字段、精确参考线由前端复算——**不推荐**（附加项逻辑复制进 UI 违反单一事实来源）；推荐 2 字段方案。

### 3.4 WithdrawalStrategy 枚举正名（fixed → inflation_uplift 别名兼容，0 数值变化）

```diff
- export type WithdrawalStrategy = "fixed" | "threshold" | "percent";
+ export type WithdrawalStrategy = "fixed" | "inflation_uplift" | "threshold" | "percent";
+ // "inflation_uplift"（通胀上调）为正名；"fixed" 保留为兼容别名（输入等价 → Strategy::Fixed）；
+ // 字段缺省语义不变；数值路径零改动（montecarlo.rs:250 spend *= 1.0 + infl 保持）
```

- withdrawal.rs resolve_strategy：`Some(s) if s == "fixed" || s == "inflation_uplift" => Ok(Strategy::Fixed)`；:50 注释改「通胀上调（历史名 fixed；语义 = 按通胀样本逐年上行，非固定名义）」；montecarlo.rs:246-251 / bootstrap.rs:259-265 注释同步。
- UI：MonteCarloPanel.tsx:445 Radio value 保持 "fixed"（store 不迁移、零数据流风险），i18n mc.strategyFixed 文案改「通胀上调（默认）」；面板策略注（MonteCarloPanel.tsx:911-914）补「缺省与 fixed 均按通胀上调」。

### 3.5 share v4 字段变更清单（沿用 v2→v3 一次性失效先例）

| 项 | 变更 | 位置 |
|---|---|---|
| 版本号 | SHARE_LINK_VERSION 3 → 4 | share.ts:37 |
| 版本注释 | 追加「v4：pension 切片新增 targetRetireAge、accumulation 切片新增 sustainYears（P0-1/P0-2 修复）；v3 及更早链接与情景库存档一次性失效，需重新生成/重存——延续 v1→v2、v2→v3 既有决策」 | share.ts:31-36 |
| pension 键清单 | += "targetRetireAge"（必填有限数，缺键 → 整体 null，不做部分恢复） | share.ts:215-218 |
| accumulation 键清单 | += "sustainYears"（同上） | share.ts:210-213 |
| baseline / monteCarlo 切片 | 无输入字段变更（baseline 为纯输出侧；枚举别名不改切片形状） | — |
| 编码路径 | encodeShareState 随 store 类型扩展自动携带新字段，无编码逻辑改动 | share.ts:102-105 |
| 发布影响面 | 存量分享链接 + scenarios.ts 情景库存档（同走版本闸）一次性失效 | scenarios.ts:3-4 |

**契约变更合计：新增字段 7 个（PensionInput 1 + PensionOutput 2 + AccumulationInput 1 + AccumulationOutput 1 + BaselineOutput 2）+ 枚举别名 1 项。**

## §4 测试算例清单（T1–T10；期望值均为独立推导，σ=1e-9 时随机抖动 ~1e-4 量级、结论稳健）

> **修订轮勘误（第二轮，2026-11-21；以 docs/p7-spec.md §3 为唯一登记口径）**：T1 行 bridgeFundingNeeded 期望「2990×480 + 200000 = 1,635,200.00」废止——按 R5 裁定改 **1,435,200.00**（纯生活费口径，附加项单次计入段 2，两段相加 1,706,225.60 = 真实总需）。T4 行推导「支取自 110,000、年支 24,000、r=2%：W1 88,200 → … → W5 = −3,448.08」与其声明输入（r 10±1e-9%）矛盾，系笔误——按声明输入 r=10% 推导为唯一登记口径（node 复算 W1 = 97,000 → W7 = −13,333.22，第 7 支取年耗尽），且该用例在 σ=1e-9 下无暴跌样本、属确定性超额支取耗尽，测试名定为 `accumulation_sustained_fail_overdraw`（p7-spec §3.4）；「达标后遭遇负收益序列」的真 σ 算例由 T4-b 压力用例承载（p7-spec §3.4）。T9 行深相等断言口径更新为「解码产物为合法枚举 + 数值字段深相等 + inflation_uplift 载荷映射为 fixed（DecodeResult 携带规范化信号）」（p7-spec §3.9，修订轮二 R4）。

| # | 输入 | 期望值（独立推导） | 受影响测试 |
|---|---|---|---|
| T1 提前退休桥接 | 同 README.md:86 面板 ⑦ 默认（10343/0.6/30 年/5 万/139/开销 2990/0 孩/健康 20 万/4.5−2.0/30→60 岁）+ targetRetireAge 30 | yearsToRetire 30；basic 2482.32、account 359.71、pension 2842.03、coverage 0.95、adjusted 147.97、adjustedCritical 271025.60（P-A 锚点全不变）；**bridgeYears = 60 − max(30,30) = 30**；**bridgeFundingNeeded = 2990×480 + 200000 = 1,635,200.00**。推导：乘数 = round2(12÷0.025) = 480；段 1 全额 = 1,435,200 + 200,000 | 新增 `pension_bridge_period_fields`；pension_known_values_default_calculator（integration.rs:939-955）回归 |
| T2 无桥接 | 同 T1 但 targetRetireAge 60 | bridgeYears = max(0, 60 − max(60,30)) = 0；bridgeFundingNeeded = 0；其余同 T1。推导：停工年龄 ≥ 领取年龄 → 桥接期不存在 | 同 T1（新增分支断言） |
| T3 桥接 × 实际回报 ≤ 0 | 同 T1 但 nominal 2.0 / inflation 4.5 | error = 「通胀率需低于名义回报率」；yearsToRetire 30、**bridgeYears 30 保留**（同 yearsToRetire 回显先例 pension.rs:166-177）；bridgeFundingNeeded 0；金额/乘数全 0 | pension_error_when_real_return_not_positive（integration.rs:1000-1010）扩展 |
| T4 达标后暴跌不计持续成功 | currentAssets 100000、income 2000、expense 2000、target 105000、r 10±1e-9%、i 0±1e-9%、years 2、paths 20、seed 7、sustainYears 10 | fiProbability = 1.0；yearsP5..P95 = 1；**sustainedProbability = 0.0**。推导：月储蓄 0 → 第 1 年末 110,000 ≥ 105,000（i=0 目标恒定）→ 首达年 1；支取自 110,000、年支 24,000、r=2%：W1 88,200 → W2 65,964 → W3 43,283.28 → W4 20,148.95 → **W5 = −3,448.08 ≤ 0** → N=10 全体不存续 | 新增 `accumulation_sustained_fail_after_crash`；accumulation_* 全量回归 |
| T5 持续 30/40 年口径 | currentAssets 1,000,000、income 5000、expense 5000、target 500000、r 5±1e-9%、i 0±1e-9%、years 1、paths 20、seed 3；sustainYears 分别 30 / 40 | fiProbability = 1.0（t=0 达标：1,000,000 ≥ 500,000）；**sustainedProbability(30) = 1.0；(40) = 0.0**。推导：支取自 A₀ = 1,000,000、年支 60,000、r=5%，闭式 A_k = 1,200,000 − 200,000×1.05^k；A_36 = +41,636.77 > 0、A_37 = −16,281.39 ≤ 0 → 第 37 个支取年耗尽 | 新增 `accumulation_sustained_horizon_30_vs_40` |
| T6 fixed 更名后语义断言 | run_monte_carlo：assets 1,000,000、annualSpend 50,000、r 5±1e-9%、i 2±1e-9%、years 2、paths 1、seed 11；strategy 分别缺省 / "fixed" / "inflation_uplift" | 三次调用输出**逐字节一致**；samplePaths[0] = [999000.00, 996930.00]；sampleWithdrawalPaths[0] = [51000.00, 52020.00]。推导：spend₁ = 50,000×1.02 = 51,000；A₁ = 1,050,000−51,000 = 999,000；spend₂ = 52,020；A₂ = 999,000×1.05−52,020 = 996,930。若语义是固定名义则 A₂ = 998,950 ≠ 断言——反面锁定通胀上调。与 monte_carlo_nominal_recurrence_known_value（integration.rs:528-550，闭式 668,802.18）同口径互证 | 新增 `mc_fixed_semantics_after_rename`；strategy_resolution_and_validation（withdrawal.rs:478-529）扩展 resolve("inflation_uplift") → Strategy::Fixed |
| T7 费雪精确口径数值 | calculate_baseline：2990 / 0 孩 / 健康 20 万 / 4.5−2.0 | realReturnPct 2.5、multiplier 480、criticalValue 1,635,200（存量锚点不变）；**multiplierExact = 489.6**；**criticalValueExact = 1,663,904.00**。推导：精确实际回报率 = 0.025/1.02 = 2.450980392…% ≈ 2.451%；multiplierExact = 12×1.02/0.025 = 489.6（精确）；2990×489.6 = 1,463,904 + 200,000 = 1,663,904.00（比 480 口径高 28,704.00） | baseline_known_values_480_rule（integration.rs:73-86）扩展；pension_known_values_default_calculator 回归（pension multiplier 恒 480，不带精确口径） |
| T8 存量回归（threshold/percent 不变） | 现有全部输入原样 | mc_threshold_directional（integration.rs:1227）、mc_percent_never_depletes（:1282）、mc_withdrawal_output_shape（:1320）、mc_bootstrap_strategy_shared（:1381）、sequence/required_saving 各锚点全部保持现状断言；缺省 fixed 与 P1 逐字节锚（668,802.18；bootstrap 单元素同值 :1076-1091）不变。依据：三修复对蒙特卡洛数值路径零改动，P0-1/P0-2 为纯增量字段。**基线已实测：`cargo test` 68 全绿** | 上述全部 + monte_carlo_is_deterministic_for_same_seed / accumulation_same_seed_is_deterministic；新增「sustainYears>0 时既有字段与 =0 同 seed 一致」回归 |
| T9 share v4 往返 + v3 失效 | encodeShareState(含 pension.targetRetireAge 55、accumulation.sustainYears 30) | decode(encode(x)) 与 x 深相等；载荷缺任一新键 → null（禁止部分恢复）；同内容 v:3 历史载荷 → null（版本闸）。推导：SHARE_LINK_VERSION 4 → obj["v"] !== 4 即拒；numSlice 缺键即 null。**现状无前端测试装置（package.json 无 test 脚本、无 *.test.* 文件，已核实）——本算例需新增测试文件** | 新增 share 往返单测；p1-spec §6.4 往返验收更新 |
| T10 t=0 达标 + 30 年存续 | currentAssets 2,000,000、income 8000、expense 2990、target 1,635,200、r 4.5±1e-9%、i 2±1e-9%、years 5、paths 20、seed 5、sustainYears 30 | fiProbability = 1.0、yearsMedian 0（integration.rs:858-870 同型先例）；**sustainedProbability = 1.0**。推导：t=0 达标；首年支取率 = 35,880/2,000,000 = 1.794% 名义 ≪ 4.5% 名义回报（首年 spend₁ = 35,880×1.02 = 36,597.6 < 年度回报 90,000）→ 资产单调增长；独立数值复核 30 年末 ≈ 4,659,509.54、全程最低 > 2,000,000 | 新增 `accumulation_sustained_survive_realistic` |

## §5 前端适配面清单

1. **bridge.ts**：§3 全部类型与语义注释（PensionInput/Output、AccumulationInput/Output、BaselineOutput、WithdrawalStrategy、§i/§g 注释分段口径与随机流裁定）。
2. **finance.ts**：parseBaseline（:154-165，+2）、parseAccumulation（:317-344，+sustainedProbability）、parsePension（:353-368，+2）逐字段轻量校验同步。
3. **store/useCalculatorStore.ts + defaults.ts**：PENSION_DEFAULTS（defaults.ts:164-172）+ `targetRetireAge: 60`（默认 = retireAge → 默认视图 bridgeYears = 0，README.md:86 锚点不漂移）；ACCUMULATION_DEFAULTS（:176-181）+ `sustainYears: 0`（默认关，零默认行为变化）；setPensionInputs/setAccumulationInputs 为泛型 patch 无需改本体。
4. **data/pensionParams.ts**：PensionInputs 接口（:43-58）+ targetRetireAge 注释（与 retireAge 语义区分：金额驱动 vs 时间口径）。
5. **PensionPanel.tsx**：新增「想停止工作的年龄」IntField（16–75）+ 桥接行（bridgeYears / bridgeFundingNeeded）+ adjustedCritical 行标注「领取后口径」；计发月数联动（:49-53、:58-62）不动。
6. **AccumulationPanel.tsx**：sustainYears IntField（0 = 关闭 + hint）+ sustainedProbability 与 fiProbability 并列展示（:506-517 邻位）；submittedTarget 快照机制（:99、:149）不动。
7. **MonteCarloPanel.tsx**：策略 Radio 标签文案（:445，value 不动）+ 策略注（:911-914）补正名句。
8. **i18n 三语**（src/i18n/locales/{zh-CN,zh-Hant,en}.ts）：新键 pension.targetRetireAge(+Tooltip)、pension.bridgeLine、pension.bridgeNote、accumulation.sustainYears(+Tooltip)、accumulation.sustainedLabel(+Hint)、baseline.multiplierExactLabel、baseline.criticalExactLabel；改写 mc.strategyFixed。
9. **share.ts**：v4（§3.5 表全项）。
10. **README.md**：:86 27.10 万案例注补桥接口径句（27.10 万为「领取后」段 2 口径；30–60 岁桥接段另需生活费备资 143.5 万——**修订轮勘误（R5）：上版「另需 163.5 万」含附加项双计，按单次计入裁定更正；两段相加 170.6 万 = 真实总需**）；:41 163.5 万主锚不变（面板 ⑨ 可并列「精确口径 489.6 → 166.4 万」注）；:121 MC 案例策略名跟随正名（**修订轮勘误（R2）：实测 :121 为 MC 标注截图图注、无策略名字样，改名锚点为 README.md:43/:175 与 README.en.md:43/:170**）。
11. **docs 规范同步**：p1-spec.md §3.0/§3.3（pension 校验顺序插入 targetRetireAge 条目）、§7 锚点表补 T1/T7 值；p0-spec.md §4.7 accumulation 锚点补存续口径与随机流裁定。
