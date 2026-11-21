# P7 实现规范：财务决策语义修正——养老金桥接 · 持续成功率 · 支取策略正名 · 费雪双口径 · 工程快赢

| 项目 | 说明 |
|---|---|
| 文档性质 | 实施规范：P7 轮（财务决策语义修正）。文件级、可勾选；每处变更加「现状（实测引用）→ 目标」与验收锚点 |
| 规范输入 | `docs/research-model-audit.md`（P0-1/P0-2/P0-3 代码级定位与契约草案，本文按其 §3 采纳并修正两处推导，见 §3 说明）；`docs/research-retirement-models.md`（官方延迟退休参数 §1 / Morningstar §2 / 桥接成熟做法 §3 / 费雪口径 §4）；`docs/design-language.md`（宪法，S1–S26 回归基线） |
| 宪法关系 | 北极星「静水账房」与签名元素 S1–S26 零回退；`docs/design-atlas-brief.md` 的 Atlas IA / DS 令牌演进**不在本轮**（WF 系列在 P7 验收部署后启动，Atlas brief §8.4） |
| 基线实测 | 起草会话实跑：`cargo test`（src/wasm）15 lib 单元 + 53 integration = 68 全绿；`node scripts/check-size.mjs` → `DIST_TOTAL_KB=1953`、`WASM_MAX_KB=364`（dist 原始字节 1,999,865 / wasm 372,534，门禁通过） |
| 测试装置现状 | Rust 侧 `cargo test` 可用；前端**无**测试装置（package.json scripts 仅 dev/build/preview/check:size/check:currency/check:a11y，无 *.test.* 文件，已核实）——T9 走 `scripts/check-*.mjs` 零依赖先例（§3） |

---

## §0 范围裁定（本轮做什么 / 明确不做什么）

### 0.1 本轮范围（六项，全部采纳）

- [ ] **A. 养老金桥接（时间分阶段）**：`estimate_pension` 新增 `targetRetireAge` 输入与 `bridgeYears` / `bridgeFundingNeeded` 输出——把「养老金」从"即时全额覆盖直扣"修正为"自起领年龄才进入现金流"的两段口径（P0-1）。
- [ ] **B. 首次达标 / 持续成功双指标**：`simulate_accumulation` 新增 `sustainYears` 输入与 `sustainedProbability` 输出——达标后同一路径续接 N 年支取存续判定，"曾在某年末 ≥ 目标" ≠ "达标后可持续"（P0-2）。
- [ ] **C. 支取策略改名**：缺省支取策略正名——代码枚举增加 `inflation_uplift` 别名（`fixed` 保留为兼容别名，数值路径零改动），界面文案「固定名义」→「固定实际支出（默认）」三语（P0-3；命名裁定见 §4.3）。
- [ ] **D. 永续警示**：反向估算「每月可放心花费」的永续提取口径追加警示语 + Morningstar 2026 安全支取率参照（research-retirement-models §2.3 模板句）。
- [ ] **E. 费雪双口径**：`calculate_baseline` 新增 `multiplierExact` / `criticalValueExact`（精确费雪式），480 教学口径全部字段不动、仍为主输出（research §4：并行展示，不做选项切换）。
- [ ] **F. 工程快赢（三项）**：分享隐私提示（「编码 ≠ 加密」）/ 离线汇率快照核实（占位 → 真实值 + 来源 + 日期）/ README 修正（§8 清单）。

### 0.2 明确排除（留待 P8 / WF 系列，本轮禁做）

- **统一生命周期引擎**：按事件发生时间计现金流的年度模型、出生年月推演法定退休年龄的动态默认值（research-retirement-models §1.5 的「默认起领年龄 = 按出生年月推算」**本轮不实现**——仅以注释与提示文案承载官方参数，见 §2.5）。对应 Atlas brief WF-04 前置的原 P8。
- **人生时间轴 UX / Atlas IA**：四任务入口、时间透镜、人生事件胶囊等全部不在本轮（Atlas brief §6：WF-03/WF-04 交付物；P7 期间不启动 WF 系列）。
- **蒙特卡洛 threshold / percent 数值路径**：零改动（§5 红线）。
- **退休金「金额算法」**：basic/account/pensionMonthly 的两层公式与计发月数联动零改动——时间口径全部由 `targetRetireAge` / `bridgeYears` 承载（金额字段与时间字段解耦，audit §3.1）。

---

## §1 缺陷与现状（引 audit；行号为本会话复核）

### 1.1 P0-1 养老金「直扣」——无桥接期时间口径

- 现状：`src/wasm/src/pension.rs:216-224` `adjusted_monthly_expense = max(0, monthlyExpense − pensionMonthly)` 即刻直扣——养老金被当作当期已发放。`retire_age` 的全部消费点（audit §1.1 穷尽 + 本会话复核 pension.rs:151-162 与 bridge.ts:563/579）：校验、`yearsToRetire` 展示、经 `pensionParams.ts:20-27` 计发月数联动间接影响金额——**不存在任何"养老金自 retireAge 起才覆盖开销"的时间逻辑**。
- **决策误导推演（README.md:86 案例，本会话按公式独立复算）**：面板 ⑦ 默认输入（30 岁 / 60 岁退休 / 月开销 2,990 / 社平 10,343 / 指数 0.6 / 缴费 30 年 / 余额 5 万 / 计发月数 139 / 健康 20 万 / 4.5−2.0）→ 预计月养老金 2,842.03、调整后参考线 ¥271,025.60（P-A 锚点，integration.rs:939-955 锁定）。用户若 30 岁停工：30–60 岁为无工资且无养老金的桥接期，须按全额 2,990/月备资——全额参考线 = 2,990×480 + 200,000 = **1,635,200 元**（README.md:41 主锚同源）。现状把 27.10 万展示为"养老金覆盖后的当下目标"，对停工者误导倍数 = 1,635,200 ÷ 271,025.60 ≈ **6.03×**；按 27.10 万反推可持续月开销 = 271,025.60 ÷ 480 ≈ 564.64 元/月，远低于桥接期所需 2,990 元/月——按该数字规划的用户在 30–60 岁间必然击穿预留。
- 修正：两段口径（§2.1）——段 1「停工 → 起领」全额备资、段 2「起领后」调整后口径（现状字段语义保留、展示标注「领取后」）。

### 1.2 P0-2 积累模拟「首触判定」——达标 ≠ 持续富足

- 现状：`src/wasm/src/accumulation.rs:221`（t=0）与 :246-252（循环内）均为首触即记录 `hit_year`，此后无任何存续检查；`fiProbability`（:270）度量「曾在某年末 ≥ 通胀上行目标」。
- 决策误导（audit §2 P0-2 场景）：目标 163.5 万、当前 50 万、模拟 40 年——某路径第 18 年首触后第 19 年 −40% 级回落且不再达标，现状仍计「达成」；用户按中位首达年辞职遭遇的恰是达标后序列风险，现状无任何指标度量它。
- 修正：`sustainYears`（缺省 0 = 关）+ `sustainedProbability`（§2.2，同路径续接支取）。

### 1.3 P0-3 缺省策略「fixed」名实背离

- 现状：`montecarlo.rs:249-251` `Strategy::Fixed => spend *= 1.0 + infl`——名为「固定名义」（withdrawal.rs:50 注释、i18n zh-CN.ts:449「固定名义」/ zh-Hant.ts:409「固定名義」/ en.ts:512 "Fixed nominal"、MonteCarloPanel.tsx:445 Radio），实为逐年按通胀样本上行（bridge.ts:356 自述 `spend_t = annualSpend × cum_infl_t`）。
- 决策误导（README.md:121 案例）：默认输入耗尽概率 94.4% 的口径实为"实际支出恒定"；按「固定名义」理解的用户以为支出恒 3.6 万/年，实际第 30 年支出 = 3.6 万 × 1.02³⁰ ≈ 6.52 万/年——策略比较与预算决策被系统性误导。数值本身正确，问题纯在命名与语义对齐。
- 修正：枚举别名 + 界面正名（§2.4 / §4.3）；**sequence.rs 的「固定名义」是真语义（通胀置 0 的对照模拟），不属于改名对象**（白名单见 §7 断言④）。

### 1.4 工程现状（快赢三项的依据）

- 分享隐私：`share.ts:102-105` 编码 = JSON → base64url（**可逆编码，非加密**）；README.md:28 宣称「不上传、不采集任何用户数据」为真，但未告知"分享链接本身含可读出的全部业务输入"；i18n `share.copyTooltip`（zh-CN.ts:651，修订轮二 R2 复测行号）无此提示。
- 离线快照：`defaults.ts:200-208` `FX_RATE_SNAPSHOT` 为占位（仅 CNY:1，`source: "pending"`、`ratesUpdatedAt: ""`）；README.md:279 自述「离线快照当前为占位数据（仅 CNY:1）……多币种面板的离线回退不可用」。`rates.ts` 的回退链路已实现（`offlineSnapshot()`，来源标注「离线快照」），仅缺真值。
- README：27.10 万案例无桥接口径句（:86）；:43（功能段）/:175（功能表行）MC 案例策略名待随正名（修订轮 P1-2 实测纠正，原记 :121 有误——该行为 MC 标注截图图注、无策略名字样）；反向估算案例「永续提取口径」无警示（:126，修订轮纠正，原记 :93 有误——该行为面板 ⑧ 表头行）；离线快照表述待随真值更新（:183、:279）。

---

## §2 Rust 契约变更（字段级 diff；bridge.ts 为单一事实来源，Rust 侧逐字实现）

### 2.1 PensionInput / PensionOutput（+1 输入，+2 输出）

```diff
 interface PensionInput {                    // src/wasm/bridge.ts §i（:559）
   ...
   retireAge: number;            // 不动：仍驱动养老金金额（校验、计发月数联动、yearsToRetire）
+  targetRetireAge?: number;     // 想停止工作的年龄（16–75，整数；缺省 = retireAge → bridgeYears = 0，
+                               //   现状口径与 README.md:41/86 锚点视图零漂移）
 }
 interface PensionOutput {                   // （:577）
   ...
+  bridgeYears: number;          // 桥接期年数 = max(0, retireAge − max(targetRetireAge, currentAge))；
+                               //   解析/校验失败安全值 0（u32）
+  bridgeFundingNeeded: number;  // 桥接期需备资金（元，两位小数）＝ bridgeYears > 0 时
+                               //   round2(monthlyExpense × multiplier)——纯生活费口径；
+                               //   一次性附加项（育儿/健康/重大投入）不在桥接段重复计入——
+                               //   已计入段 2 adjustedCriticalValue（修订轮二 R5 单次计入裁定）；
+                               //   bridgeYears = 0 或实际回报 ≤ 0 时 = 0
 }
```

**桥接算法口径公式**（写入 bridge.ts §i 注释 + PensionPanel 口径注）：

- 段 1（桥接期，targetRetireAge → retireAge）：无工资、无养老金，开销 = monthlyExpense 全额；需备资金 = round2(monthlyExpense × multiplier)——沿用同一 480 乘数口径（先 round2 后相乘），**纯生活费口径、不含一次性附加项**（附加项单次计入段 2，见下）。
- 段 2（retireAge 之后）：养老金覆盖 → `adjustedMonthlyExpense` / `adjustedCriticalValue`（**现状字段语义不变**——adjusted × multiplier + 附加项，pension.rs:226-241 公式零改动，展示标注「领取后」）。
- **附加项单次计入归属裁定（修订轮二 R5，取代上版「双重计入 + 口径注明示」）**：健康/子女/重大投入三类一次性附加项**归属段 2**——`adjustedCriticalValue` 保持现状公式与 P-A 锚点（271,025.60）零漂移；桥接段改为纯生活费口径（bridgeFundingNeeded = round2(monthlyExpense × multiplier)，不再含附加项），**两段相加 = 真实总需**：T1 例段 1 = 2,990×480 = 1,435,200.00、段 2 = 147.97×480 + 200,000 = 271,025.60（健康预留 200,000 计一次）、相加 = 1,706,225.60（本会话 node 复算，与评审 R5 独立数字一致）。**选择理由**：(i) 存量锚点零漂移——段 2 附加项语义是 P-A 锚点与 `pension_adjusted_critical_matches_baseline`（integration.rs:958-982）恒等式的载体，归属段 2 = 现状公式/测试/README:86 案例数字全部不动；(ii) 语义正确——健康预留、子女教育、重大投入与养老金起领时点无关，无论桥接期长短都必须持有，天然属于「停工后总备资」的一次性项而非「桥接期生活费」；(iii) 被否决变体（附加项归桥接段、段 2 剔除）——需改 pension.rs:226-241 现状公式 → P-A 锚点漂移 + baseline 恒等式破坏 + README:86 案例连锁重算，三重回归代价不成比例。**恒等式变化登记**：bridgeFundingNeeded 不再恒等于 calculate_baseline.criticalValue（上版恒等式声明废止）；新锁定断言 = `bridgeFundingNeeded == round2(monthlyExpense × multiplier)`（multiplier 为同一 pension 输出乘数，§3 T1）；展示层口径注与 README（§8.1）明示「一次性预留已计入『领取后』参考线、两段相加即真实总需」。
- **有意保守的取舍（必须随口径注明示）**：有限年限支取本可用年金因子（30 年 2.5% 实际的年金化备资 ≈ 75.1 万——node 复算 750,978.90，修订轮二更正上版误记 75.9 万；低于乘数口径生活费 143.5 万）；最小 diff 保留乘数口径 = 对桥接段偏保守（多备），登记为已知偏差，不阻塞本轮。
- `saturating` 兜底：`targetRetireAge ≤ currentAge`（已停工）→ 桥接 = retireAge − currentAge（即 yearsToRetire）；不与 retireAge 做大小约束。
- 校验：`to_u32_int("停止工作年龄", v, 16, 75)`（common.rs 同法），**插在 pension.rs:152（`retire_age > current_age` 校验）与 :153（contrib_years）之间**——p1-spec §3.3 校验顺序表同步追加该条目；`targetRetireAge` 缺省（serde `Option<Decimal>` = None）不触发该校验、取 retire_age。
- 错误分支形状：业务错误（实际回报 ≤ 0，pension.rs:166-177）→ `bridgeYears` 仍返回计算值（同 `yearsToRetire` 回显先例）、`bridgeFundingNeeded = 0`；解析/校验失败 `error_output`（pension.rs:117-133）→ 两字段 0。

### 2.2 AccumulationInput / AccumulationOutput（+1 输入，+1 输出）

```diff
 interface AccumulationInput {               // src/wasm/bridge.ts §g（:447）
   ...
+  sustainYears?: number;        // 达标后接支取模拟年数 N（0–200 整数；缺省 0 = 关闭）
 }
 interface AccumulationOutput {              // （:482）
   fiProbability: number;        // 不动（首触口径）
+  sustainedProbability: number; // 持续成功率 = 达标且达标后 N 年支取存续的路径占比（0–1，6 位小数）；
+                               //   sustainYears = 0（含缺省）时恒为 0.0（哨兵 = 未度量；UI 以输入侧
+                               //   sustainYears > 0 决定是否展示，Rust 不引入 -1 特判）
 }
```

**双指标算法**（写入 bridge.ts §g 注释）：

- 首达年 t* 判定**不变**（accumulation.rs:221 t=0 判定与 :246-252 循环内首触即记录）。
- **随机流拓扑（钉死为「两段式独立派生流」——修订轮二 R1 裁定，取代上版「同流两遍扫描」与 audit §3.2 的逐路径交错读法）**：
  - **pass1（积累段）**：与现状 accumulation.rs:215-267 完全同构——单循环逐路径消费 2×years 个样本（路径外层、年份内层、先回报后通胀），样本总量 = 2×years×paths，**顺序与数量与 P7 前 rng 流逐字节一致**；首达时刻为每条路径记录快照 A*（t* = 0 → currentAssets；t* ≥ 1 → 第 t* 年末资产）与 cumInfl*（未达标路径记 None）。**pass1 与 `sustainYears` 取值完全无关——无条件字节兼容，不随 N 变化。**
  - **pass2（支取段）**：**仅对达标路径**（hit_year ≠ None 的路径 p）执行；每条达标路径使用**独立派生流** `StdRng::seed_from_u64(seed ^ ((p as u64 + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15)))`（黄金比例常数乘法混合，SplitMix64 同族——派生种子只依赖 (seed, p)，不依赖 years / paths 总数 / N；`seed_from_u64` 内部另有 SplitMix64 扩展，进一步增强低熵 seed 下的流质量）。自该派生流消费 2×N 个样本（先回报后通胀），自 pass1 快照 A* 起支取：`spend_k = 12 × monthlyExpense × cumInfl* × ∏_{j=1..k}(1+π_j)`（第 1 年即含第 1 个支取年通胀样本——与 montecarlo.rs:250 同语义）；`A_k = A_{k−1} × (1+r_k) − spend_k`；任一年末 `A_k ≤ 0` → 该路径不存续、**该路径提前终止抽样**（montecarlo.rs:268-292 耗尽即终止同款语义；流隔离下提前终止不波及任何其他路径的抽样——同流变体要求每路径恒定消费 2×N，正是它无法享受的简化）。未达标路径不进入 pass2、零支取抽样。
  - 防御钳制两段同款（回报/通胀样本 < −0.99 钳 −0.99）。
- 存续 = 达成且 ∀k∈1..N: A_k > 0；sustainedProbability = 存续路径数 ÷ paths（6 位小数）；sustainYears = 0（含缺省）→ 不进入 pass2、恒为 0.0（哨兵 = 未度量；UI 以输入侧 sustainYears > 0 决定是否展示，Rust 不引入 -1 特判）。
- **裁定理由与被否决拓扑（三选一，取舍如实登记——修订轮二 R1）**：
  1. **同一路径继续支取（资产轨迹层面保留）**——pass2 自 pass1 记录的 A* 与 cumInfl* 续递推，首触与存续度量同一条财富轨迹，「达标后立刻遭遇序列风险」正是持续成功率要捕捉的机制；否决跨路径重抽（把达标时资产与后续回报强行独立，系统性低估序列风险）。
  2. **随机流隔离（样本流层面）与语义取舍**——pass2 不消费主 rng 流、每条达标路径自派生流独立抽样。**如实登记：「资产路径延续、随机流隔离」**——支取样本与积累样本在流层面解耦；由于 ChaCha 流不同位置的样本本就独立同分布，派生流与「同流顺延续接」在统计上无差别，差别纯在工程结构。选派生流的三条工程理由：(i) **无条件兼容**——pass1 与 N 完全解耦，不变量 (c) 无条件成立，不依赖「第二遍严格顺延在全部积累样本之后」的顺序纪律；(ii) **样本位置稳定**——路径 p 的支取抽样只依赖 (seed, p)，不随 paths 总数 / years 平移（同流变体下增减 paths 会平移全部支取样本的流位置）；(iii) **无丢弃消费**——未达标路径零抽样（同流变体要求未达标路径也消费 2×N 个样本丢弃以维持流位置恒定）。
  3. **否决拓扑甲「逐路径交错续接」**（audit §3.2 的自然读法）：每路径先积累 2×years 再续接 2×N 支取——支取样本插入使路径 ≥1 的积累抽样整体后移 2×N，同 seed 下 fiProbability / 年限分位 / 期末分位 / samplePaths 全部改变，随机流契约（bridge.ts:404-406）破坏，不变量 (c) 不可能成立（评审 R1 矛盾机理，成立）。
  4. **否决拓扑乙「同流两遍扫描」**（上版 P1-1 裁定，修订轮二 R1 取代）：pass1 全路径积累后、pass2 沿主流为**每条路径**（含未达标路径消费丢弃）消费 2×N——(b)/(c) 虽仍成立，但依赖顺序纪律、要求未达标路径丢弃消费、支取样本流位置随 paths/years 平移；统计上与派生流等价、工程上三处更劣，故被取代。**登记：两拓扑在 (b)/(c) 断言下不可区分（测试锁不变量与数值锚点，不锁拓扑字面）——拓扑以本节 + bridge.ts §g 注释钉死。**
  5. **派生种子公式**：`seed ^ ((p + 1) × 0x9E37_79B9_7F4A_7C15)`（u64 wrapping 乘法）。理由：单 `seed ⊕ p` 在低熵 seed 下相邻路径派生种子仅差低位翻转、流相关性风险不可忽略；乘黄金比例常数后相邻路径派生种子在 64 位空间近似均匀散布。同 seed 同输入下派生流确定性（StdRng::seed_from_u64 契约），可复现性铁律不破。
  6. **可复现性铁律（bridge.ts:404-406）三不变**：(a) pass1 抽样顺序不变——2×years×paths 个样本的顺序与数量与现状完全一致；(b) `sustainYears` 缺省或 = 0 → 不进入 pass2，输出与现状**逐字节一致**；(c) `sustainYears > 0` 时**既有字段**（fiProbability / 年限分位 / 期末分位 / samplePaths / neverReachedShare）与 `sustainYears = 0` 同 seed **逐字节一致**（pass1 与 N 解耦是拓扑性质、无条件成立）——由**真实量级 σ** 输入的锁定测试保证可侦测（§3.8：σ = 1e-9 退化输入下交错拓扑也平凡通过，不可作锁定测试）。
- **对 T4/T5/T10 的拓扑鲁棒性声明**：三条用例 σ = 1e-9、样本 ≈ 均值与流内位置无关，期望值在派生流、同流两遍与交错拓扑下均成立——拓扑正确性由 §3.8 非退化不变量测试锁定，不由这三条承担。
- 校验：`to_u32_int("存续验证年数", v, 0, 200)`，插在 accumulation.rs:179（paths）与 :180（seed）之间；缺省（None）不触发 = 0。
- 错误分支：`error_output`（accumulation.rs:133-156）增 `sustainedProbability: 0.0`；手动 fallback JSON 字符串（:153）同步加键。

### 2.3 BaselineOutput 费雪双口径（+2 输出，480 仍为主输出）

```diff
 interface BaselineOutput {                  // src/wasm/bridge.ts §a（:71）
   realReturnPct / multiplier / criticalValue / monthlyExpense: number;  // 480 教学口径全部不动、仍为主输出
+  multiplierExact: number;      // 精确乘数（费雪口径）＝ round2(12 × (1 + inflationPct/100)
+                               //   ÷ ((nominalReturnPct − inflationPct)/100))，
+                               //   代数恒等于 12 ÷ ((1+r)/(1+i) − 1)（Decimal 域无中间舍入）；
+                               //   计算一律用精确式，近似式仅作教学口径注（research §4.2，不做选项切换）
+  criticalValueExact: number;   // 精确口径目标本金 ＝ round2(monthlyExpense × multiplierExact
+                               //   + 附加项)（先舍入后相乘，与 480 口径同形）
 }
```

- 错误分支（实际回报 ≤ 0）：两新字段 = 0（baseline.rs:100-108 返回分支与 :70-82 `error_output` 同步）。
- **否决最小 diff 变体**（只加 multiplierExact、精确参考线由前端复算）：附加项逻辑复制进 UI 违反单一事实来源（audit §3.3），不采纳。

### 2.4 WithdrawalStrategy 枚举正名（fixed → inflation_uplift 别名兼容，0 数值变化）

```diff
- export type WithdrawalStrategy = "fixed" | "threshold" | "percent";      // bridge.ts:259
+ export type WithdrawalStrategy = "fixed" | "inflation_uplift" | "threshold" | "percent";
+ // "inflation_uplift" 为正名（语义 = 按通胀样本逐年上行，等价于固定实际购买力支出）；
+ // "fixed" 保留为兼容别名（输入等价 → Strategy::Fixed）；字段缺省语义不变；数值路径零改动
```

- `withdrawal.rs` `resolve_strategy`（:112-114）：`None => Fixed` 与 `Some("fixed")` 不动，新增 `Some(s) if s == "inflation_uplift" => Ok(Strategy::Fixed)`；:149 错误文案改「支取策略须为 fixed / inflation_uplift / threshold / percent 之一」（已核实该文案无任何测试断言——grep integration.rs 零命中，文案变更不触发测试更新）；:50 注释改「通胀上调（历史别名 fixed；语义 = 按通胀样本逐年上行，非名义恒定支出）」——**措辞避用「固定名义」字样**（该行不进 §7 断言④白名单）；montecarlo.rs / bootstrap.rs 注释同步（同款避字措辞）。
- **数值路径零改动**：montecarlo.rs:250 `spend *= 1.0 + infl` 保持；threshold（withdrawal.rs:161-188）与 percent（:227-264）逐行不动。
- share.ts 枚举闸（:146-150，实读现状闸 = 非 fixed/threshold/percent → 整体 null）：**解码端把 `"inflation_uplift"` 规范化为 `"fixed"`（修订轮二 R4 裁定：映射而非原样保留、非 null）**——编码端 store 永不产出该值（Radio value 保持 `"fixed"`，MonteCarloPanel.tsx:445，store 不迁移、零数据流风险）；规范化语义 = 「外来载荷/未来版本的『通胀上调』正名与 `fixed`（固定实际支出）语义相同，并入即可」，避免恢复后的 store 持有 UI 枚举外值（Radio 无选中态、策略注按错误分支渲染）。**恢复路径一次性提示**：`decodeShareState` 返回类型扩展为 `DecodeResult { state: ShareState; strategyNormalizedFromLegacy: boolean } | null`（签名变更登记；share 链接恢复与 scenarios.ts 情景库恢复两处调用点同步，调用点数量零新增），规范化发生时 store 置瞬态标志（不入 share 载荷、不入情景存档、resetEpoch 语义不变），MonteCarloPanel 策略注区渲染一次性提示「旧链接的通胀上调口径已并入固定实际支出」（i18n `share.strategyLegacyNotice` 新键三语，§4.5；关闭提示或切换策略即清除）。UI Radio value 保持 `"fixed"` 不变。

### 2.5 政策参数默认值与来源引用（仅注释与文案，不入计算）

- [ ] `src/data/pensionParams.ts` 注释增补官方参数表（值与来源逐条引自 research-retirement-models §1，本文件只登记不重述全文）：男职工目标 63 岁 / 女（原 55）58 岁 / 女（原 50）55 岁，节奏每 4 / 4 / 2 个月出生批次 +1 个月，延迟上限 36 / 36 / 60 个月，2039 年到位（《办法》第一条，中国政府网 2024-09-13 受权发布）；弹性提前 ≤ 3 年且不低于原法定年龄、弹性延迟 ≤ 3 年（《办法》第三条）；最低缴费年限 2030 年起每年 +6 个月、2039 年起 20 年（《办法》第二条）。
- [ ] i18n `pension.retireAgeDelayNote`（zh-CN.ts:204，三语）按上述口径压缩改写（≤2 行，全文归 tooltip——反冗长原则）。
- [ ] **不做**动态推算默认起领年龄（§0.2 排除）；`retireAge` 默认仍为 60（defaults.ts:166，README 锚点不漂移）。

**契约变更合计：新增字段 7 个（PensionInput 1 + PensionOutput 2 + AccumulationInput 1 + AccumulationOutput 1 + BaselineOutput 2）+ 枚举别名 1 项**（与 audit §3.5 一致）。

---

## §3 测试算例与期望值（10 条 + T4-b 关系断言用例；期望值全部由起草会话按公式独立推导并用 node 复算，未以现有实现输出为真值）

**登记格式**：每条 = 输入 → 期望值（独立推导）→ 受影响测试。**旧期望 → 新期望登记表**在 §3.11；保留 / 更新 / 新增清单在 §3.12。σ = 1e-9（百分点）时随机抖动 ~1e-4 量级、结论稳健（audit 同口径声明）。

### 3.1 T1 提前退休桥接（新增 `pension_bridge_period_fields`）

- 输入：同 README.md:86 面板 ⑦ 默认（wage 10343 / idx 0.6 / years 30 / balance 50000 / months 139 / expense 2990 / children 0 / cost 580000 / health 200000 / major 0 / nominal 4.5 / inflation 2.0 / currentAge 30 / retireAge 60）+ `targetRetireAge: 30`。
- 期望：yearsToRetire 30；basic 2,482.32、account 359.71、pension 2,842.03、coverage 0.95、adjusted 147.97、adjustedCritical 271,025.60（P-A 锚点全不变）；**bridgeYears = 60 − max(30, 30) = 30**；**bridgeFundingNeeded = round2(2,990 × 480) = 1,435,200.00（纯生活费口径，附加项不在桥接段——修订轮二 R5）**；两段相加 = 1,435,200.00 + 271,025.60 = **1,706,225.60 = 真实总需**（健康预留 200,000 单次计入段 2）。
- 独立推导：乘数 = round2(12 ÷ 0.025) = 480；段 1 = 2,990×480；锁定断言 = `bridgeFundingNeeded == round2(monthlyExpense × multiplier)`（同一 pension 输出乘数）；和式闭合 node 复算一致（§2.1 修订轮二 R5 裁定）。
- 受影响测试：新增 `pension_bridge_period_fields`（integration.rs）；`pension_known_values_default_caliber`（:939-955）回归。

### 3.2 T2 无桥接（T1 同测试新增分支断言）

- 输入：同 T1 但 `targetRetireAge: 60`。
- 期望：bridgeYears = max(0, 60 − max(60, 30)) = 0；bridgeFundingNeeded = 0；其余同 T1 全不变。
- 独立推导：停工年龄 ≥ 起领年龄 → 桥接期不存在。
- 受影响测试：`pension_bridge_period_fields` 增分支；`pension_known_values_default_caliber` 增「缺省 targetRetireAge → bridgeYears = 0」断言（输入 helper 不传新字段，验证 serde 缺省路径）。

### 3.3 T3 桥接 × 实际回报 ≤ 0（扩展 `pension_error_when_real_return_not_positive`，:1000-1010）

- 输入：同 T1 但 nominal 2.0 / inflation 4.5（+ targetRetireAge 30）。
- 期望：error = 「通胀率需低于名义回报率」；yearsToRetire 30、**bridgeYears 30 保留**（同 yearsToRetire 回显先例 pension.rs:166-177）；bridgeFundingNeeded 0；金额/乘数全 0。
- 独立推导：real = 2.0 − 4.5 = −2.5 ≤ 0 → 错误分支；bridgeYears 与金额无关（时间字段），按回显先例保留。
- 受影响测试：`pension_error_when_real_return_not_positive` 扩展；`pension_validation_errors`（:1013）增 targetRetireAge 越界（15 / 76 / 非整数）分支。

### 3.4 T4 达标后超额支取不计持续成功（新增 `accumulation_sustained_fail_overdraw`；修订轮 P2-8 改名）

- 输入：currentAssets 100,000、income 2,000、expense 2,000（月储蓄 0）、target 105,000、r 10±1e-9%、i 0±1e-9%、years 2、paths 20、seed 7、sustainYears 10。
- 期望：fiProbability = 1.0；yearsP5..P95 = 1；**sustainedProbability = 0.0**。
- 独立推导（本会话 node 复算）：月储蓄 0 → 第 1 年末 110,000 ≥ 105,000（i = 0 目标恒定）→ 首达年 1，A* = 110,000、cumInfl* = 1；支取年支 24,000（对 A* 的年支取率 24,000/110,000 ≈ 21.8%，远超 r = 10%）：W1 = 97,000 → W2 = 82,700 → W3 = 66,970 → W4 = 49,667 → W5 = 30,633.70 → W6 = 9,697.07 → **W7 = −13,333.22 ≤ 0** → 第 7 个支取年耗尽 ≤ N = 10 → 全体路径不存续。
- **名实口径（修订轮 P2-8）**：本用例覆盖的是「首触即达标但支取率超高」的确定性超额支取耗尽机制（σ = 1e-9 下无任何暴跌样本）——测试名由上版 `accumulation_sustained_fail_after_crash` 改为 `accumulation_sustained_fail_overdraw`，避免误导维护者以为覆盖 crash-after-FI 序列风险场景；真 σ 的「达标后回落」叙事由 T4-b 关系断言用例（下）与 T8 非退化不变量共同承载。
- **与 audit 文档的偏差登记**：audit §4 T4 推导行写作「支取自 110,000、年支 24,000、r=2%：W1 88,200 → … → W5 = −3,448.08」——该推导与其自身声明的输入（r 10±1e-9%）矛盾（支取阶段沿用同分布同路径，r 应为 10%）。结论两口径均为 sustainedProbability = 0.0；本规范按声明输入取 r = 10% 推导为唯一登记口径，audit 该行视为笔误修正。
- 受影响测试：新增 `accumulation_sustained_fail_overdraw`；accumulation_* 现有 7 项全量回归。

**T4-b 真 σ「达标后遭遇负收益序列」压力用例（新增 `accumulation_sustained_at_most_fi`；修订轮 F8 增、修订轮二 R8 定型为 crash-after-FI 算例）**

- 输入：currentAssets 500,000、income 20,000、expense 12,000、target 1,635,200、r 4.5±12%、i 2±1%、years 40、paths 200、seed 42、sustainYears 10。
- 期望：`0 ≤ sustainedProbability ≤ fiProbability ≤ 1`（关系断言，不锁具体数值）。
- 独立推导：sustainedProbability 的分子（达标且存续路径数）是 fiProbability 分子（达标路径数）的子集——「未达标路径一律不计存续」（§2.2），逻辑必然，与 seed/实现输出无关。
- **crash-after-FI 压力标定（修订轮二 R8）**：月支出 12,000 → 达标时（资产 ≈ 1,635,200）首年支取率 ≈ 144,000 ÷ 1,635,200 ≈ **8.8% 名义**，远超 r 均值 4.5%——真实波动 σ（12%）下负收益序列与高支取率叠加，使大量达标路径在 N = 10 年内耗尽：本用例真实驱动「首触达标 → 遭遇负收益序列 → 存续失败」机制（audit §2 P0-2 的暴跌叙事），而非常规低支取率下存续率 ≈ 达成率的平凡情形。
- 数值期望在真 σ 下不可独立推导（正态样本无界，无法构造与实现无关的必然耗尽/必然存续锚点），故断言取逻辑必然的关系式——对「可选补真 σ 暴跌用例」的采纳形式，理由登记于文末修订对照 R8 行。
- 受影响测试：新增 `accumulation_sustained_at_most_fi`。

### 3.5 T5 持续 30 / 40 年口径（新增 `accumulation_sustained_horizon_30_vs_40`）

- 输入：currentAssets 1,000,000、income 5,000、expense 5,000、target 500,000、r 5±1e-9%、i 0±1e-9%、years 1、paths 20、seed 3；sustainYears 分别 30 / 40。
- 期望：fiProbability = 1.0（t=0 达标：1,000,000 ≥ 500,000）；**sustainedProbability(30) = 1.0；(40) = 0.0**。
- 独立推导：支取自 A₀ = 1,000,000、年支 60,000、r = 5%，闭式 A_k = 1,200,000 − 200,000×1.05^k；A₃₆ = +41,636.77 > 0、A₃₇ = −16,281.39 ≤ 0 → 第 37 个支取年耗尽（node 复算与闭式一致；30 年末终值 335,611.52）。
- 受影响测试：新增 `accumulation_sustained_horizon_30_vs_40`。

### 3.6 T6 改名后语义断言（新增 `mc_fixed_semantics_after_rename` + 单元测试扩展）

- 输入：run_monte_carlo：assets 1,000,000、annualSpend 50,000、r 5±1e-9%、i 2±1e-9%、years 2、paths 1、seed 11；strategy 分别缺省 / `"fixed"` / `"inflation_uplift"`。
- 期望：三次调用输出**逐字节一致**；samplePaths[0] = [999,000.00, 996,930.00]；sampleWithdrawalPaths[0] = [51,000.00, 52,020.00]。
- 独立推导：spend₁ = 50,000×1.02 = 51,000；A₁ = 1,050,000 − 51,000 = 999,000；spend₂ = 52,020；A₂ = 999,000×1.05 − 52,020 = 996,930。**反面锁定**：若语义是「固定名义」（spend 恒 50,000）则 A₁ = 1,000,000 ≠ 999,000——首年值即排除该误读（audit 原反例 A₂ = 998,950 系「首年已上调、次年冻结」的混合口径，登记为推导修正；结论同为 ≠ 断言值）。
- 受影响测试：新增 `mc_fixed_semantics_after_rename`；withdrawal.rs 单元测试 `strategy_resolution_and_validation`（:478-529）扩展 `resolve("inflation_uplift") → Strategy::Fixed` 与 `resolve("fixed") → Strategy::Fixed` 等价断言。

### 3.7 T7 费雪精确口径数值（扩展 `baseline_known_values_480_rule`，:73-86）

- 输入：calculate_baseline：2,990 / 0 孩 / 健康 20 万 / 重大投入 0 / 4.5−2.0。
- 期望：realReturnPct 2.5、multiplier 480、criticalValue 1,635,200（存量锚点不变）；**multiplierExact = 489.6**；**criticalValueExact = 1,663,904.00**。
- 独立推导：精确实际回报率 = (1.045/1.02) − 1 = 2.450980392…% ≈ 2.451%；multiplierExact = 12×1.02/0.025 = 489.6（精确）；2,990×489.6 = 1,463,904 + 200,000 = 1,663,904.00（比 480 口径高 28,704.00——通胀 > 0 时教学口径系统性低估所需本金）。
- 受影响测试：`baseline_known_values_480_rule` 扩展；`baseline_error_when_real_return_not_positive`（:101）增两新字段 = 0 断言；`pension_known_values_default_caliber` 回归（pension 乘数恒 480，不带精确口径——pension 不在本轮加精确字段）。

### 3.8 T8 存量回归（断言零变化 + 一条新增不变量）

- 期望：现有全部输入原样 → 现有全部断言保持。`mc_threshold_directional`（:1227）、`mc_percent_never_depletes`（:1282）、`mc_withdrawal_output_shape`（:1320）、`mc_bootstrap_strategy_shared`（:1381）、sequence / required_saving 各锚点、缺省 fixed 与 P1 逐字节锚（668,802.18；bootstrap 单元素同值 :1076-1091）全部不变。依据：P0-1 / P0-2 / E 为纯增量字段，P0-3 为纯别名（数值路径零改动）。**基线已实测：起草会话 `cargo test` 68 全绿**。
- 新增不变量：**`accumulation_sustained_invariant_same_seed`**——同输入同 seed，`sustainYears > 0` 时既有输出字段与 `sustainYears = 0` 逐字节一致（fiProbability / 年限分位 / 期末分位 / samplePaths / neverReachedShare，§2.2 派生流裁定 (c) 的锁定测试；派生流拓扑下 pass1 与 N 解耦、应无条件通过）。**输入必须真实量级 σ（修订轮二 R1 维持上版裁定）**：currentAssets 500,000、income 8,000、expense 2,990、target 1,635,200、r 4.5±12%、i 2±1%、years 40、paths 200、seed 42，分别以 sustainYears = 0 与 10 各跑一次——除 `sustainedProbability` 外全部字段逐字节相等。可侦测性：若实施为交错拓扑（支取样本插入两路径之间），路径 ≥1 的积累样本整体后移、r 4.5±12 下统计必然漂移，本测试即失败（σ = 1e-9 退化输入下交错拓扑平凡通过，禁用）；同流两遍拓扑在 (c) 下与派生流不可区分（§2.2 登记），拓扑字面由 bridge.ts §g 注释钉死；(b) 项（sustainYears = 0 == P7 前现状）由保留的 accumulation 回归套件锁定。
- 受影响测试：上述全部 + `monte_carlo_is_deterministic_for_same_seed` / `accumulation_same_seed_is_deterministic` 保留。

### 3.9 T9 share v4 往返 + v3 失效（新增 `scripts/check-share.mjs`，零新依赖）

- 输入：encodeShareState（含 pension.targetRetireAge 55、accumulation.sustainYears 30、monteCarlo.strategy 三 UI 枚举值 "fixed" / "threshold" / "percent"）。
- 期望：decode(encode(x)) 对三 UI 枚举值输入——**解码产物 strategy ∈ 合法 UI 枚举 + 其余数值字段与 x 深相等**（修订轮二 R4 断言口径：往返锁定「合法枚举 + 数值深相等」，而非无差别全对象深相等）；载荷缺任一新键（targetRetireAge / sustainYears）→ null（禁止部分恢复）；同内容 `v: 3` 历史载荷 → null（版本闸，share.ts:121）；**`strategy: "inflation_uplift"` 的载荷 decode 成功且 `state.strategy === "fixed"`、`strategyNormalizedFromLegacy === true`（解码端映射裁定，非 null、非原样保留）**——编码端 store 永不产出该值，映射不影响合法往返；一次性提示标志随 DecodeResult 返回（§2.4）。
- 独立推导：SHARE_LINK_VERSION 4 → `obj["v"] !== 4` 即拒；numSlice 缺键即 null（share.ts:91-99）；规范化是纯输入变换（"inflation_uplift" → "fixed"），三 UI 枚举值往返不受影响。
- **实现方式（不引入新依赖）**：沿用 `scripts/check-currency.mjs` 先例——esbuild（随 vite 在依赖树内，非新依赖）把 share.ts 转译进临时目录后以 `node:assert` 断言；package.json 增 `check:share` script。**现状无前端测试装置（已核实：package.json 无 test 脚本、无 *.test.* 文件）——本算例必须新增脚本**；同脚本内附三语 i18n 键集一致性断言（§7 断言⑧）。
- 受影响测试：新增脚本；p1-spec §6.4 往返验收更新为 v4 口径。

### 3.10 T10 t=0 达标 + 30 年存续（新增 `accumulation_sustained_survive_realistic`）

- 输入：currentAssets 2,000,000、income 8,000、expense 2,990、target 1,635,200、r 4.5±1e-9%、i 2±1e-9%、years 5、paths 20、seed 5、sustainYears 30。
- 期望：fiProbability = 1.0、yearsMedian 0（integration.rs:858-870 `accumulation_reaches_at_year_zero` 同型先例）；**sustainedProbability = 1.0**。
- 独立推导：t=0 达标；首年支取率 = 36,597.60 / 2,000,000 = 1.83% 名义 ≪ 4.5% 名义回报（spend₁ = 35,880×1.02 = 36,597.60 < 年度回报 90,000）→ 资产单调增长；node 复算 30 年末 ≈ 4,659,509.54、全程最低 2,053,402.40 > 0。
- 受影响测试：新增 `accumulation_sustained_survive_realistic`。

### 3.11 旧期望（旧语义）→ 新期望（新语义）登记表

| 测试 | 旧期望（旧语义） | 新期望（新语义） | 变化性质 |
|---|---|---|---|
| `pension_error_when_real_return_not_positive` | error 文案 + multiplier/pensionMonthly/adjustedCriticalValue = 0 | 同左**全部保留** + bridgeYears 30、bridgeFundingNeeded 0 新增断言 | 纯增量（语义有意变更：时间口径落地） |
| `pension_known_values_default_caliber` | P-A 九锚点（2,482.32 / 359.71 / 2,842.03 / 0.95 / 147.97 / 271,025.60 / 480 / 30） | 九锚点**逐字节不变** + 缺省 targetRetireAge → bridgeYears 0 / bridgeFundingNeeded 0 新增断言 | 纯增量（缺省 = 现状口径） |
| `baseline_known_values_480_rule` | realReturnPct 2.5 / multiplier 480 / criticalValue 1,635,200 | 三锚点**逐字节不变** + multiplierExact 489.6 / criticalValueExact 1,663,904.00 新增断言 | 纯增量（并行双口径，480 仍为主输出） |
| `strategy_resolution_and_validation` | resolve("fixed") → Fixed；枚举外报错 | 同左**全部保留** + resolve("inflation_uplift") → Fixed 新增；错误文案改含 inflation_uplift | 别名扩展（文案更新为语义有意变更） |
| share 解码 | v3 载荷往返有效（无测试装置，无既有断言） | 仅 v4 有效；v3 载荷 → null；pension/accumulation 切片各 +1 必填键 | 版本闸升级（延续 v2→v3 一次性失效先例 share.ts:31-36） |
| 其余 48 项集成 + 14 项单元 | 现值 | **零变化** | 数值路径零改动（53 集成 − 5 更新 = 48；15 单元 − 1 更新 = 14——修订轮 P2-6 勾稽校正，逐项归属见 §3.12） |

### 3.12 保留 / 更新 / 新增清单（53 集成 + 15 单元逐项归属，修订轮 P2-6 按实测全名单重列）

- [ ] **更新 5 项集成**（扩展断言、既有断言值零变化）：`baseline_known_values_480_rule`（:73，+2 精确字段）、`baseline_error_when_real_return_not_positive`（:101，+2 新字段 = 0 断言）、`pension_known_values_default_caliber`（:939，+bridge 缺省断言）、`pension_error_when_real_return_not_positive`（:1000，+bridgeYears/bridgeFundingNeeded）、`pension_validation_errors`（:1013，+targetRetireAge 越界分支）。
- [ ] **更新 1 项单元**（withdrawal.rs:478-529）：`strategy_resolution_and_validation` + resolve("inflation_uplift") → Fixed 等价断言。（策略错误文案 withdrawal.rs:149 变更已核实无测试断言，不触发其他更新。）
- [ ] **保留 48 项集成**（断言零改动，逐项）：baseline 2（`baseline_fractional_multiplier_rounds_and_feeds_critical_value` :88、`baseline_validation_and_parse_errors` :123）；amortize 4（:149/:208/:229/:270）；rental 3（:303/:342/:364）；reverse 2（:384/:410）；monte_carlo 5（`monte_carlo_is_deterministic_for_same_seed` :471、`monte_carlo_direction_high_return_low_vol_beats_low_return_high_vol` :493、`monte_carlo_nominal_recurrence_known_value` :528、`monte_carlo_no_spend_never_depletes_and_sample_covers_first_last` :553、`monte_carlo_validation_errors` :579）；tax 5（:607/:629/:646/:677/:693）；约定 1（`all_outputs_carry_error_field_convention` :732——已核实仅断言 error 字段存在性/空值，不枚举输出键，新增字段不破坏）；accumulation 7（`accumulation_same_seed_is_deterministic` :762、`accumulation_zero_volatility_closed_form_known_value` :785、`accumulation_negative_saving_never_reaches` :833、`accumulation_reaches_at_year_zero` :858、`accumulation_target_inflates_with_inflation` :873、`accumulation_negative_real_growth_never_reaches_inflating_target` :889、`accumulation_validation_errors` :903）；pension 2（`pension_adjusted_critical_matches_baseline` :958、`pension_coverage_above_one_not_capped` :985）；bootstrap 5（:1055/:1076/:1094/:1112/:1119）；mc 策略 6（`mc_strategy_absent_is_byte_compatible` :1159、`mc_fixed_strategy_params_ignored` :1210、`mc_threshold_directional` :1227、`mc_percent_never_depletes` :1282、`mc_withdrawal_output_shape` :1320、`mc_bootstrap_strategy_shared` :1381）；sequence 4（:1475/:1503/:1617/:1649）；required_saving 2（:1674/:1709）——合计 2+4+3+2+5+5+1+7+2+5+6+4+2 = 48 ✓。
- [ ] **保留 14 项单元**：common.rs 2（`round2_uses_half_up_away_from_zero`、`u32_int_accepts_fractional_zero_scale`）、reverse.rs 2（`required_saving_q_equals_one_branch_exact`、`required_saving_forward_identity_holds`）、sequence.rs 3（`sequence_withdrawal_hand_example`、`sequence_accumulation_hand_example`、`sequence_validation`）、withdrawal.rs 7（`threshold_band_boundaries`、`threshold_nocut_boundary`、`threshold_freeze_rule`、`threshold_inflation_attached_to_cut_and_raise`、`percent_pmt_closed_form`、`percent_real_nominal_consistency`、`percent_floor_cap_clamp`）。
- [ ] **新增 8 项**（Rust 集成 7 + 脚本 1）：`pension_bridge_period_fields`（T1/T2）、`accumulation_sustained_fail_overdraw`（T4，修订轮改名）、`accumulation_sustained_at_most_fi`（T4-b，修订轮增）、`accumulation_sustained_horizon_30_vs_40`（T5）、`accumulation_sustained_invariant_same_seed`（T8，真实量级 σ 输入）、`accumulation_sustained_survive_realistic`（T10）、`mc_fixed_semantics_after_rename`（T6）、`scripts/check-share.mjs`（T9）。收口预期：集成 48 + 5 + 7 = 60 项、单元 15 项，全绿。

---

## §4 前端适配（逐文件「现状 → 目标」；落点行号为起草会话实测）

### 4.1 契约与数据层

- [ ] **`src/wasm/bridge.ts`**：§2 全部类型与语义注释——PensionInput/Output（§i）、AccumulationInput/Output（§g：判定语义 + 随机流裁定三条）、BaselineOutput（§a）、WithdrawalStrategy（§e :259）。
- [ ] **`src/services/finance.ts`**：parseBaseline（:154-165，+2 字段）、parseAccumulation（:317-344，+sustainedProbability）、parsePension（:353-368，+2 字段）逐字段轻量校验同步。
- [ ] **`src/data/defaults.ts`**：`PENSION_DEFAULTS`（:164-172）+ `targetRetireAge: 60`（默认 = retireAge → 默认视图 bridgeYears = 0，README.md:41/86 锚点不漂移）；`ACCUMULATION_DEFAULTS`（:176-188）+ `sustainYears: 0`（默认关，零默认行为变化）；`LIMITS` 增 `targetRetireAge { min: 16, max: 75 }`、`sustainYears { min: 0, max: 200 }`；`FX_RATE_SNAPSHOT`（:200-208）占位 → 真实快照（§8.3）。
- [ ] **`src/data/pensionParams.ts`**：PensionInputs 接口（:43-58）+ `targetRetireAge` 注释（与 retireAge 语义区分：金额驱动 vs 时间口径）+ §2.5 政策参数注释。
- [ ] **`src/store/useCalculatorStore.ts`**：`buildShareState`（:289-311）`...s.pensionInputs` 自动携带新字段，零逻辑改动（核对测试）；`setPensionInputs` / `setAccumulationInputs` 泛型 patch（:97/:129）无需改本体。

### 4.2 PensionPanel（桥接展示）

- [ ] 新增「想停止工作的年龄」`IntField`（16–75，LIMITS.targetRetireAge），置于「退休年龄」字段之后（PensionPanel.tsx:83-91 邻位）。
- [ ] 结果区新增桥接块（`bridgeYears > 0` 时渲染；缺省视图 = bridgeYears 0 → 零新增行，面板形状与 README 锚点截图一致）：`Descriptions` 一块两行——桥接期年数、桥接期需备资金（金额走 `money()` 币种换算）；块尾 `bridgeNote` 口径注一句，含 §2.1 单次计入口径句「一次性预留（健康/子女/重大投入）已计入『领取后』参考线，不在桥接段重复计入；两段相加即真实总需」（修订轮二 R5）与保守口径句（乘数口径对桥接段偏保守）。
- [ ] 调整后参考线块标题（`pension.adjustedTitle`，:201）改写为「养老金领取后·调整后参考线」口径（in-place 改值，不加键）。
- [ ] 计发月数联动（:49-53、:58-62）与 S18 可见性闸（:24-25、:67）不动。

### 4.3 AccumulationPanel（双指标卡）、MonteCarloPanel（正名）、BasicCalculator（费雪双口径展示）与 ReversePanel（永续警示）

- [ ] AccumulationPanel：`sustainYears` IntField（0 = 关闭，hint 一句）+ `sustainedProbability` 与 `fiProbability` 并列展示（:506-517 `.wf-acc-progress` 邻位， sustained 卡仅 `sustainYears > 0` 时渲染）；`submittedTarget` 快照机制（:95-99、:146-157）不动；两处 `calcAccumulation` 调用（:151、:164）经 `...inputs` 自动携带 sustainYears，零调用点改动。
- [ ] MonteCarloPanel：策略 Radio 标签文案随 i18n（:445，value 不动）；策略注（:911-914 `mc.strategyNoteShort` + FieldTip `strategyNote1/2`）补正名句「缺省与 fixed 均按通胀上调（等价固定实际支出）；历史名『固定名义』已弃用」——**该两句三语值含「固定名义 / Fixed nominal」历史名提及，属 §7 断言④白名单登记项**（i18n `mc.strategyNoteShort` / `mc.strategyNote1` 两键）；策略注区另渲染 share/情景恢复的一次性提示「旧链接的通胀上调口径已并入固定实际支出」（`share.strategyLegacyNotice`，仅解码规范化标志在位时出现，关闭或切换策略即清除——修订轮二 R4）。
- [ ] **BasicCalculator.tsx（费雪双口径展示——修订轮 P1-3 增补；baseline 输出的唯一消费面板，修订轮二 R3 复测消费点：主输出卡乘数/参考线 :883/:888/:900/:905、顶层绑定 :632/:663、敏感性 :700/:712、a11y 播报 :763-764，均读 `data.multiplier` / `data.criticalValue`）**：输出卡明细区（S16 承载区）新增并列两行——「精确乘数（费雪口径）」（`multiplierExact`，倍率）与「精确口径参考线」（`criticalValueExact`，金额经 `money()` 币种换算）；fisherNote 口径注一行（≤2 行，反冗长）：「实际回报率按精确费雪式 (1+r_nom)/(1+π)−1 计算；近似式 r≈r_nom−π 仅供教学对照，两者差 ≈ π×实际回报率」；**无口径切换控件**（research §4.2）；480 主口径读数窗、S14 段位徽标（:845-856，上版误列为 data.* 读点，实为徽标展示区——保留登记）、敏感性小节（:696 逐档 calcBaseline，:700 只读 criticalValue）零改动（敏感性复用同一 parseBaseline，新字段自动通过解析、展示不消费）；调用点增量仍为 0（§5.5）。
- [ ] **改名裁定（§0 范围 C）**：界面标签 = 「固定实际支出（默认）」/「固定實際支出（預設）」/"Fixed real spending (default)"（i18n `mc.strategyFixed` in-place 改值）；代码枚举正名 = `inflation_uplift`（§2.4）。此为对 audit §3.4 UI 文案建议（「通胀上调（默认）」）的替代——两个候选语义等价，取更贴用户语言的「固定实际支出」；枚举名仍从 audit（inflation_uplift）。
- [ ] ReversePanel（永续警示）：`reverse.note`（zh-CN.ts「reverse」组）追加警示句 + Morningstar 参照（模板句见 §8.2；in-place 改值，警示 ≤2 行、全文归 tooltip——反冗长原则）；「资产永不耗尽」表述（leverageTooltip / note）补「在模型假设内成立；实际序列风险可破坏该结论」限定。

### 4.4 share.ts v4 与隐私提示

- [ ] `SHARE_LINK_VERSION` 3 → 4（share.ts:37）；版本注释（:31-36）追加「v4：pension 切片新增 targetRetireAge、accumulation 切片新增 sustainYears（P0-1/P0-2 修复）；v3 及更早链接与情景库存档一次性失效，需重新生成/重存——延续 v1→v2、v2→v3 既有决策」。
- [ ] pension 键清单（:215-218）+= `"targetRetireAge"`；accumulation 键清单（:210-213）+= `"sustainYears"`（均必填有限数，缺键 → 整体 null）；strategy 枚举闸（:146-150）**解码端把 `"inflation_uplift"` 规范化为 `"fixed"`**（§2.4 / §3.9 T9；编码端 store 永不产出该值）；`decodeShareState` 返回类型扩展 `DecodeResult { state; strategyNormalizedFromLegacy } | null`（签名变更登记——share 链接恢复与情景库恢复两处调用点同步、数量零新增），store 恢复处理器读标志置瞬态 `strategyLegacyNotice`（不入 share 载荷、不入情景存档、resetEpoch 语义不变）。
- [ ] encodeShareState（:102-105）随 store 类型扩展自动携带，无编码逻辑改动（§4.1 核对）。
- [ ] `share.copyTooltip`（zh-CN.ts:651，三语）追加「链接内容为可逆编码（编码 ≠ 加密），任何拿到链接的人可读出全部业务输入——请勿在链接中携带不愿公开的数字」。
- [ ] scenarios.ts:3-4 存档载荷同走版本闸——v4 上线后存量情景一次性失效，面板提示文案复用 `share.restoreIgnored`；同走枚举闸与规范化信号（R4 一次性提示对情景恢复同样生效）。

### 4.5 i18n 键增量预估（三语；键集三文件必须一致）

| 组 | 新键 | 预估简体值 | 改写键（in-place） |
|---|---|---|---|
| pension | `targetRetireAge` / `targetRetireAgeTooltip` / `bridgeTitle` / `bridgeNote` | 「想停止工作的年龄」；含 §2.5 政策句全文；「停工 → 起领桥接段」；480 乘数保守口径一句 | `retireAgeDelayNote`（§2.5 改写）、`adjustedTitle`（加「领取后」） |
| accumulation | `sustainYears` / `sustainYearsTooltip` / `sustainedLabel` / `sustainedHint` | 「存续验证年数」；0=关闭 + 口径；「持续成功概率」；判定一句 | — |
| basic | `multiplierExactLabel` / `criticalExactLabel` / `fisherNote` | 「精确乘数（费雪口径）」「精确口径参考线」；research §4.2 模板句（**落点 = BasicCalculator 输出卡明细区，§4.3**） | — |
| reverse | `perpetuityWarning` | §8.2 模板句压缩 | `note` / `leverageTooltip`（加限定） |
| share | `strategyLegacyNotice`（R4 一次性提示） | 「旧链接的通胀上调口径已并入固定实际支出」 | `copyTooltip`（加编码≠加密句） |
| mc | — | — | `strategyFixed`（正名）、`strategyNoteShort` / `strategyNote1`（补正名句，含历史名提及——断言④白名单） |
| **合计** | **新增 13 键 × 3 语（修订轮二 R4 +1）** | ≈ 720 B（zh-CN）+ ≈ 760 B（zh-Hant）+ ≈ 1,050 B（en）≈ **2.5 KB** | **改写 8 键**（retireAgeDelayNote / adjustedTitle / reverse.note / leverageTooltip / copyTooltip / strategyFixed / strategyNoteShort / strategyNote1；净增 ≈ **+0.8 ~ +1.4 KB**，按上限计——修订轮 P2-7 校正 8 键） |

---

## §5 回归红线（违反即返工）

1. **S1–S26 不回退**（design-language.md §2 锚点）：P7 只增字段与文案，不改任何签名元素实现。抽查基线（§7 断言⑦引用 design-language §2.1 落点）：S2 全站唯一庆祝（BasicCalculator.tsx:339-362 + global.css:1262-1269）、S16 因果闪亮（hooks.ts:302）、S18 六处渐近滚动 + 可见性闸（hooks.ts:205、PensionPanel.tsx:67 等）、S22 主题揭示（App.tsx:45）、S24 错误左标线（global.css:1421）、S25 图表读数（AccumulationPanel.tsx:237 等）、S6 空态四处（MonteCarloPanel.tsx:676/:917、AccumulationPanel.tsx:614、ScenarioPanel.tsx:287）。
2. **方案 B 导航保活**：高级区跨组切换不卸载面板（src/components/AdvancedPanel.tsx:145-153 常驻 + `hidden={g.id !== groupId}`，本会话实测行号；p6-spec 所记 :127-135 已漂移，以本行号为准），蒙特卡洛运行结果与表单输入跨组保留——新增字段与展示块不得引入挂载行为变化（Atlas IA 升级不在本轮，§0.2）。
3. **分享回落 resetEpoch**：损坏 / 版本不符链接 → 静默回落默认 + `resetEpoch` 递增（useCalculatorStore.ts:196-199、:221、:323；BasicCalculator.tsx:373-380 刻度档位与达成闩锁清位）——v4 行为与 v3 同构，S2 闩锁清位链路不得受新字段影响。
4. **币种换算**：新金额字段（bridgeFundingNeeded / criticalValueExact）全部经 `useMoney` / `convert` 展示（先例 PensionPanel.tsx:35-36、AccumulationPanel.tsx:195）；rate null = 符号-only 语义不破坏。
5. **useFinanceCall 调用点登记**（起草会话实测枚举）：hook 调用 8 处（BasicCalculator.tsx:561、TaxPanel.tsx:107、PensionPanel.tsx:58、LoanPanel.tsx:40、RentalPanel.tsx:255、ReversePanel.tsx:55、AccumulationPanel.tsx:84/:128）+ 直接调用 11 处（AccumulationPanel.tsx:130 与 :151/:164、BasicCalculator.tsx:696、ScenarioPanel.tsx:72-76 五处、MonteCarloPanel.tsx:176 与 :231/:235）。**P7 增量 = 0**：新字段全部经既有调用随输入/输出自动流动。若实施新增任何调用点，属有意变更，须在此登记并给理由。
6. **threshold / percent 语义零变化**：withdrawal.rs:161-188 / :227-264 逐行不动；T8 锚点全绿（668,802.18 等）。
7. **可复现性铁律**（bridge.ts:404-406）：同 seed 同输入逐字节一致；`sustainYears` 三不变（§2.2）。
8. **禁词零命中**：`apple|bytedance|tencent|cupertino|毛玻璃|液态玻璃|玻璃|阻尼|弹簧|spring|damp|glass|liquid` 在新增/改动文件零命中（起草会话对本文档已扫描：除本条与附 A-6 的模式字面量自身外零命中，附 A-6）。

---

## §6 尺寸预算（原始字节；门禁数值不放宽——P5 既定裁定）

### 6.1 现状实测（起草会话 `node scripts/check-size.mjs` 实跑）

| 项 | 实测 | 门禁 | 余量 |
|---|---|---|---|
| wasm 单文件 | **372,534 B**（`WASM_MAX_KB=364`） | 800,000 B | **427,466 B，充足** |
| dist 全部文件总和 | **1,999,865 B**（`DIST_TOTAL_KB=1953`） | 2,000,000 B | **135 B，几乎为零** |

> 与任务书所给「现 1,946KB」不符——本会话实测 1,999,865 B（= 1,953 KB 向上取整口径），即 P6 收口记录值（design-language.md §2.1 P6 收口核验「1,999,865 B（余量 135 B）」）。**以实测为准：dist 余量仅 135 B，本轮任何增量都必须先落实等量回收。**

### 6.2 增量估算（§4 改动面推导）

| 来源 | 估算（原始字节） | 说明 |
|---|---|---|
| wasm（§2 新字段与支取阶段） | +1.5 KB ~ +4 KB | 三个函数各增一段纯计算逻辑；wasm 门禁余量 427 KB，单项不构成风险 |
| i18n 三语（§4.5） | +3.3 KB ~ +3.9 KB | 新键 13 × 3 ≈ 2.5 KB（修订轮二 R4 增 `strategyLegacyNotice`）+ 改写 8 键净增 0.8~1.4 KB（R7 校正 8 键） |
| 面板 JSX / 逻辑（§4.2–4.3，压缩后） | +2.5 KB ~ +4 KB | PensionPanel 桥接块 + AccumulationPanel 双指标卡 + **BasicCalculator 费雪两行与口径注（修订轮 P1-3 增补）** + ReversePanel 警示 + MonteCarloPanel 注与一次性提示（R4） |
| share/finance/store/defaults（§4.1、§4.4） | +0.5 KB ~ +1 KB | 解析字段、版本注释、快照真值、DecodeResult 标志（R4） |
| **合计** | **+7.8 KB ~ +12.9 KB（按上限 +13 KB 计盘）** | 算术闭合：1.5+3.3+2.5+0.5 = 7.8、4+3.9+4+1 = 12.9（修订轮二 R4/R7 重算）——超出 135 B 余量，回收目标按上限 +13 KB 执行（§6.3） |

### 6.3 回收强制令（实施顺序前置）

- [ ] **实施第一步（写码前）执行回收盘点**，产出实测数字登记到本节：(a) 复跑组件库样式 purge dry-run（P5 先例 plugins/，首轮实收 73,380 B，第二轮预期收益递减——以实测为准）；(b) 排查 dist 资产清单（icons/sw/manifest/index.html）可压缩项；(c) i18n 键合并复审——按下表硬上限执行。
- [ ] **i18n 硬上限**：新增键 ≤ 13（修订轮二 R4 增 `share.strategyLegacyNotice`；§4.5 表为上限而非目标；`bridgeNote` / `sustainYearsTooltip` / `fisherNote` / `perpetuityWarning` 四个口径注优先尝试并入既有 tooltip / note 键值——P5.1「来源行并入字段提示」同款手段），能并尽并。
- [ ] **回收不足时的处置顺序**：i18n 并合 → CSS purge 二次实测 → 资产压缩 → 仍不足则按 P6 降档预案**裁展示项**（候选序：费雪口径仅保留 tooltip 不占独立行 → 桥接块并入调整后 Descriptions → 警示句并入既有 note），**门禁数值与 wasm 门禁不放宽、不特批**（P4 特批先例已归档，不再开）。
- [ ] 收口硬门禁：`npm run build && npm run check:size` exit 0；`WASM_MAX_KB ≤ 364 + 5`（≈ +5 KB 缓冲，超即触发回收顺序）。

---

## §7 验收条件（可操作断言；全过才收口）

- [ ] **① 桥接时间口径**：同 T1 输入只改 `targetRetireAge` 30 → 60：`bridgeYears` 30 → 0、`bridgeFundingNeeded` 1,435,200.00 → 0，且 basic/account/pensionMonthly/coverageRatio/adjustedMonthlyExpense/adjustedCriticalValue 六字段**逐字节不变**（养老金金额与停工年龄解耦）。自动断言 = T1/T2；手工复核 = 面板改字段观察。
- [ ] **② 27.1 万误导消除**：30 岁停工 / 60 起领默认案例下，面板必须明确呈现桥接期资金需求 1,435,200（`bridgeYears > 0` 即渲染桥接块）；README.md:86 案例注补桥接口径句（§8.1）。断言 = T1 + 手工走查面板 ⑦（填 targetRetireAge 30）截图核对两段口径同行可见，且 `bridgeNote` 口径注在位、含「一次性预留已计入『领取后』参考线、两段相加即真实总需」句（§2.1 单次计入裁定，修订轮二 R5）。
- [ ] **③ 达标后暴跌不计持续成功**：T4 自动断言——fiProbability 1.0 且 sustainedProbability 0.0（§3.4 推导）；T4-b 关系断言（真 σ：sustained ≤ fi）与 T8 非退化不变量（sustainYears > 0 既有字段与 =0 逐字节一致）同绿。
- [ ] **④ 改名零残留（修订轮二 R2：按实测 grep 重建全量清单，逐处处置）**：`grep -rn "固定名义\|固定名義\|Fixed nominal\|fixed nominal" src/ README.md README.en.md` 现状命中 13 处（本会话实跑，附 A-10(a)）+ 实施后新增 1 类，逐处处置表：

  | 命中 | 现状内容 | 处置 | 收口后状态 |
  |---|---|---|---|
  | `src/i18n/locales/zh-CN.ts:449` | `strategyFixed: "固定名义"` | 改写（§4.3 正名三语） | 零命中 |
  | `src/i18n/locales/zh-Hant.ts:409` | `"strategyFixed": "固定名義"` | 改写（同上） | 零命中 |
  | `src/i18n/locales/en.ts:512` | `strategyFixed: "Fixed nominal"` | 改写（同上） | 零命中 |
  | `src/wasm/src/withdrawal.rs:50` | `/// 固定名义（缺省口径…）` | 改写（§2.4 避字措辞「非名义恒定支出」，不进白名单） | 零命中 |
  | `README.md:43` | 功能段「支取策略可选固定名义 / …」 | 改写（§8.1 改名锚点） | 零命中 |
  | `README.md:175` | 功能表行「固定名义（随通胀上行，默认）」 | 改写（§8.1 改名锚点） | 零命中 |
  | `README.en.md:43` | "withdrawal strategy: fixed nominal / …" | 改写（§8.1 en 锚点） | 零命中 |
  | `README.en.md:170` | "fixed nominal (inflation-adjusted, default)" | 改写（§8.1 en 锚点） | 零命中 |
  | `src/wasm/bridge.ts:640` | sequence 口径年支出注释「固定名义」 | **白名单 (a)** 真语义保留（sequence 对照模拟通胀置 0，确为固定名义年度口径） | 白名单 |
  | `src/wasm/bridge.ts:644` | sequence 口径年储蓄注释「固定名义」 | **白名单 (a)** 同上 | 白名单 |
  | `src/wasm/src/sequence.rs:37` | `/// 年支出（元，固定名义…）` | **白名单 (a)** 真语义保留 | 白名单 |
  | `src/wasm/src/sequence.rs:40` | `/// 年储蓄（元，固定名义…）` | **白名单 (a)** 真语义保留 | 白名单 |
  | `src/wasm/tests/integration.rs:1477` | `// 统一口径：…年末固定名义支取 = assets × rate` | **白名单 (a)** 真语义保留（sequence 对照注释） | 白名单 |
  | i18n `mc.strategyNoteShort` / `mc.strategyNote1`（三语） | §4.3 改写后含「历史名『固定名义』已弃用」句 | **白名单 (b)** 历史名提及有意保留——**登记评审偏差：现状 grep 未命中**（当前值无该字样，本会话实测），命中发生在 §4.3 改写后、属有意新增 | 白名单（改写后） |

  白名单之外收口后零命中；grep 范围限 src/ + 两 README（docs/p2-spec 等历史文档不在范围）；**README 四行与 withdrawal.rs:50、i18n strategyFixed 三语是改写目标、不是白名单**。i18n `mc.strategyFixed` 三语 = 新标签「固定实际支出（默认）」。
- [ ] **⑤ 永续警示与参照在位**：ReversePanel 渲染警示句（含「Morningstar 2026：30 年期、90% 成功率、股 30–50% 组合起始安全支取率 3.9%……基于美国市场假设，不构成保证值」模板句）；三语键在位；「资产永不耗尽」表述带假设限定。
- [ ] **⑥ 费雪双口径数值正确**：T7 自动断言（480 口径锚点不变 + multiplierExact 489.6 / criticalValueExact 1,663,904.00）；**BasicCalculator 输出卡**并列两行展示（§4.3，修订轮 P1-3 补落点）且**无口径切换控件**（research §4.2：并行展示）；近似式仅出现在口径注。
- [ ] **⑦ S1–S26 抽查**：按 p6-spec §9 同法抽查 8 条——S2 唯一庆祝（100% 单次脉冲）、S16 因果闪亮、S18 可见性闸（隐藏面板暂停 rAF）、S22 主题揭示、S24 错误左标线、S25 图表 hover、S6 空态（含蒙特卡洛两态）、R1 方案 B 保活（红线 2）——全部与 design-language §2.1 落点一致，无回退。
- [ ] **⑧ 三语零裸键**：三 locale 文件键集一致（`check-share.mjs` 内附断言）；界面无 `pension.targetRetireAge` 式裸键渲染；i18n 新增键的 zh-Hant / en 值非机翻占位（人工走查三语各一遍）。
- [ ] **⑨ 全量测试**：`cargo test` 全绿（收口预期 60 集成 + 15 单元，§3.12）；`npm run build` + `npm run check:size` exit 0（§6.3）；`npm run check:share` exit 0。

---

## §8 文档修正清单（README 双语 + 数据快照）

- [x] **8.1 README.md / README.en.md 演示数字按新语义重算**：:86 面板 ⑦ 案例注补桥接口径句——「27.10 万为养老金**领取后**（段 2）口径（含一次性预留 20 万）；30–60 岁桥接段（停工 → 起领）另需按生活费口径备资 **143.5 万**（2,990×480 = 1,435,200，面板填『想停止工作的年龄 30』即见）；一次性预留已计入『领取后』参考线、不在桥接段重复计入，**两段相加 170.6 万 = 真实总需**（§2.1 修订轮二 R5 单次计入裁定）」；:41 163.5 万主锚不变（baseline 面板口径 = 生活费 + 附加项，与本裁定不冲突；可并列「精确口径 489.6 → 166.4 万」注，随 §6 预算裁定）；**改名锚点 = zh :43（功能段）与 :175（功能表行）**「固定名义」→「固定实际支出」（修订轮 P1-2 纠正——起草版误记 :121，实测 README.md:121 为 MC 标注截图图注、无策略名字样，修订轮二 R2 复测确认）；en 对应行 :43 / :170 同步（en :96 无策略名）。**另登记两语既有不一致**：README.md:96 验证概率 49.8% vs README.en.md:96 49.2%——实施会话重跑取实测值、两语对齐（起草会话无法运行前端复算，如实登记为待复核项）。
- [x] **8.2 永续表述警示**：**README.md:126（修订轮 P1-2 纠正——起草版误记 :93，实测 :93 为面板 ⑧ 表头行）**反向估算案例「每月可放心花费 ¥2,541.67（永续提取口径，面板内注明；另给回报杠杆年限 4.8 年）」（README.en.md:126 "perpetual-withdrawal basis" 同行）与面板内 note 追加警示：「永续口径在模型假设内成立（实际回报恒正、支出随模型上行）；真实序列风险可破坏该结论——参照 Morningstar 2026 年度研究：30 年期、90% 成功率、股票权重 30%–50% 组合的起始安全支取率为 3.9%（固定实际支取基线，排除养老金等外部收入；历年数值随市场假设在 3.3%–4.0% 间浮动）。该数值基于美国市场假设，不构成任何环境下的保证值」（research-retirement-models §2.3 模板句）；en 同步。
- [x] **8.3 离线快照核实（来源与日期入注释）**：`FX_RATE_SNAPSHOT` 占位（defaults.ts:200-208，`source: "pending"`）→ 填真实快照。起草会话已实拉核验（2026-11-21，`curl https://open.er-api.com/v6/latest/CNY`，接口 `time_last_update_utc: "Fri, 20 Nov 2026 00:02:32 +0000"`）：USD 0.149433 / EUR 0.136198 / GBP 0.113982 / JPY 23.877343 / HKD 1.172212 / CNY 1——实施会话以实施当日重拉值为准、把来源（open.er-api.com）与日期写入 `source` / `ratesUpdatedAt` / `snapshotAt` / `note` 字段与注释；README.md:183、:279 与 README.en.md:178 的「占位 / 不可用」表述同步改为实况描述。
- [x] **8.4 隐私提示「编码 ≠ 加密」**：README.md:28 隐私段与 :43 功能段、README.en.md:28/:43 追加「分享链接内容为可逆编码（编码 ≠ 加密），拿到链接即可读出全部业务输入」；i18n `share.copyTooltip` 同步（§4.4）。
- [x] **8.5 规范文档同步**：p1-spec §3.0/§3.3（pension 校验顺序插入「停止工作年龄」条目）、§7 锚点表补 T1/T7 值；p0-spec §4.7 accumulation 锚点补存续口径与随机流裁定（**拓扑以 p7-spec §2.2 两段式独立派生流为准**）；research-model-audit.md 勘误注（修订轮二 R1/R5 落地）：§3.2 随机流段——逐路径交错读法被「两段式独立派生流」取代（「资产路径延续、随机流隔离」取舍登记见 p7-spec §2.2）、§3.1 桥接公式——附加项单次计入归属段 2、bridgeFundingNeeded 改纯生活费口径（上版「= calculate_baseline.criticalValue 恒等」声明废止）、§4 T1 期望行同步（1,435,200.00）与 T4 推导行笔误/T9 深相等口径已由本规范修正登记；design-language.md §5 末尾按维护条款追加 P7 变更记录（语义修正轮：无签名元素增删，S1–S26 零回退）。

---

## 附 A：本规范自身合规自检（起草会话实跑记录）

| # | 检查 | 命令 / 方法 | 结果 |
|---|---|---|---|
| A-1 | Rust 基线 | `cd src/wasm && cargo test` | 15 passed + 53 passed = 68 全绿（0 failed） |
| A-2 | 尺寸门禁 | `node scripts/check-size.mjs` | `DIST_TOTAL_KB=1953`、`WASM_MAX_KB=364`，门禁通过；dist 原始字节 1,999,865 / wasm 372,534（§6.1） |
| A-3 | 算例独立推导 | `node -e`（十组闭式/递推复算，脚本内含 T4 双口径对照与 T6 反例复算） | T1/T2/T3/T5/T6/T7/T10 期望值逐项命中；T4 推导修正（r=10% 耗尽于第 7 支取年）、T6 反例修正（固定名义 A₁ = 1,000,000 ≠ 999,000），结论均与 audit 一致、推导已登记（§3.4/§3.6） |
| A-4 | 汇率快照实拉 | `curl -s https://open.er-api.com/v6/latest/CNY` | result success；time_last_update_utc = Fri, 20 Nov 2026 00:02:32 +0000；五币种值见 §8.3 |
| A-5 | 调用点枚举 | `grep -rn "useFinanceCall(" src/components`（8 处）+ 直接 calc* 调用 grep（11 处） | 清单见 §5.5；P7 调用点增量 = 0 |
| A-6 | 禁词扫描 | `grep -rniE "apple|bytedance|tencent|cupertino|毛玻璃|液态玻璃|玻璃|阻尼|弹簧|spring|damp|glass|liquid" docs/p7-spec.md`（命中 2 行均为 §5.8/本行的模式字面量自身；排除后复扫零命中） | 本文件内容零命中（实现文件收口时同法复扫） |
| A-7 | 残留名登记 | `grep -rn "固定名义\|固定名義\|Fixed nominal\|fixed nominal" src/ README.md README.en.md` | 命中清单（i18n 3 键值、bridge.ts:640/:644、sequence.rs:37/:40、withdrawal.rs:50、integration.rs:1477、README.md:43/:175、README.en.md:43/:170）与白名单 / 改名目标归属见 §7 断言④ |
| A-8 | 未跑项如实声明 | — | 前端构建与 `check:share` 未在本会话执行（规范起草阶段无代码变更）；README 49.8/49.2 差异未复算（无前端运行时）——均登记为实施会话动作 |
| A-9 | 修订轮复核（本节由修订轮补记） | (a) `grep -rn "固定名义..." src/ README*.md`（A-7 命令重跑，验证评审 F2 命中清单：新增 integration.rs:1477 与 README.md:175 属实）；(b) `sed -n '93p;121p;126p' README.md` + `sed -n '126p' README.en.md`（验证 F2 锚点纠正：:93 = 面板⑧表头、:121 = MC 图注无策略名、:126 = 永续案例，两语同行）；(c) `grep -n "data.multiplier\|data.criticalValue" src/components/BasicCalculator.tsx`（验证 F3 消费点 :632/:663/:712/:845/:883）；(d) `grep -n "支取策略须为" src/wasm/tests/integration.rs`（零命中——策略错误文案无测试断言）；(e) lib 单元测试清单枚举（common 2 / reverse 2 / sequence 3 / withdrawal 8 = 15，F6 计数校正依据） | 全部与评审声明一致；F1–F8 逐条吸收记录见文末「修订说明」 |
| A-10 | 修订轮二复核（R1–R8 证据，本会话实跑） | (a) `grep -rn "固定名义\|固定名義\|Fixed nominal\|fixed nominal" src/ README.md README.en.md`（13 命中，逐处处置表见 §7 断言④；strategyNoteShort/strategyNote1 现状未命中——当前值无该字样）；(b) `sed -n '28p;41p;43p;86p;93p;96p;121p;126p;175p;183p;279p' README.md` + en :28/:43/:96/:126/:170/:178（:93 = 面板⑧表头行、:121 = MC 图注无策略名、:126 = 永续案例，两语同行确认）；(c) `grep -n "data\.multiplier\|data\.criticalValue" src/components/BasicCalculator.tsx`（:632/:663/:700/:712/:763-764/:883/:888/:900/:905/:926）；(d) `grep -n -A2 "#\[test\]" src/wasm/tests/integration.rs \| grep fn`（53 项全名单 + 行号，§3.12 三表逐项比对闭合）；(e) `grep -c "#\[test\]" src/wasm/src/{common,reverse,sequence,withdrawal}.rs`（2/2/3/8 = 15）；(f) `node -e` 复算：T4（W1 97,000 → W7 −13,333.22，第 7 支取年耗尽）/ T5（A₃₆ 41,636.77、A₃₇ −16,281.39、A₃₀ 335,611.52）/ R5 两段和（1,435,200.00 + 271,025.60 = 1,706,225.60，双计虚高 11.72%）/ T7（489.6、1,663,904.00、差 28,704.00）/ 年金因子（750,978.90 ≈ 75.1 万，更正上版 75.9 万）/ T6（A₁ 999,000；反例 A₁ 1,000,000）/ T10（spend₁ 36,597.60、1.83%）/ T4-b 支取率（144,000 ÷ 1,635,200 ≈ 8.8%） | 与评审 R1–R8 对照：R2/R3/R6/R7 上版已吸收、本轮实测复核一致；R1 拓扑重裁定（派生流取代同流两遍）、R5 附加项归属段 2 重裁定、R4 增一次性提示与新键、R8 T4-b 压力标定——逐条见文末「修订对照（第二轮）」 |

---

## 修订说明（独立复核 REJECT 判定 8 条 finding 逐条吸收记录）

> 修订轮输入：独立复核 verdict REJECT，8 条 finding（3×P1 + 5×P2）。评审对上版手算锚点（T1–T10 全部期望值、A-1/A-2/A-6 实跑记录、§5 红线锚点、政策参数与 Morningstar 措辞）复核全部通过——本轮修订不动任何手算锚点与实跑数字，只修结构与登记完整性。8 条全部吸收，无拒收项；两处为「采纳变体」（F1 拓扑方案二选一、F8 可选用例的替代实现），理由如下。

| # | 严重度 | 吸收情况 | 修订落点 |
|---|---|---|---|
| F1 | P1 | **吸收（方案一：两阶段两遍扫描）**。§2.2 随机流拓扑钉死为两遍扫描——第一遍全部路径完成积累阶段（与 P7 前 rng 流逐字节同流，2×years×paths 样本）、并记录各路径 A*/cumInfl*；第二遍按路径顺序消费 2×N 支取样本（含未达标路径消费但丢弃，每路径消费量恒定），严格顺延在全部积累样本之后。三不变 (c) 在该拓扑下成立；交错拓扑（audit §3.2 的自然读法）明文否决并登记矛盾机理；§3.8 不变量测试输入改为非退化 σ（r 4.5±12 / i 2±1 / years 40 / paths 200 / seed 42，除 sustainedProbability 外逐字节比较）——σ=1e-9 退化输入禁用并写明理由（交错拓扑下平凡通过）。另：§2.2 补「T4/T5/T10 拓扑鲁棒性声明」（三条 σ=1e-9 用例期望值与拓扑无关，拓扑由非退化不变量测试锁定）；§8.5 增 audit §3.2 勘误注 | §2.2 重写、§3.8、§8.5 |
| F2 | P1 | **吸收**。(i) §2.4 withdrawal.rs:50 注释改避字措辞（「非名义恒定支出」），不进白名单；§4.3 策略注保留「历史名『固定名义』已弃用」句（用户需要历史名提示），mc.strategyNoteShort / strategyNote1 两键进白名单。(ii) 实测重跑 grep 确认 integration.rs:1477 与 README.md:175 命中——前者入白名单（sequence 真语义注释），后者连同 README.md:43 定为 §8.1 改名目标（收口后必须零命中，非白名单）。(iii) §8.1 改名锚点 :121 纠正为 :43/:175（en :43/:170 已对），实测确认 :121 为 MC 标注截图图注、无策略名字样（起草版沿用了 audit §5 的 :121 说法，属未实测转引，登记为教训）。(iv) §8.2 永续警示锚点 :93 纠正为 :126（实测 :93 为面板⑧表头行；en :126 同行含 "perpetual-withdrawal basis"） | §2.4、§4.3、§7 断言④、§8.1、§8.2、附 A-7/A-9 |
| F3 | P1 | **吸收**。§4.3 增补 BasicCalculator.tsx 条目：baseline 输出的唯一消费面板（实测 :632/:663/:712/:845/:883）——输出卡明细区并列两行（multiplierExact / criticalValueExact，金额走 money() 币种换算）+ fisherNote 口径注一行（≤2 行）+ 无口径切换控件；480 主口径读数窗、S14 段位徽标、敏感性小节（:696 只读 criticalValue）零改动；调用点增量仍为 0（§5.5 登记不变）。§6.2 面板增量估算同步上调 | §4.3、§4.5 basic 行、§6.2、§7 断言⑥ |
| F4 | P2 | **吸收（评审修法：解码端规范化）**。§2.4 / §4.4：share 解码端把 `"inflation_uplift"` 规范化为 `"fixed"`（编码端 store 永不产出该值，合法往返不受影响；避免恢复后的 store 持有 UI 枚举外值——Radio 无选中态、策略注按错误分支渲染）；§3.9 T9 深相等断言限定为三 UI 枚举值，另增「inflation_uplift 载荷 → decode 成功且 strategy === "fixed"」断言 | §2.4、§3.9、§4.4 |
| F5 | P2 | **吸收（评审修法选项一：口径注明示，保留恒等式）**。§2.1 增双重计入登记（T1 例直加 1,906,225.60 vs 真实两段总需 1,706,225.60，健康预留 200,000 计两次，虚高 11.72%——本会话 node 复算确认）；取舍 = 保留 bridgeFundingNeeded == calculate_baseline.criticalValue 恒等式（单一事实来源 + 测试锚点），否决剔除附加项变体（引入第二套附加项聚合口径、破坏恒等式）；口径注落到三处：§2.1 公式区、PensionPanel bridgeNote（§4.2）、README:86 案例注（§8.1）、§7 断言② | §2.1、§4.2、§7 断言②、§8.1 |
| F6 | P2 | **吸收**。§3.11 末行改「48 集成 + 14 单元」（53 − 5 更新集成、15 − 1 更新单元）；§3.12 按本会话实测的 53 集成全名单重列归属（5 更新 / 48 保留，逐项含行号），校正三处计数（rental 3、monte_carlo 5、accumulation 现有 7），补入评审点名的 7 项漏列（all_outputs_carry_error_field_convention、baseline_fractional_multiplier…、baseline_validation_and_parse_errors、pension_adjusted_critical_matches_baseline、pension_coverage_above_one_not_capped、mc_fixed_strategy_params_ignored、mc_strategy_absent_is_byte_compatible）；单元 15 项逐模块归属（common 2 / reverse 2 / sequence 3 / withdrawal 8，更新 1 项 = strategy_resolution_and_validation）。已核实 all_outputs_carry_error_field_convention（:732）仅断言 error 字段存在性、不枚举输出键——新增字段不破坏，归保留 | §3.11、§3.12、§7 断言⑨ |
| F7 | P2 | **吸收**。§4.5 合计行改写键 7 → 8（retireAgeDelayNote / adjustedTitle / reverse.note / leverageTooltip / copyTooltip / strategyFixed / strategyNoteShort / strategyNote1），净增估算 +0.6 → +0.8 KB（按上限计）；§6.2 i18n 行 +3.0 ~ +3.7 KB、合计 +8 ~ +12 KB（按上限 +12 KB 计盘，回收目标按上限执行） | §4.5、§6.2 |
| F8 | P2 | **吸收（改名）+ 采纳变体（可选真 σ 用例）**。T4 测试名 `accumulation_sustained_fail_after_crash` → `accumulation_sustained_fail_overdraw`，§3.4 增名实口径说明（本用例覆盖「首触即达标但支取率超高 ≈ 21.8%」的确定性耗尽，非 σ 暴跌）。评审「可选补一条真 σ 暴跌用例」的**采纳变体**：新增 T4-b 关系断言用例 `accumulation_sustained_at_most_fi`（真 σ r 4.5±12 / i 2±1，断言 0 ≤ sustainedProbability ≤ fiProbability ≤ 1，逻辑必然、独立可推导）而非「真 σ 暴跌后不存续」的数值用例——理由：真 σ 下正态样本无界，无法构造与实现输出无关的必然耗尽/必然存续期望值，数值断言违反本规范「期望值独立可推导」纪律；关系断言以非退化 σ 真实驱动首达后回落机制（audit §2 P0-2 叙事）且期望关系独立可推导，二者取后者 | §3.4（T4 改名 + T4-b）、§3.12、§7 断言③ |

**修订后状态**：手算锚点零改动（评审全数通过）；新增测试从 7 → 8（Rust 集成 7 + 脚本 1，收口预期 60 集成 + 15 单元全绿）；契约字段 7 + 枚举别名 1 不变；§6 合计估算上调为 +8 ~ +12 KB（上限计盘）。

---

## 修订对照（第二轮 REJECT，R1–R8 逐条吸收记录）

> 本节取代修订说明中 **F1 行的拓扑裁定**（同流两遍扫描 → 两段式独立派生流）与 **F5 行的附加项处置**（口径注明示 → 单次计入归属裁定），其余 F1–F8 内容维持有效。评审 R1–R8 全部吸收，无拒收项；证据命令汇总见附 A-10。

| # | 严重度 | 吸收情况 | 修订落点 | 证据（本会话实读/实跑） |
|---|---|---|---|---|
| R1 | P1 | **吸收（拓扑重裁定：两段式独立派生流）**。§2.2 钉死 pass1（纯积累、原流序、与 N 无条件解耦、既有字段无条件字节一致）+ pass2（仅达标路径、派生种子 `seed ^ ((p+1)×0x9E37_79B9_7F4A_7C15)`、耗尽即提前终止、未达标路径零抽样）；「资产路径延续、随机流隔离」取舍如实登记（ChaCha 流位置独立同分布 → 派生流与同流顺延统计无差别，取派生流三条工程理由：无条件兼容 / 样本位置稳定 / 无丢弃消费）；否决拓扑甲（逐路径交错——(c) 不可能成立，评审矛盾机理成立）与拓扑乙（同流两遍——(b)/(c) 成立但依赖顺序纪律 + 丢弃消费 + 位置平移，被取代）；§3.8 锁定测试维持真实量级 σ（r 4.5±12%）、断言字段枚举对齐（fiProbability/年限分位/期末分位/samplePaths/neverReachedShare）、登记「同流两遍在 (c) 下不可区分、拓扑字面由 bridge.ts §g 注释钉死」；§8.5 与 audit §3.2 勘误同步 | §2.2 重写、§3.8、§3.12（T8 行措辞）、§8.5、audit §3.2 | 实读 accumulation.rs:215-267（逐路径单循环、抽样顺序即契约）、:179-180（校验插入点）、:133-156/:153（error_output 与 fallback JSON）、bridge.ts:404-406（可复现性铁律）。登记评审偏差一则：评审「锁定测试未给输入」针对上上版——上版 §3.8 已给真实量级 σ 输入（r 4.5±12%），本轮维持；拓扑本体的派生流改为按评审 fix 落地 |
| R2 | P1 | **吸收（白名单按实测重建为逐处处置表）**。§7 断言④改 14 行处置表（13 现状命中 + 1 改写后新增）：i18n strategyFixed 三语（zh-CN:449 / zh-Hant:409 / en:512）+ withdrawal.rs:50 + README 四行（:43/:175 与 en:43/:170）= 改写后零命中（非白名单）；bridge.ts:640/:644 + sequence.rs:37/:40 + integration.rs:1477 = 白名单 (a) 真语义；strategyNoteShort/strategyNote1 = 白名单 (b)。**登记评审偏差一则**：评审称 strategyNoteShort/strategyNote1「命中」——本会话 grep 实测现状值不含历史名字样、未命中；命中发生在 §4.3 改写后、属有意保留，两态均已登记。§1.4 copyTooltip 行号 :653 → :651（实读复核，上版漏检的行号漂移）。§8.1 锚点 :43/:175、§8.2 锚点 :126 维持并复测确认 | §7 断言④表、§1.4、§8.1/:8.2 复测 | grep 13 命中清单（附 A-10(a)）；`sed` README :93 = 面板⑧表头行、:121 = MC 图注无策略名、:126 = 永续案例（附 A-10(b)）；`grep strategyNote` i18n 三文件——当前值无「固定名义/Fixed nominal」 |
| R3 | P1 | **吸收（上版已落条目，本轮复测消费点并更正引用）**。§4.3 BasicCalculator 条目在位（主输出卡并列双口径 + fisherNote 口径注 + 无口径切换控件，与 §7-⑥/§4.5 basic 三键对齐）；消费点引用更正为实测 :632/:663/:700/:712/:763-764/:883-905/:926——上版 :845 实为 S14 段位徽标展示区（:845-856）而非 data.* 读点，已登记区分 | §4.3 | `grep -n "data\.multiplier\|data\.criticalValue" src/components/BasicCalculator.tsx` → 10 读点（附 A-10(c)） |
| R4 | P2 | **吸收**。§2.4/§4.4 解码映射裁定升级：`"inflation_uplift"` → `"fixed"` 规范化 + `DecodeResult { state; strategyNormalizedFromLegacy }` 返回类型扩展（share 链接恢复与 scenarios.ts 情景库两处调用点同步、数量零新增）+ store 瞬态标志（不入载荷/存档、resetEpoch 不变）+ MonteCarloPanel 一次性提示「旧链接的通胀上调口径已并入固定实际支出」（i18n `share.strategyLegacyNotice` 新键三语，关闭或切换策略即清除）；§3.9 T9 断言改「解码产物为合法枚举 + 数值字段深相等」+ inflation_uplift 载荷 → `strategy === "fixed"` 且 flag true | §2.4、§3.9、§4.3、§4.4、§4.5、§6.2、§6.3、§7 断言⑧（键集断言覆盖新键） | 实读 share.ts:146-150 枚举闸（非三枚举 → 整体 null）、:210-218 键清单、:31-37 版本注释；MonteCarloPanel.tsx:445 Radio value "fixed" 实读 |
| R5 | P2 | **吸收（裁定反转：单次计入，归属段 2）**。§2.1 bridgeFundingNeeded 改纯生活费口径 round2(monthlyExpense × multiplier)，一次性附加项（健康/子女/重大投入）归属段 2——pension.rs:226-241 现状公式零改动、P-A 锚 271,025.60 零漂移、`pension_adjusted_critical_matches_baseline`（integration.rs:958）恒等式保留；**两段相加 = 真实总需 1,706,225.60**（node 复算与评审 R5 数字一致；上版「直加虚高 11.72%」问题消除）；选择理由三条（存量锚点零漂移 / 附加项与起领时点无关 / 被否决变体三重回归代价）+ 恒等式变化登记（上版「= calculate_baseline.criticalValue 恒等」废止，新锁定断言 = round2(monthlyExpense × multiplier)）；§3.1 T1 期望、§7 断言①②、§4.2 bridgeNote、§8.1 README 数字（143.5 万 / 170.6 万）同步 | §2.1、§3.1、§4.2、§7①②、§8.1、audit §3.1/§4 | 实读 pension.rs:216-224（adjusted 直扣）、:226-241（adjustedCritical = adjusted×multiplier + children + health + major）、baseline.rs:118-128（附加项同构）；node 复算 1,435,200.00 + 271,025.60 = 1,706,225.60（附 A-10(f)） |
| R6 | P2 | **吸收（上版已校正计数，本轮 integration.rs 全名单实跑闭合复核）**。§3.11「48 集成 + 14 单元」、§3.12 三表与实测 53 项全名单逐项比对一致：更新 5（baseline :73/:101 + pension :939/:1000/:1013）；保留 48 逐组 = baseline 2 + amortize 4 + rental 3 + reverse 2 + monte_carlo 5 + tax 5 + 约定 1 + accumulation 7 + pension 2 + bootstrap 5 + mc 策略 6 + sequence 4 + required_saving 2 = 48 ✓；评审点名 7 项均在保留清单；单元 common 2 / reverse 2 / sequence 3 / withdrawal 8 = 15、更新 1（strategy_resolution_and_validation withdrawal.rs:478）✓；`all_outputs_carry_error_field_convention`（:732）实读确认仅断言 error 字段存在性/空值、不枚举输出键，归保留 | §3.11、§3.12（维持，登记实测复核） | `grep -n -A2 "#\[test\]" src/wasm/tests/integration.rs \| grep fn`（53 项全名单 + 行号，附 A-10(d)）；`grep -c "#\[test\]"` 四模块 2/2/3/8（附 A-10(e)）；:732 测试体实读 |
| R7 | P2 | **吸收（上版已校正 8 键，本轮随 R4 增键重算字节并闭合算术）**。§4.5 合计 = 新增 13 键 × 3 ≈ 2.5 KB（720/760/1,050 B）+ 改写 8 键净增 0.8~1.4 KB；§6.2 i18n 行 +3.3~+3.9 KB、合计 +7.8~+12.9 KB（按上限 +13 KB 计盘，行和逐项闭合：1.5+3.3+2.5+0.5 = 7.8、4+3.9+4+1 = 12.9）；§6.3 硬上限 12 → 13 | §4.5、§6.2、§6.3 | 同批 node 复算与行和闭合检查（附 A-10(f)） |
| R8 | P2 | **吸收（T4 已更名 + T4-b 定型为真 σ crash-after-FI 压力用例）**。T4 名实口径段维持（σ=1e-9 下无暴跌——24,000/110,000 ≈ 21.8% 超额支取率下的确定性耗尽，node 复算 W1 97,000 → W7 −13,333.22 第 7 支取年耗尽，测试名 `accumulation_sustained_fail_overdraw`）；T4-b 输入重标定为高支取率压力口径（income 20,000 / expense 12,000 → 达标时支取率 ≈ 144,000/1,635,200 ≈ 8.8% ≫ r 均值 4.5%，真实 σ 12% 下大量达标路径在 N=10 内耗尽——「达标后遭遇负收益序列」机制真实驱动，取代上版低支取率下存续率 ≈ 达成率的平凡输入），期望仍为逻辑必然关系式 0 ≤ sustained ≤ fi ≤ 1（真 σ 下数值期望不可独立推导的纪律维持，登记于修订对照 F8→R8 承接） | §3.4（T4 名实段 + T4-b 重标定）、§3.12、§7 断言③ | node 复算 T4 全序列与 T4-b 支取率 8.8%（附 A-10(f)） |

**修订轮二后状态**：R5 触及的两处锚点（T1 bridgeFundingNeeded、断言①②）按新裁定更新并经 node 复算，其余 T1–T10 期望值零改动（拓扑重裁定不改任何数值锚——σ=1e-9 用例拓扑无关）；新增测试 8 项不变（收口预期 60 集成 + 15 单元全绿）；契约变更 = 字段 7 + 枚举别名 1 + `DecodeResult` 返回类型扩展 1（新增字段数不变）；i18n 新增键上限 13、§6 合计 +8 ~ +13 KB（上限计盘）；R1 拓扑与 R5 附加项归属两项算法裁定已同步登记 research-model-audit.md 勘误注。

---

## 实施结果与收口记录（文档收尾会话复测登记，2026-11-21）

> 登记性质：实施工作流（门禁 → 双验收 → 素材重制 → 文档收尾四阶段）跑通后，由文档收尾会话**独立复跑门禁、实拍面板**后登记。本节数字全部为本会话实跑/实拍取证（命令与读数随条目给出），不转抄实施会话自述；无法在本会话验证的事实如实注明。

### A. 改动文件清单（`git status --porcelain` 实录）

- **计算核心**：`src/wasm/bridge.ts`、`src/wasm/src/{accumulation,baseline,bootstrap,montecarlo,pension,withdrawal}.rs`、`src/wasm/tests/integration.rs`（60 项集成测试）。
- **前端**：`src/components/BasicCalculator.tsx`、`src/components/advanced/{AccumulationPanel,MonteCarloPanel,PensionPanel,ReversePanel,ScenarioPanel}.tsx`、`src/services/{finance,share}.ts`、`src/store/useCalculatorStore.ts`、`src/data/{defaults,pensionParams,types}.ts`、`src/i18n/locales/{zh-CN,zh-Hant,en}.ts`。**未改动** `src/styles/global.css`——无签名元素实现变化（S1–S26 零回退）与 §5.5 design-language 登记（无令牌变更）一致，`types.ts` 的 +4 行经 diff 复核不含主题令牌键。
- **工程**：`package.json`（仅 +1 行 `"check:share"` script）、`scripts/check-share.mjs`（新增，T9）、`scripts/plugins/purgeArcoCss.ts`（尺寸回收增强）。
- **文档与素材**：`README.md` / `README.en.md`、`docs/design-language.md`（§5 版本记录追加 P7 条目）、`docs/p0-spec.md`（:900 P7 增补注）、`docs/p1-spec.md`（:356 校验顺序插入项、:1327 P-T1 锚点）、`docs/research-model-audit.md`（:94/:114/:159/:185 四处勘误注）、本文件、素材重制四处（`docs/assets/{,en/}demo-workbench.png` + `demo-workbench-flow.gif`）+ 文档收尾会话补拍 `docs/assets/en/demo-reverse-savings.png`。规范输入三文件（research-retirement-models / research-model-audit / design-atlas-brief）为本轮新增研究文档，随轮入库。

### B. 测试更新登记（对照 §3.12，本会话复核）

- **登记条数**：更新 5 项集成 + 更新 1 项单元（withdrawal.rs `strategy_resolution_and_validation`）+ 新增 8 项 = §3.12 收口口径。新增 7 项 Rust 集成本会话 grep 实证在位：`accumulation_sustained_fail_overdraw`（integration.rs:962）、`accumulation_sustained_at_most_fi`（:981）、`accumulation_sustained_horizon_30_vs_40`（:998）、`accumulation_sustained_invariant_same_seed`（:1018）、`accumulation_sustained_survive_realistic`（:1048）、`pension_bridge_period_fields`（:1209）、`mc_fixed_semantics_after_rename`（:1637）；第 8 项 = `scripts/check-share.mjs`。
- **实跑**：`cargo test --manifest-path src/wasm/Cargo.toml` → **15 单元 + 60 集成全绿（0 failed）**，与 §3.12「60 集成 + 15 单元」收口预期一致；`npm run check:share` → 六组断言全过（v4 三枚举往返 / 缺键整体 null / v3 版本闸拒绝 / inflation_uplift 映射 fixed + 规范化信号 / 三语键集一致 / 改写键在位）。

### C. 门禁终态（本会话实跑）

| 项 | 实跑结果 | 判定 |
|---|---|---|
| `npm run build` | ✓ 通过（vite 2.46s，PWA precache 12 entries） | 过 |
| `node scripts/check-size.mjs` | exit 0：`DIST_TOTAL_KB=1927`（dist 14 文件合计 1,972,455 B，对 2,000,000 B 余量 27,545 B）、`WASM_MAX_KB=379`（finance_core_bg 387,792 B，对 800 KB 门禁余量 412 KB） | 过 |
| `npm run check:share` | exit 0（六组断言，见 B） | 过 |

- **残留偏差（如实登记）**：wasm 387,792 B 较 P6 基线 372,534 B 增 **+15,258 B（≈ +14.9 KiB）**，超出 §6.2 上限估算 +4 KB，并越过 §6.3 内部缓冲线 369 KB（= 364 + 5）。按 §6.3 本应触发回收顺序，但三类回收手段（i18n 并合 / CSS purge / dist 资产压缩）均作用于 dist 侧、不回收 wasm——dist 侧实已逆势回收（1,999,865 B → 1,972,455 B），wasm 硬门禁实余 412 KB、不触发失败。登记为已知偏差，留待 P8 评估（候选：pass2 支取段逻辑瘦身）；**不构成门禁违规，不阻塞收口**。

### D. 验收轮次

1. **规范轮两轮**：起草 → 独立复核 REJECT（F1–F8 全吸收，见「修订说明」）→ 修订轮二 REJECT（R1–R8 全吸收，见「修订对照（第二轮）」）。
2. **实施验收**：实施工作流内置门禁轮与双验收循环（模型行为验收 + IAB 视觉矩阵验收，FAIL 即修复重验），以非 FAIL 收敛后进入素材阶段——素材四处产出为收敛证据；具体轮次计数属运行时状态、未在仓库留痕，不虚报。
3. **文档收尾会话复核（本节）**：§7 断言的 IAB 可测项逐条实测（见 E）；门禁三项复跑全绿（见 C）。

### E. IAB 面板实测（`npx vite preview --port 4173` + 浏览器实拍，zh-CN 与 en 双语，1440×900/1120）

| # | 断言 | 实测读数 | 判定 |
|---|---|---|---|
| 1 | §7② 桥接时间口径 | 面板 ⑦ 填「想停止工作的年龄 30」→「停工 → 起领桥接段」卡渲染：桥接期年数 **30 年** / 桥接期需备资金 **¥1,435,200**；bridgeNote 含「一次性预留（健康/子女/重大投入）已计入下方『领取后』参考线、不在桥接段重复计入，两段相加即真实总需」句；改回缺省 60 → 桥接卡不渲染、面板零新增行 | 过 |
| 2 | §7②/§8.1 两段相加 | 段 2「养老金领取后·调整后参考线」**¥147.97 / ¥271,025.6 / 95%** 逐字节不变；1,435,200 + 271,025.6 = **1,706,225.6**（README 双语「170.6 万 = 真实总需」句） | 过 |
| 3 | §7⑤ 永续警示 | 反向估算面板警示句 + Morningstar 2026 参照句逐字在位（zh/en），与 research-retirement-models §2.3 模板句一致（30 年 / 90% / 股 30–50% / 3.9% / 3.3–4.0% 浮动 / 美国市场假设限定） | 过 |
| 4 | §7⑥ 费雪双口径 | 基础输出卡并列两行「精确乘数（费雪口径）**489.6** / 精确口径参考线 **¥1,663,904**」+ fisherNote 口径注在位（zh/en）；无口径切换控件 | 过 |
| 5 | §7④ 界面正名 | 蒙特卡洛面板策略 Radio「固定实际支出（默认）」为缺省选中（en "Fixed real spending (default)"） | 过 |
| 6 | §8.1 概率对齐 | 反推储蓄验证概率实测 **49.8%**（面板⑥：资产 500,000 / 目标 1,352,000 联动态 / 15 年 / 5,000 路径 / 种子 42 / 月储蓄 ¥2,952.32；zh 与 en 同值——同 seed 同输入确定性契约） | 过 |
| 7 | §8.4 隐私提示 | 分享按钮 tooltip「链接内容为可逆编码（编码 ≠ 加密），任何拿到链接的人可读出全部业务输入…」zh/en 在位 | 过 |
| 8 | §8.3 离线快照 | `defaults.ts:211-225` 六币种真值与 `ratesUpdatedAt: "Fri, 20 Nov 2026 00:02:32 +0000"` / `snapshotAt: "2026-11-21"` 在位，README 双语表述同步 | 过 |

### F. 残留（收口后仍存在的事实，如实登记）

1. **wasm 增量越内部缓冲线**：见 C——硬门禁绿，登记偏差不阻塞，P8 评估回收。
2. **素材基线不一**：`docs/assets/demo-reverse-savings.png`（zh 镜像）仍为旧版单列布局截图——但其显示值 49.8% 与现行构建实测一致（E-6），本轮保留不重拍；en 镜像已重拍为现行构建（双栏布局 + 联动态 + 49.8%）。P7 素材重制范围 = 四处受新 UI 影响的素材，全量重制不在本轮。
3. **p0/p1/audit 同步为实施会话登记**：三处同步在本会话 grep 实证在位（p0-spec:900、p1-spec:356/:1327、audit:94/:114/:159/:185），未逐字全文复核其上下文。
4. **验收轮次计数**：双验收循环的轮次/finding 总数属工作流运行时状态（见 D-2），仓库无留痕，本节不填数。
