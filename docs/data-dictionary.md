# docs/data-dictionary.md — 数据字典：默认值与展示数据台账

> **用途**：全仓数据层默认值与展示数据的唯一人读台账；机读镜像为 `scripts/check-data.mjs`（`npm run check:data`，九组断言），两处键一一映射——本表每行「check:data 组」列即指向该组断言。
> **首建基线复核日期：2026-11-21**（每行「复核」列同日；后续改动行须刷新该列）。
> **三处同步纪律**：任何改默认值的 PR 必须同时改①数据层落点、②本字典对应行、③check:data 对应断言（`defaults.ts` → 字典 → 断言）；缺一处即视为漂移。
> **核证等级**：official=官方核证（官方原文页面已直读）；media=媒体核证（官方数字经两家及以上独立媒体转载核对）；video=视频口径（仅见于原视频或分析假设，未独立查证，不参与计算）；工程参数=无外部来源的工程/研究默认值；占位=待数据研究员复核；派生=由其他行算术导出。展示数据表全部行「不参与计算」（纪律见 `src/data/insights.ts:9`）。
> **简中惯例**：`presets.note` 与 `insights.ts` 的 value/source/year/scope 为简中数据口径、不入 i18n（`presets.ts:4-5`、`insights.ts:7` 头注惯例）；界面标签走 i18n 键空间。
> **复核节奏**：国家统计局年度收支每年 1 月（下次 2027-01）；社保基金会年报每年 8–10 月发布（下次注意 7.62% 传导——引用「最新」时用 7.62%，见 §4 句式 5）；SBBI China 年报约每年 4 月；育娲人口报告不定期（2024 版后无固定周期）。
> **引用句式编号**：指 `docs/research-source-evidence.md` §5 五项成品句（句式 1 消费 / 句式 2 育儿 / 句式 3 社保 2024 / 句式 4 假设区间 / 句式 5 社保 2025 更新口径），全文收录于本文 §4。

---

## 一、计算输入默认值表（src/data/defaults.ts + presets.ts + pensionParams.ts）

| 键 / 常量 | 落点（file:line） | 现值 | 口径与来源摘要 | 核证等级 | 句式 | 复核节奏 | 复核 | check:data 组 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BASELINE_DEFAULTS.monthlyExpense | src/data/defaults.ts:32 | 2990 | 国家统计局《2025年居民收入和消费支出情况》城镇居民人均消费支出 35,869 元/年 ÷12 ≈ 2,989，取整到十位（折月值为派生算术，非官方月度数据） | official | 1 | NBS 每年 1 月 | 2026-11-21 | A/B/C/D |
| BASELINE_DEFAULTS.costPerChild | src/data/defaults.ts:35 | 580000 | 视频口径示例值 58 万（非报告原文——原文 0–17 岁全国平均 53.8 万，见面板⑨）；保留为可编辑示例 | video-示例值 | 2 | 育娲不定期 | 2026-11-21 | E/F |
| BASELINE_DEFAULTS.healthReserve | src/data/defaults.ts:36 | 200000 | 原视频估算；保守区间 15–50 万（2024 年价格水平，语境见 insights.ts 医疗参考） | video | — | 无固定（待数据研究员复核） | 2026-11-21 | B |
| BASELINE_DEFAULTS.nominalReturnPct | src/data/defaults.ts:38 | 4.5 | 规划假设区间 4%–4.5% 上沿、非文献推导均值；参考背景见句式 4 | video-假设 | 4 | 无固定（SBBI 背景 4 月） | 2026-11-21 | D/I |
| BASELINE_DEFAULTS.inflationPct | src/data/defaults.ts:39 | 2.0 | 规划假设（原视频）；近年实际 CPI 2022 +2.0 / 2023 +0.2 / 2024 +0.2 / 2025 持平（insights 链条 chainInflation） | video-假设 | 4 | 无固定 | 2026-11-21 | D |
| MONTE_CARLO_DEFAULTS.annualSpend | src/data/defaults.ts:116 | 35880 | 派生：2990 × 12（年支出基期值，自第 1 年起按通胀上行） | 派生（official 基座） | 1 | 同 monthlyExpense | 2026-11-21 | C |
| MONTE_CARLO_DEFAULTS.nominalReturnStdPct / inflationStdPct | src/data/defaults.ts:118,120 | 12 / 1 | 波动率工程参数（docs/p2-spec.md §2.4 语境） | 工程参数 | — | — | 2026-11-21 | — |
| MONTE_CARLO_STRATEGY_DEFAULTS.threshold 五参数 | src/data/defaults.ts:137-144 | 20/10/20/10/15（freezeOnLoss=true） | 文献最优阈值带参数（docs/p2-spec.md §2.4 研究默认） | 工程参数（研究默认） | — | — | 2026-11-21 | — |
| MONTE_CARLO_STRATEGY_DEFAULTS.percent.realReturnAssumpPct | src/data/defaults.ts:146 | 2.5 | 派生：4.5 − 2.0 = 2.5（初始回显值，用户可改、无运行时联动） | 派生 | 4 | 随名义/通胀默认 | 2026-11-21 | D |
| PENSION_AVG_WAGE_ANCHOR_CNY | src/data/pensionParams.ts:49 | 10343 | 国家统计局 2024 年城镇非私营单位年平均工资 124,110 元 ÷12 = 10,342.5 → 10,343（全国口径锚点，各省计发基数不同） | official | — | 年度（工资发布约 5–6 月） | 2026-11-21 | — |
| PRESET_PROFILES 四画像 monthlyExpense | src/data/presets.ts:43,50,57,64 | 4500/8000/11000/2000 | 一线/低线整理口径；与消费构成五项和恒等（1500+2000+400+100+500 等） | 工程整理 | — | — | 2026-11-21 | E |
| PRESET_PROFILES 四画像 costPerChild | src/data/presets.ts:43,50,57,64 | 580000 | 同 BASELINE.costPerChild（视频口径示例值；一孩 note 已注 53.8 万对照，presets.ts:59） | video-示例值 | 2 | 育娲不定期 | 2026-11-21 | E/F |
| PRESET_PROFILES 四画像 healthReserve | src/data/presets.ts:43,50,57,64 | 150000/200000/200000/150000 | 单人 15 万 / 双人 20 万整理口径（note 内注明） | 工程整理 | — | — | 2026-11-21 | — |
| LOAN_DEFAULTS | src/data/defaults.ts:92-97 | 100 万 / 3.9% / 30 年 | 占位：常见房贷参考，待数据研究员校准 | 占位 | — | 待校准 | 2026-11-21 | — |
| RENTAL_DEFAULTS | src/data/defaults.ts:100-111 | 见行 | 占位：待接 rentParams.ts 城市参数后由用户选择覆盖 | 占位 | — | 待校准 | 2026-11-21 | — |
| TAX_ESTIMATE_DEFAULTS | src/data/defaults.ts:153-157 | 20 万 / 6 万 / 空表 | 占位：bands 待接 taxTables.ts；减除费用按中国个税年减除口径 | 占位 | — | 待校准 | 2026-11-21 | — |
| ACCUMULATION_DEFAULTS.monthlyExpense | src/data/defaults.ts:186 | 2990 | 同 BASELINE.monthlyExpense（①） | official | 1 | 同 monthlyExpense | 2026-11-21 | —（经 targetValue 间接入 B） |
| ACCUMULATION_DEFAULTS.targetValue | src/data/defaults.ts:187 | 1635200 | 联动派生：2990 × 480 + 200,000（与基础模式临界值实时联动，手动修改解除） | 派生（official 基座） | 1 | 同 monthlyExpense | 2026-11-21 | B |

## 二、展示数据表（src/data/insights.ts 全量：链条 10 环 + 市场消费 2 条 + 育儿地区 4 条 + 医疗 3 条；全部行不参与计算）

| 键 / 条目 | 落点（file:line） | 现值 | 口径与来源摘要 | 核证等级 | 句式 | 复核节奏 | 复核 | check:data 组 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chainDeposit1y | src/data/insights.ts:47-54 | 0.95% | 全国性商业银行一年期整存整取挂牌利率（2025-05-20 生效），经媒体报道核对 | media | — | 随挂牌利率调整 | 2026-11-21 | — |
| chainDeposit5y | src/data/insights.ts:55-62 | 1.30% | 同上五年期 | media | — | 同上 | 2026-11-21 | — |
| chainCoreInflation | src/data/insights.ts:63-70 | 1.2%（视频口径 1.0%） | 国家统计局 2025-12 核心 CPI（2026-01-09 发布）；视频 1.0% 与发布值不一致、按发布值展示 | media | — | NBS 每月/年度发布 | 2026-11-21 | — |
| chainSsf | src/data/insights.ts:71-78 | 7.39% | 社保基金会《全国社会保障基金 2024 年度报告》（2025-09-30 发布）：成立以来至 2024 年末年均投资收益率；scope 另注 2025 年报更新口径 7.62%（截至 2025 年末）；国家级储备基金历史业绩、不代表个人可获收益 | official | 3、5 | 每年 8–10 月年报 | 2026-11-21 | G |
| chainAnnuity | src/data/insights.ts:79-86 | 6.17% | 人社部 2024 年度企业年金摘要（2007–2024 十八年平均，媒体转载核对） | media | — | 年度摘要（约 3 月） | 2026-11-21 | — |
| chainFeeDrag | src/data/insights.ts:87-94 | 2–3 pp（显性锚 1.4 pp） | 原视频估计；显性部分锚定证监会 2023 费率改革口径 | video | — | — | 2026-11-21 | — |
| chainNominal | src/data/insights.ts:95-102 | 4%–4.5%（默认 4.5%） | 规划假设（原视频），非文献结论；背景见句式 4 | video | 4 | — | 2026-11-21 | I |
| chainInflation | src/data/insights.ts:103-110 | 2%（默认 2.0%） | 规划假设；已核证实际值近四年均值 ≈0.6%，假设属偏保守 | video | — | — | 2026-11-21 | — |
| chainReal | src/data/insights.ts:111-118 | 2%–2.5% | 由上两环费雪复算（(1+4%)/(1+2%)−1 ≈ 1.96%、(1+4.5%)/(1+2%)−1 ≈ 2.45%） | video | — | — | 2026-11-21 | — |
| chainMultiplier | src/data/insights.ts:119-126 | 480 | 12 ÷ 0.025 = 480（算式与组 B 同源） | video | — | — | 2026-11-21 | B（算式同源） |
| 市场消费[0] 全国 | src/data/insights.ts:131-137 | 2,456 元/月（29,476 元/年） | NBS《2025 年居民收入和消费支出情况》；折月=年值÷12 派生 | official | 1 | NBS 每年 1 月 | 2026-11-21 | A |
| 市场消费[1] 城镇 | src/data/insights.ts:138-144 | 2,989 元/月（35,869 元/年） | 同上城镇口径；scope 注明默认 2,990 取整 | official | 1 | NBS 每年 1 月 | 2026-11-21 | A |
| 育儿地区·全国 | src/data/insights.ts:149 | 53.8 万（0–17 岁平均） | 育娲《中国生育成本报告2024版》原文值（经央广网转述核证；文件无核证字段，本表按 media 登记） | media | 2 | 育娲不定期 | 2026-11-21 | F |
| 育儿地区·上海 | src/data/insights.ts:150 | 101 万 | 报告原文值；note 注明视频口径 108 万不符 | media | 2 | 育娲不定期 | 2026-11-21 | — |
| 育儿地区·北京 | src/data/insights.ts:151 | 93.6 万 | 报告原文值；note 注明视频口径 100 万不符 | media | 2 | 育娲不定期 | 2026-11-21 | — |
| 育儿地区·西藏 | src/data/insights.ts:152 | 34.9 万 | 报告原文值（最低省份）；note 注明视频「贵州 43 万最低」未能复核、不采纳 | media | 2 | 育娲不定期 | 2026-11-21 | — |
| 医疗[0] | src/data/insights.ts:157-163 | 6,454.4 元/年 | 卫健委《2024 年我国卫生健康事业发展统计公报》人均卫生总费用（官方解读页受限、媒体转载核对） | media | — | 年度公报 | 2026-11-21 | — |
| 医疗[1] | src/data/insights.ts:164-170 | 约 20 万（保守区间 15–50 万） | 原视频估算；等额不折现上限参考 6,454.4×80 年 ≈ 51.6 万 | video | — | — | 2026-11-21 | — |
| 医疗[2] | src/data/insights.ts:171-177 | 二线 15–30 万；一线 30–60 万 | 原视频估算，未独立查证；可作健康预留可编辑预设参考 | video | — | — | 2026-11-21 | — |

> **登记勘误**：wf01-spec §3 草拟时把链条记作「9 环」、医疗记作「2 条」，实况为链条 10 环（chainReal 与 chainMultiplier 各为一环）、医疗 3 条——本表按「insights.ts 全量」纪律逐行登记实况（实施会话如实登记，偏差全录见 wf01-spec §10.5）。

## 三、离线快照表

| 键 | 落点（file:line） | 现值 | 口径与来源摘要 | 核证等级 | 句式 | 复核节奏 | 复核 | check:data 组 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FX_RATE_SNAPSHOT | src/data/defaults.ts:211-228 | USD 0.149433 / EUR 0.136198 / GBP 0.113982 / JPY 23.877343 / HKD 1.172212 / CNY 1 | open.er-api.com 公开端点实拉核验，接口时点 2026-11-20；仅收六币种，数值随实施时点冻结，实时获取失败时回退使用 | 工程快照（官方接口实拉） | — | 换汇场景手动刷新 | 2026-11-21 | — |

## 四、写作指引（引用句式模板全文 + 禁用句式 + 更新口径指引）

**标准句式模板**（注释/文案通用，出处 research-source-evidence §5）：

```
数据来源：{机构/作者}，《{文献或统计发布名称}》（{年份/版本，发布日期}），口径：{一句话口径}；复核日期 {YYYY-MM-DD}。
```

可选尾缀：官方页 URL（限官方/一手来源）；「据{权威媒体}报道」仅限二手核证来源。

**五项成品句**：

1. 数据来源：国家统计局，《2025年居民收入和消费支出情况》（2026-01-19），口径：住户调查人均消费支出年值、含居住与医疗等八大类；折月值为年值÷12的派生算术；复核日期 2026-11-21。
2. 数据来源：育娲人口研究，《中国生育成本报告2024版》（2024-02-21），口径：0–17岁全国平均53.8万元、至本科毕业约68万元（约数），据央广网报道核证；复核日期 2026-11-21。
3. 数据来源：全国社会保障基金理事会，《全国社会保障基金2024年度报告》（2025-09-30），口径：基金自成立以来至2024年末历史年均投资收益率7.39%，为国家级储备基金历史业绩，不代表个人可获收益；复核日期 2026-11-21。
4. 假设区间：名义回报 4%–4.5% 为本工具保守假设，参考背景为 Siegel《Stocks for the Long Run》美股长期实际年化约6.5%–7%、有知有行 SBBI China 年报 A股 2005–2025 实际年化约8.1%；复核日期 2026-11-21。
5. 更新口径：全国社会保障基金理事会《2025年度报告》（2026-09-01）成立以来年均投资收益率7.62%（截至2025年末）；引用「最新」时用此值；复核日期 2026-11-21。

**禁用句式**：

- 把社保基金年均收益率与个人收益挂钩的任何表述（「你的养老金年化 7.39%」「预期收益 7.39%」等一律禁止；check:data 组 G 负向断言锚定）。
- 把 4%–4.5% 写成「研究表明」/「历史平均」（它是假设区间，不是文献结论；组 I 锚定）。
- 把折月值写成官方月度数据（官方仅发布年值）；把「约 68 万」写成精确值；把媒体转述写成引号内直引（引号内直引仅限已直读的官方原文）。
- chainSsf scope 不得出现「最新」字样（防与 7.39% 并置构成过时表述；组 G 锚定）。

**更新口径指引**：

- 引用社保基金收益「最新」值时用 7.62%（2025 年报口径，截至 2025 年末）；7.39% 只能与 2024 年报同源引用。
- NBS 年度收支更新后：同步三处——`defaults.ts` 注释、本表对应行、check:data 组 A 断言（34,557 式旧年份清零同规则）。
- 育娲新版报告发布后：报告原文值入展示层（面板⑨），输入默认示例值属性另行裁定；不得静默替换 580000。
