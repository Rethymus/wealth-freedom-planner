# WF-01 知识与数据校准实施规格（wf01-spec）

> 性质：实施规格——把 `docs/design-atlas-brief.md` §五校准清单与两份研究文档（`docs/research-calibration-audit.md`、`docs/research-source-evidence.md`，复核日期均为 2026-11-21）的裁定落成可施工、可验收的条目。
> 输入物：上列两份研究文档全读；`src/data/presets.ts`、`src/data/defaults.ts` 全读抽查；`src/data/insights.ts`（:60–170）、`scripts/check-share.mjs` 全读、`scripts/check-size.mjs` 全读、`package.json`、i18n 三语文件锚点区段、README.md / README.en.md 锚点行，均本会话直读。
> 范围红线：只动注释、展示层文案、数据层标注字符串与文档；**不动任何计算公式、数据流与夹具数值**（§7）。
> 铁律：零新依赖（check:data 复用 esbuild——随 vite 在依赖树内，先例 `scripts/check-share.mjs:5`）；本轮全部新增/改动文档零禁词——词表见任务书铁律（共 13 词：三家厂商名 / 材质隐喻与材质统称 / 运动学隐喻及其英文对应词），原文不在本文复写（避免词表本身触发扫描命中；扫描正则以任务书原词表为准，见 §8 #6）。

---

## §1 逐项校准清单（8 项）

图例：**改** = 本轮落改；**锚** = 基准锚点、保持不动（研究审计已裁定合规，登记防漂移）。

### ① 消费口径 2,456 / 2,989 / 2,990 —— 改（仅 README 来源表行）

- **现值锚点**：
  - 面板口径注：`src/data/insights.ts:132`（全国 2,456 元/月 = 29,476 元/年）、`:139-142`（城镇 2,989 元/月 = 35,869 元/年；scope 注明「默认月开销 2,990 元/月即参考此口径取整」）；三语镜像 `zh-CN.ts:176-177` marketNote / `zh-Hant.ts:164` / `en.ts:193-194`。
  - 默认值：`src/data/defaults.ts:31-32`（monthlyExpense 2990）；派生锚 `:33`（临界值 2990×480+200,000=1,635,200）、`:113,116`（MC 年支出 2990×12=35,880）、`:187`（ACCUMULATION targetValue）。
  - README 展示层：README.md:41,67,86,111,163,288 用 2,990（合规）；**README.md:263 来源表行仍是 2024 年口径**（34,557 元/年 ≈ 2,880 元/月）；README.en.md:259 同。
- **目标值**：数值 2990 全仓不动；README.md:263 与 README.en.md:259 来源表行更新为 2025 年统计（城镇 35,869 元/年 ≈ 2,989 元/月；全国 29,476 元/年 ≈ 2,456 元/月），并注明「默认 2,990 = 2,989 取整到十位」。折月值是年值÷12 的派生算术，**不得写成官方月度数据**。
- **来源句式**（research-source-evidence §1 + §5 成品句 1）：「数据来源：国家统计局，《2025年居民收入和消费支出情况》（2026-01-19），口径：住户调查人均消费支出年值、含居住与医疗等八大类；折月值为年值÷12的派生算术（35,869÷12≈2,989；29,476÷12≈2,456）；复核日期 2026-11-21。」

### ② 育儿成本 58 万 / 580,000 / 53.8 万 —— 改（仅标注，数值不动；裁定见 §2）

- **现值锚点**：defaults.ts:35（costPerChild 580000，注释无口径标注）、`:84`（childReserve 580000）；presets.ts:43,50,57,64（四画像 580000）+ `:59`（note「按 58 万整理」，无对照句）；展示层 insights.ts:149（0–17 岁平均 53.8）+ 三语 childShort/childNote/childVideoNote（zh-CN.ts:177-183 / en.ts:195-202 / zh-Hant.ts:165-169，已注视频口径不一致）；README.md:288 / en:284 把「每孩 58 万」归入「公开统计整理的参考口径」（属性未注明）。
- **目标值**：数值 580000 全仓不动（integration.rs 16 处夹具、check-share BASE_STATE:56,64、README:126 演示数随之全部保持有效）；defaults.ts:35/:84 注释与 presets.ts:59 note 补「视频口径示例值 + 报告原文 0–17 岁平均 53.8 万」对照；README.md:288 / en:284 免责句为 58 万单独注明属性（见 §6-2）。依据 atlas-brief:108：「58 万降级为可编辑示例值/历史预设，不标为报告原始结论」。
- **来源句式**（research-source-evidence §2 + §5 成品句 2）：「数据来源：育娲人口研究，《中国生育成本报告2024版》（2024-02-21），口径：0–17岁全国平均53.8万元、至本科毕业约68万元（约数），据央广网报道核证；复核日期 2026-11-21。」

### ③ 社保基金 7.39% —— 改（最小注：scope 补时间边界与更新口径；值与默认地位不动）

- **现值锚点**：insights.ts:71-78（chainSsf：value "7.39%"、source《2024 年度报告》、verification=official；scope「基金自成立以来年均投资收益率……不代表个人账户实际可得收益」）；README.md:101,163 / en:101,158（描述层）。该环**不进计算**（audit §3；insights.ts:9「本文件全部为展示数据，不参与任何计算」）。
- **目标值**：value 保持 "7.39%"（与其 source 引用的 2024 年报内部自洽）；scope 句补「至 2024 年末」时间边界，并追加更新口径句：「2025 年报更新口径：成立以来年均 7.62%（截至 2025 年末，2026-09-01 发布）」。**不把 7.62% 换入 value**——value 与 source 必须同源；「引用『最新』时用 7.62%」这句写作指引落在数据字典（§3），不进界面文案。audit §3 判「无需改动」基于裁定合规性；research-source-evidence §3（同日更晚口径）补「需同步更新提示」，本项按后者执行最小注。
- **来源句式**（research-source-evidence §3 + §5 成品句 3、5）：「数据来源：全国社会保障基金理事会，《全国社会保障基金2024年度报告》（2025-09-30），口径：基金自成立以来至2024年末历史年均投资收益率7.39%，为国家级储备基金历史业绩，不代表个人可获收益；复核日期 2026-11-21。更新口径：《2025年度报告》（2026-09-01）成立以来年均7.62%（截至2025年末）。」
- **禁用表述**（落 check:data 组 G 负向断言）：任何把 7.39% 与个人可得收益、收益承诺并置的文案一律禁止；scope 不得出现「最新」字样（避免与 7.39 并置构成过时表述）。

### ④ 4.5% 名义回报默认值 —— 锚（保持 4.5 + 视频口径标注，现状合规）

- **现值锚点**：defaults.ts:38,87,117-118,188；折叠头默认值提示 zh-CN.ts:74 / zh-Hant.ts:68 / en.ts:88；链条环 insights.ts:95-102（chainNominal，verification=video）+ `:111-118`（chainReal 费雪复算 2%–2.5%）；夹具 check-share.mjs:59,67,86-87,103-104、integration.rs:975,1045；README.md:38,91,101,121,126,288 / en 同源行。
- **目标值**：零改动。4.5% 是假设区间上沿、非文献推导均值（research-source-evidence §4：美股长期实际约6.5%–7%、A股 2005–2025 实际约8.1%、Siegel 前瞻预期 4.5%–5.5%——4%–4.5% 为刻意保守假设）；现状已按 atlas-brief:110 落实「假设区间、可调、注明非推导均值」。
- **来源句式**（§5 成品句 4，落数据字典）：「假设区间：名义回报 4%–4.5% 为本工具保守假设，参考背景为 Siegel《Stocks for the Long Run》美股长期实际年化约6.5%–7%、有知有行 SBBI China 年报 A股 2005–2025 实际年化约8.1%；复核日期 2026-11-21。」
- **禁用句式**：不得写成「研究表明」/「历史平均」（check:data 组 I 负向断言锚定 chainNominal.scope 含「假设」）。

### ⑤ README 9,000 算例（算例 B）—— 锚（现状即裁定落地态）

- **现值锚点**：README.md:101 / en:101（如实给出 1.0 万/月、不按 0.9 万修正）；ReversePanel.tsx:35-42（算例 B 输入 600 万−120 万房 → 4,800,000÷480）；三语 exampleBNote zh-CN.ts:283 / zh-Hant.ts:255 / en.ts:315。
- **目标值**：零改动。独立复算：6,000,000−1,200,000=4,800,000；4,800,000÷480=**10,000.00**（本会话 node 实算）。atlas-brief:111「更正示例」已在三语 + README + 面板注四处落地（audit §5）。
- **来源句式**：工具值为推导值（480 法则算术），不引外部来源；文案保留「原视频称约 0.9 万/月……不按 0.9 万修正」差异注（check:data 组 H 锚定）。

### ⑥ tooltip 口径句 0–18 岁 vs 0–17 岁 —— 改（三语 4 键，见 §5）

- **现值锚点**：childCostTooltip（zh-CN.ts:67 / zh-Hant.ts:61 / en.ts:76-77）与 childCountHint（zh-CN.ts:65 / zh-Hant.ts:59 / en.ts:73-74）均写「0–18 岁」；报告原文与展示层（insights.ts:149、childShort 三语）均为 0–17 岁。healthReserveTooltip / childCountTooltip / 反向面板与积累面板 tooltip 无口径差，不动。
- **目标值**：统一为报告 0–17 岁口径，保留「养到成年」习惯说法并按 research-source-evidence §2 注明边界语义（0–17 岁 = 抚养到刚年满 18 岁前）；monthlyExpenseTooltip（zh-CN.ts:60 / zh-Hant.ts:54 / en.ts:65-66）补一句默认值口径注与 ① 联动。新文案逐键见 §5。
- **来源句式**：同 ② 成品句 2 的口径短语「0–17岁……（即养至刚年满18岁前）」。

### ⑦ 「420 乘数」—— 锚（从未进入代码，登记无关命中防误改）

- **现值锚点**：唯一乘数语境命中 atlas-brief:106「转录错误｜不引用」，裁定已落实；CSS/税档/字节数等 18 处子串命中与乘数无关（audit §7 逐点登记）。
- **目标值**：零改动。任何文件不得引入 420 作为乘数（check:data 不为其设断言——为不存在的值设锁反而是误导；仅在本节登记语义）。

### ⑧ check-share 断言先例 —— 锚（结构先例，扩展见 §4）

- **现值锚点**：scripts/check-share.mjs（六组断言，本会话实跑 `node scripts/check-share.mjs` → 「六组断言全部通过」exit 0）；`package.json` `check:share` 接线；check-currency.mjs 同构先例（实跑五组全过）。
- **目标值**：check-share 本体零改动；其结构骨架（头注登记 spec 出处与零依赖声明 → loadModule esbuild 转译 → 夹具 → node:assert 分组断言 → 临时目录清理 → 一句汇总）被 scripts/check-data.mjs 复制（§4）。

**校准项数：8（改 4：①②③⑥；锚 4：④⑤⑦⑧）。**

---

## §2 育儿成本默认值裁定：保留 580,000 + 注释更正（不改值）

**裁定：保留数值 580,000 不变，落注释/文案属性更正。**「改值到 538,000」分支否决。理由：

1. **裁定先例**：atlas-brief:108 只要求「降级为可编辑示例值/历史预设，不标为报告原始结论」——缺陷在**归属标注**，不在数值本身；「保留示例值」是已冻结裁定允许态。
2. **回归面不成比例**：改值将同步击穿四层锁定锚——integration.rs 16 处 580000（audit §9：改默认须同步重锚）、check-share.mjs BASE_STATE :56/:64、check-currency.mjs:63、以及 README:126 反向估算演示数 ¥1,220,000 / ¥2,541.67 与对应**真实截图**（docs/assets/demo-reverse*.png 按仓库纪律为真实运行画面，改默认即需重算重摄全部关联截图）。
3. **双口径已在展示层并存**：面板⑨ childShort/childNote 已把报告原文 53.8 万（0–17 岁）与视频口径差异完整展示（三语 childVideoNote 逐条勘误）；用户可见的报告原文值不缺位，输入默认只是「可编辑示例」。
4. **§7 红线约束**：本轮「公式与数据流不碰、夹具数值不动」——改 costPerChild 虽不碰公式代码，但会改变首屏/反向默认演示结果数值与全部数值快照断言语境，违反本轮「零行为变化」目标。

**更正落点（数值零变更）**：
- defaults.ts:35 注释 → 「每孩总抚养成本（元）：**视频口径示例值 58 万**（非《中国生育成本报告 2024 版》原文值——原文 0–17 岁全国平均 53.8 万，见面板⑨）；保留为可编辑示例」；
- defaults.ts:81（REVERSE_ESTIMATE_DEFAULTS 头注「childReserve 沿用 1 孩成本」处）与 `:84` 行尾注释补同属性短语；
- presets.ts:59 note → 「……1 孩抚养成本按 58 万整理（视频口径示例值；报告原文 0–17 岁平均 53.8 万，见面板⑨）。可自由修改。」；
- README.md:288 / en:284 免责句拆分归属（§6-2）。

**「若改值」分支的 README 数字重算清单（否决存档，不执行）**：README:41 临界值 163.5 万与精确口径 166.4 万不变（childCount=0，育儿值不入式）；README:86 养老金案例「一次性预留 20 万」不变；README:96 场景对比参考线不变；**受影响的仅 README:126**（反向默认 200 万−58 万−20 万=122 万 → ¥2,541.67 变为 126.2 万 → ¥2,629.17）与 demo-reverse*.png 截图。此清单证明改值收益（一个注释能说清的事）远低于成本，故否决。

---

## §3 数据字典 docs/data-dictionary.md 设计（本轮只设计，文件随实施创建）

**定位**：全仓数据层默认值与展示数据的唯一人读台账；check:data（§4）是其机读镜像，两处键一一映射（字典每行带「门禁组」列指向 check:data 断言组）。

**结构（五段）**：
1. **头注**：用途、复核节奏（NBS 年度收支每年 1 月；社保基金会年报每年 8–10 月，注意 7.62% 传导；SBBI China 年报约每年 4 月；育娲报告不定期——research-source-evidence §5）、引用句式模板（§5 成品句 1–4 引用）、与 presets.note / insights.ts「简中数据口径不入 i18n」惯例的关系（presets.ts:4-5、insights.ts:7）。
2. **计算输入默认值表**（src/data/defaults.ts + presets.ts + pensionParams.ts）：列 = 键/常量｜落点 file:line｜现值｜口径与来源摘要｜核证等级（official/media/video/工程参数）｜引用句式编号｜复核节奏｜check:data 组。必收行：monthlyExpense 2990（①，official）；costPerChild 580000（②，video-示例值）；healthReserve 200000（视频估算，保守区间 15–50 万语境，insights.ts:164-169）；nominalReturnPct 4.5 / inflationPct 2.0（④，video-假设）；MC std 12 / inflationStd 1（工程参数，p2-spec §2.4 语境）；percent.realReturnAssumpPct 2.5（派生 4.5−2.0，defaults.ts:127-131）；threshold 五参数（研究默认，p2-spec §2.4）；PENSION_AVG_WAGE_ANCHOR_CNY 10343（pensionParams.ts:49，全国口径锚点）；presets 四画像 monthlyExpense 与消费构成（presets.ts:42,49,56,63 一线/低线整理口径）；LOAN_DEFAULTS / RENTAL_DEFAULTS / TAX_ESTIMATE_DEFAULTS（标注「占位」属性，defaults.ts:91,99,152）；ACCUMULATION targetValue 1,635,200（联动派生值）。
3. **展示数据表**（insights.ts 全量：假设链条 9 环 + 市场消费 2 条 + 育儿地区 4 条 + 医疗 2 条）：列同上，核证等级列直接沿用 InsightVerification 三级；本表须逐行标「不参与计算」（insights.ts:9 纪律）。
4. **离线快照表**：FX_RATE_SNAPSHOT 六币种（defaults.ts:211-228，时点 2026-11-20 冻结属性）。
5. **写作指引**：引用句式模板全文（research-source-evidence §5）+ 禁用句式清单 + 「引用『最新』时用 7.62%」等更新口径指引。

**纪律**：字典只登记、不赋新值；每行必须带 file:line 锚点与「复核日期 2026-11-21」（首建基线）；后续改默认值的 PR 必须同时改字典行 + check:data 断言（三处同步：defaults.ts → 字典 → 断言），这条写进字典头注。

---

## §4 check:data 设计（scripts/check-data.mjs，仿 check-share 先例）

**接线**：package.json scripts 增 `"check:data": "node scripts/check-data.mjs"`（check-size/check-currency/check-share/check-a11y 同区）。**零新依赖**：复用 esbuild `transformSync`（check-share.mjs:33-40 loadModule 同构）；i18n 与纯数据模块转译后动态 import；defaults.ts 的唯一运行时值导入 pensionParams.ts 按同相对路径一并转译进同一临时目录（import 说明符 "./pensionParams" 在临时目录内可解析）。头部 docblock 登记：本 spec §4 出处、零依赖声明、九组断言预告、独立推导注释纪律。

**夹具与加载**：BASE夹具直接 import 转译后的 defaults/presets/insights 模块常量（BASELINE_DEFAULTS、MONTE_CARLO_DEFAULTS、MONTE_CARLO_STRATEGY_DEFAULTS、ACCUMULATION_DEFAULTS、PRESET_PROFILES、INSIGHT_MARKET_ENTRIES、INSIGHT_CHILD_COST_REGIONS、链条数组）；README 与源码注释类断言用 readFileSync + 正则（不执行、只锚定文本落位）。全部期望值**在注释中独立推导**（写明算式，不许「魔法期望数」）。

**九组断言（断言组数 = 9）**：

| 组 | 断言内容（期望值 = 独立推导，本会话已 node 实算闭合） | 推导注释要点 |
| --- | --- | --- |
| A 消费口径 | `29476/12=2456.33…→2456`、`35869/12=2989.08…→2989`：INSIGHT_MARKET_ENTRIES[0].value 含 "2,456" 且含 "29,476"；[1] 含 "2,989"、"35,869"、"2,990" 且 scope 含 "取整"；三语 marketNote 含 "2,990" 与 "取整"；README.md 含 "35,869" 且**不含** "34,557"，README.en.md 同 | 官方仅发年值；折月=年值÷12 派生 |
| B 480 与首屏临界 | `12/0.025===480` 严格相等；`BASELINE_DEFAULTS.monthlyExpense*480+BASELINE_DEFAULTS.healthReserve===1635200` 且 `===ACCUMULATION_DEFAULTS.targetValue` | 2990×480=1,435,200；+200,000=1,635,200 |
| C MC 年支出 | `MONTE_CARLO_DEFAULTS.annualSpend===2990*12 && ===35880` | 2990×12=35,880 |
| D 费雪双口径 | `12/(0.045-0.02)===480`（近似口径）；`Math.abs(12/((1.045/1.02)-1)-489.6)<0.01`（实测 489.6000000000017）；`Math.abs(2990*fisher+200000-1663904)<1`（实测 1,663,904.0000000051，README:55 锚）；`percent.realReturnAssumpPct===4.5-2.0===2.5` | 近似 r=n−i vs 精确 (1+n)/(1+i)−1 |
| E 预设自洽 | 四画像 breakdown 五项和 === monthlyExpense（4500/8000/11000/2000，逐画像断言）；四画像 costPerChild===580000 | presets.ts:42,49,56,63 注释和式 |
| F 育儿双口径标注 | defaults.ts 源码正则：costPerChild: 580000 所在行±2 行含 "视频口径"；presets family note 含 "53.8"；INSIGHT_CHILD_COST_REGIONS 全国 costWan===53.8；三语 basic.childCostTooltip 与 basic.childCountHint 含 "0–17" 且不含 "0–18"；三语全键扁平扫描无 "0–18" 残留；README.md:288 行含 "53.8" | 0–17 岁=抚养到刚年满 18 岁前 |
| G 社保环锚定 | chainSsf value==="7.39%"、verification==="official"、source 含 "2024"、scope 含 "至 2024 年末" 与 "7.62"；负向：scope 不含 "最新"；insights 全串负向正则 `/预期收益.*7\.39\|7\.39.*你的\|帮你赚到/` 零命中 | value 与 source 必须同源；更新口径另注 |
| H 算例 B 更正 | 三语 exampleBNote：zh 含 "1.0 万" 与 "0.9 万"，en 含 "10,000" 与 "9,000"；推导注释 `6000000-1200000=4800000; 4800000/480===10000` | 480 法则直除复算视频差额 |
| I 假设区间标注 | chainNominal verification==="video"、source 含 "假设"、scope 不含 "研究表明" 且不含 "历史平均"；BASELINE_DEFAULTS.nominalReturnPct===4.5；三语 coreParams 折叠头文案含 "4.5%" | 4%–4.5% 是假设非文献结论 |

**输出与退出**：成功打印一句汇总（如 `[check-data] 九组断言全部通过：消费口径/480/年支出/费雪/预设/育儿标注/社保环/算例B/假设区间`）；失败逐条带「断言 N 失败：」定位消息；try/catch 双路径 rmSync 清理临时目录（check-share.mjs:253-257 同构）。**只增不改**：不触碰 check-share / check-currency 断言本体。

---

## §5 文案改动清单（i18n 三语逐键；只改值，不改键——三语键集保持一致）

| # | 键 | 语言·锚点 | 现文案（摘） | 新文案（全文） |
| --- | --- | --- | --- | --- |
| 1 | basic.monthlyExpenseTooltip | zh-CN.ts:60 | 「……是整条参考线的锚点。」 | 「你在当前生活方式下的平均每月总支出，是整条参考线的锚点。默认值参考国家统计局城镇居民人均消费支出口径取整。」 |
| | | zh-Hant.ts:54 | 「……是整條參考線的錨點。」 | 「你在當前生活方式下的平均每月總支出，是整條參考線的錨點。默認值參考國家統計局城鎮居民人均消費支出口徑取整。」 |
| | | en.ts:65-66 | 「…anchor of the whole reference line.」 | 「Your average total monthly spending under your current lifestyle; it is the anchor of the whole reference line. The default is rounded from the NBS urban per-capita consumption figure.」 |
| 2 | basic.childCountHint | zh-CN.ts:65 | 「0–18 岁累计抚养成本口径，见「单孩成本」。」 | 「0–17 岁累计抚养成本口径（养至刚年满 18 岁前），见「单孩成本」。」 |
| | | zh-Hant.ts:59 | 「0–18 歲累計撫養成本口徑……」 | 「0–17 歲累計撫養成本口徑（養至剛年滿 18 歲前），見「單孩成本」。」 |
| | | en.ts:73-74 | 「…for ages 0–18; see "Cost per child".」 | 「Cumulative child-raising cost for ages 0–17 (through the day before the 18th birthday); see “Cost per child”.」 |
| 3 | basic.childCostTooltip | zh-CN.ts:67 | 「把一个孩子养到成年（0–18 岁累计口径）所需的总花费。」 | 「把一个孩子养到成年（报告口径为 0–17 岁累计，即养至刚年满 18 岁前）所需的总花费。」 |
| | | zh-Hant.ts:61 | 「……（0–18 歲累計口徑）……」 | 「把一個孩子養到成年（報告口徑為 0–17 歲累計，即養至剛年滿 18 歲前）所需的總花費。」 |
| | | en.ts:76-77 | 「…(cumulative for ages 0–18).」 | 「The total cost of raising one child to adulthood (report basis: cumulative for ages 0–17, through the day before the 18th birthday).」 |
| 4 | insights（数据层简中，非 i18n——insights.ts:7 惯例） | insights.ts:76 scope | 「基金自成立以来年均投资收益率（累计投资收益额 19,009.98 亿元）；机构组合层面历史平均值，不代表个人账户实际可得收益」 | 「基金自成立以来至 2024 年末年均投资收益率（累计投资收益额 19,009.98 亿元）；机构组合层面历史平均值，不代表个人账户实际可得收益。2025 年报更新口径：成立以来年均 7.62%（截至 2025 年末，2026-09-01 发布）」 |

不改键登记：childCountTooltip（zh-CN:64 / zh-Hant:58 / en:71-72，无年龄字样）、childCostHint（−15% 已带视频口径标注，§1⑥ 裁定保持）、反向面板 healthReserveTooltip / childReserveTooltip、积累面板 monthlyExpenseTooltip（通胀上行句无口径差）——四类均零改动。键集零增零删（check:share 断言 5 与 check:data 组 F 双闸校验）。

---

## §6 README 更正清单（README.md 与 README.en.md 逐行同步）

| # | 锚点 | 现状 | 更正 |
| --- | --- | --- | --- |
| 1 | README.md:263 / en:259 来源表行 | 「国家统计局《**2024 年**居民收入和消费支出情况》（2025-01-17 发布）……34,557 元/年 ≈ 2,880 元/月（默认月开销 2,990 的参考口径）」 | 整行替换为 2025 年口径：「国家统计局《2025年居民收入和消费支出情况》（2026-01-19 发布，2026-11-21 复核）｜城镇人均消费支出 35,869 元/年 ≈ 2,989 元/月、全国 29,476 元/年 ≈ 2,456 元/月（折月值为年值÷12 的派生算术；默认月开销 2,990 即参考城镇口径取整到十位）」。en 同步（35,869 yuan/year ≈ 2,989 yuan/month; 29,476 ≈ 2,456; rounded from the urban figure）。引用句式 = §1① 成品句 1 |
| 2 | README.md:288 / en:284 默认值免责句 | 「所有默认值（月开销 2,990、每孩 58 万、健康预留 20 万、名义 4.5%、通胀 2.0%）是公开统计整理的参考口径……」 | 拆分归属：「所有默认值是参考口径整理、不是对任何个人情况的建议：月开销 2,990（国家统计局 2025 年城镇口径取整）、健康预留 20 万、名义 4.5% / 通胀 2.0%（规划假设，非文献结论）；**每孩 58 万为原视频口径示例值**（《中国生育成本报告 2024 版》原文 0–17 岁全国平均 53.8 万，应用内面板⑨逐条对照）；请按自身情况调整。」en 同步（580k per child is the video-claim sample value; the report's original figure averages 538k for ages 0–17…） |
| 3 | README.md:101 / en:101 算例 B 行 | 「如实给出 1.0 万/月、不按 0.9 万修正」 | **不动**（基准锚点，§1⑤） |
| 4 | README.md:41,67,86,111,121,126,163 / en 对应行 | 2,990 / 163.5 万 / 7.39% 链条描述等 | **不动**（与默认值同源，无口径差；7.39% 描述未称「最新」，合规） |

不新增章节、不改截图、不重排目录——本轮 README 只动 §6-1、§6-2 共 4 行（两语各 2 行）。

---

## §7 回归红线

1. **S1–S26 签名元素零回退**（atlas-brief:7「签名元素 S1–S26 零回退是全程红线」、:28；design-language.md §2 五要素登记）：本轮零 TSX / 零 CSS 改动，验收以 `git diff --stat` 证明 `src/components/**`、`src/styles/**` 零变更。
2. **公式与数据流不碰**：`src/wasm/**`（Rust 核心与 bridge）、`src/store/useCalculatorStore.ts`、`src/services/share.ts` 零变更（git diff 为空）；insights.ts 属展示数据层、依 insights.ts:9 纪律本就不被 wasm 引用，其字符串改动不构成数据流变更；defaults.ts / presets.ts **只改注释与字符串，数值零变更**——integration.rs 48 锚（480/1,635,200/2990/580000/4.5）、check-share BASE_STATE、check-currency 夹因数值全部天然保持有效。
3. **门禁不放宽**：check-size 硬限 2,000,000 B / wasm 800,000 B 不动（check-size.mjs:29-30）；check:share 六组、check:currency 五组原样通过（本会话 HEAD 实跑通过）；新增 check:data 为**只增**门禁。`npm run build`（含 tsc --noEmit）必须通过。
4. **i18n 键集零增零删**：三语键集一致由 check:share 断言 5 持续守护；本轮只改既有键的值。
5. **文档零禁词**：本轮新增/改动的全部 docs/*.md 过禁词扫描（验收 #6）。

---

## §8 验收 checklist

- [x] 1. `node scripts/check-data.mjs` exit 0，九组断言全过（§4）。（验收轮实跑：「九组断言全部通过：消费口径/480/年支出/费雪/预设/育儿标注/社保环/算例B/假设区间」exit 0）
- [x] 2. `node scripts/check-share.mjs` 仍六组全过（本会话 HEAD 基线：通过）。（验收轮实跑：六组全过 exit 0）
- [x] 3. `node scripts/check-currency.mjs` 仍五组全过（本会话 HEAD 基线：通过）。（验收轮实跑：五组全过 exit 0）
- [x] 4. `npm run build` 通过（tsc --noEmit 零错误）。（验收轮实跑 exit 0）
- [x] 5. `npm run build && node scripts/check-size.mjs` 通过，且 dist 总量 ≤ 1,974,485 B（现值 1,973,485 B + §9 预算 1.0 KB）。（验收轮实跑通过：dist 14 文件 1,974,146 B ≤ 1,974,485 B，wasm 387,792 B ≤ 800,000 B；文件数 15→14 勘误见 §10.5-6）
- [x] 6. 禁词扫描零命中：`grep -rinE "<任务书禁词表 13 词原样拼接，| 分隔>" docs/wf01-spec.md docs/data-dictionary.md`——正则词表以任务书铁律原文为准，本文不复写（词表逐字入文会自证命中；实现会话从任务书复制词表替换占位符后执行，期望输出为空、grep exit 1）。（验收轮实跑：验收会话从任务书原样取词表执行，覆盖 wf01-spec / data-dictionary / design-atlas-brief / README 双语 / check-data.mjs 六文件，零命中 exit 1；另以 scripts/check-naming.mjs 同词表扫 src/ 零命中 exit 0）
- [x] 7. `git diff --stat` 证明 `src/wasm/**`、`src/store/**`、`src/services/**`、`src/components/**`、`src/styles/**` 零变更；src/ 内变更仅 defaults.ts（注释）、presets.ts（注释/note）、insights.ts（scope 串）、i18n 三语（4 键值）。（验收轮实跑：红线五目录 diff 为空；src/ 变更 diff --stat 逐行核对与左述一致）
- [x] 8. `grep -n "0–18" src/i18n/locales/*.ts` 零命中（三语 tooltip 口径统一完成）。（验收轮实跑：零命中 exit 1）
- [x] 9. README.md 与 README.en.md §6 清单 4 行落位且逐行对应（35,869/2,989/29,476/2,456 在位、34,557/2,880 清零；58 万属性句在位）。（验收轮实跑：四行 grep 逐项在位；34,557/2,880 双语 grep 零命中；git diff 仅 263/288 与 259/284 两行）
- [x] 10. `cargo test`（src/wasm）68 项全绿（15 lib + 53 integration，夹具未动零回退）。（验收轮实跑：**75 项全绿 0 failed——15 lib + 60 integration**；integration 计数较起草期基线增至 60，勘误见 §10.5-5）
- [x] 11. docs/data-dictionary.md 建立，每行带 file:line 锚点 + 复核日期 + check:data 组映射列。（三表共 31 行逐行带锚点与 2026-11-21 复核列）
- [x] 12. 三语 locale 键集一致（check:share 断言 5 通过即证），本轮零新增键。（验收轮 check:share 通过即证）
- [x] 13. insights.ts:76 新 scope 含「至 2024 年末」与「7.62」，且不含「最新」（check:data 组 G）。（验收轮组 G 通过即证）
- [x] 14. presets 四画像消费构成和 === monthlyExpense（check:data 组 E）。（验收轮组 E 通过即证）

---

## §9 尺寸预算

**前提勘误（以实测为准，沿 p7-spec:343 先例）**：任务书所给「现余量 ~70KB」无法在本仓复现。本会话实测（dist 为 HEAD a1fce20 后的新鲜构建，构建时间 20:08 晚于提交时间 20:07；量测命令 = 遍历 dist/ 累加 statSync().size）：**dist 15 文件合计 1,973,485 B，对 2,000,000 B 硬门禁余量 26,515 B（≈26 KB）**；最近在案记录 p7-spec:483 为 1,972,455 B / 余量 27,545 B，两者一致（差 1,030 B 为其后的文档冻结轮增量）。§9 预算按实测余量 26,515 B 计盘；若实施会话复测显著偏离，以复测为准并回写本节。

| 项 | 预算 | 说明 |
| --- | --- | --- |
| i18n 三语 4 键改写（§5-1/2/3 ×3 locale） | ≤ +0.6 KB | 净增字符量小（两键改写、一键加句），进 JS bundle 原始字节 |
| insights.ts chainSsf scope 扩句（§5-4） | ≤ +0.4 KB | 简中数据串，随 bundle；仅 zh 单份（数据层不入 i18n） |
| defaults.ts / presets.ts 注释更正（§2） | 0 B | 注释构建期剥离，不进 dist |
| docs/wf01-spec.md、docs/data-dictionary.md、scripts/check-data.mjs、package.json | 0 B | 不进 dist（scripts 与 docs 不参与打包） |
| **dist 增量合计** | **≤ +1.0 KB** | 占实测余量 26,515 B 的 3.8% |
| 硬门禁（不放宽） | dist 2,000,000 B / wasm 800,000 B | check-size.mjs:29-30；交付前实跑复测（验收 #5） |
| wasm 单项 | 0 B（预期） | 本轮不触 src/wasm/**，预算按零计、复测兜底 |

---

## §10 实施结果（2026-11-21 验收轮登记）

> 本节由验收会话在实现落盘后的独立复跑轮登记：**全部门禁为验收轮现场实跑**（非转录前轮记录）；行号锚点均以验收轮工作树为准。三处实施偏差的机读侧登记在 `scripts/check-data.mjs:31-37` 头部偏差注，人读侧同步在 `docs/data-dictionary.md:60` 勘误行并指向本节。

### §10.1 改动文件清单

改动 9（`git diff --stat` 实测：19 insertions / 18 deletions）+ 新增 6（git untracked）：

| 文件 | 改动量 | 内容（验收轮行号） | spec 出处 |
| --- | --- | --- | --- |
| README.md | 2 行 | :263 来源表行落 2025 年口径；:288 默认值免责句拆分归属 | §6-1 / §6-2 |
| README.en.md | 2 行 | :259 / :284 与中文逐行同步 | §6-1 / §6-2 |
| package.json | +1 行 | :14 `"check:data": "node scripts/check-data.mjs"` 接线 | §4 |
| src/data/defaults.ts | 3 行 | :35 costPerChild 注释、:81 反向面板头注、:84 childReserve 行尾注释——**数值零变更** | §2 |
| src/data/insights.ts | 1 行 | :76 chainSsf scope 补「至 2024 年末」与 7.62% 更新口径注 | §5-4 |
| src/data/presets.ts | 1 行 | :59 一孩 note 补「视频口径示例值；报告原文 53.8 万」对照 | §2 |
| src/i18n/locales/zh-CN.ts | 3 键值 | :60 monthlyExpenseTooltip / :65 childCountHint / :67 childCostTooltip | §5-1/2/3 |
| src/i18n/locales/zh-Hant.ts | 3 键值 | :54 / :59 / :61 同步 | §5-1/2/3 |
| src/i18n/locales/en.ts | 3 键值 | :65-66 / :73-74 / :76-77 同步 | §5-1/2/3 |

新增 6：
- `scripts/check-data.mjs`（356 行，九组断言，零新依赖复用 esbuild）；
- `docs/data-dictionary.md`（97 行，三表 31 行台账 + 写作指引）；
- `docs/wf01-spec.md`（本文件）；
- `docs/research-calibration-audit.md`、`docs/research-source-evidence.md`（研究输入，先于实施落盘，复核日期 2026-11-21）；
- `scripts/check-naming.mjs`（实施期追加：把原 node -e 内联的 src/ 域禁词扫描固化为正式门禁脚本，spec 未预列——登记见 §10.5-7）。

### §10.2 断言组数

- **check:data（本轮新增门禁）：九组 A–I**——消费口径 / 480 与首屏临界 / MC 年支出 / 费雪双口径 / 预设自洽 / 育儿双口径标注 / 社保环锚定 / 算例 B 更正 / 假设区间标注；静态 `assert` 语句 45 条（组 E 四画像循环、组 F/H 三语循环展开后运行时执行条数更多）。
- **既有门禁本体零改动**：check:share 六组、check:currency 五组原样复跑通过。
- **cargo test**：15 lib + 60 integration = **75 项**（计数勘误见 §10.5-5）。

### §10.3 门禁终态（验收轮 2026-11-21 全部现场实跑）

| 门禁 | 命令 | 终态 |
| --- | --- | --- |
| check:data | `node scripts/check-data.mjs` | **exit 0**，「九组断言全部通过：消费口径/480/年支出/费雪/预设/育儿标注/社保环/算例B/假设区间」 |
| check:share | `node scripts/check-share.mjs` | exit 0，六组全过（三语键集一致含在内） |
| check:currency | `node scripts/check-currency.mjs` | exit 0，五组全过 |
| build | `npm run build` | exit 0（tsc --noEmit 零错误） |
| check:size | `node scripts/check-size.mjs`（构建后） | exit 0：dist 14 文件 **1,974,146 B** ≤ 2,000,000 B（余量 25,854 B，亦 ≤ §9 预算上限 1,974,485 B）；wasm 387,792 B ≤ 800,000 B |
| cargo test | `cargo test`（src/wasm） | 75 passed / 0 failed / 0 ignored |
| 禁词扫描（docs 域） | `grep -rinE "<任务书禁词表 13 词>"` 于 wf01-spec / data-dictionary / design-atlas-brief / README.md / README.en.md / check-data.mjs | 零命中（grep exit 1；词表按铁律不在本文复写） |
| 禁词扫描（src 域） | `node scripts/check-naming.mjs "<同一 13 词表>"` | 「src/ 零禁词命中」exit 0 |
| 口径残留 | `grep -rn "0–18" src/i18n/locales/*.ts` | 零命中（exit 1） |
| 回归红线 | `git diff --stat -- src/wasm/ src/store/ src/services/ src/components/ src/styles/` | diff 为空（零变更） |

### §10.4 验收轮次

1. **起草期**（本文件「附」节登记）：HEAD 基线 check-share / check-currency 实跑、§4 全部期望值 node 独立推导、dist 余量实测（§9 勘误依据）。
2. **实施期**（工作树落盘轮）：§1/§2/§5/§6 改动落盘 + check-data 九组落码；三处实施偏差如实登记于 check-data 头注与字典勘误行。该轮的门禁运行记录不在验收会话直接可见，**以第 3 轮复跑为准**。
3. **验收轮**（本节）：§8 十四项全部现场实跑（逐项勾选并附实测值），全过；#5 与 #10 附计数勘误（§10.5）。

### §10.5 与 spec 的偏差与残留（全部如实登记）

1. **组 D 近似式容差**：spec 写 `12/(0.045-0.02)===480` 严格相等，IEEE-754 实测为 480.00000000000006，严格相等不成立——按表内「（近似口径）」语义落 1e-9 容差断言（check-data.mjs 头注偏差注 1）。
2. **组 A en 断言方式**：en marketNote 为英文文案（"rounded from…"），断言按 en 含 "rounded" 落锁；zh-CN / zh-Hant 仍断「取整」汉字（偏差注 2）。
3. **组 H 按 locale 断言**：zh-Hant 为逐词繁体（「萬」非「万」），三语分别断言（偏差注 3）。
4. **展示层计数勘误**：§3/§4 草拟时记「链条 9 环、医疗 2 条」，实况为**链条 10 环**（chainReal 与 chainMultiplier 各为一环）、**医疗 3 条**——字典 §二按「insights.ts 全量」纪律逐行登记实况（data-dictionary.md:60）。
5. **cargo test 计数勘误**：spec §8-10 预期 68 项（15 lib + 53 integration），验收轮实测 **75 项**（60 integration）。integration 增量发生在起草后、本轮之前的其他轮次，0 failed 无回退；按实测勾选并留注。
6. **dist 计数勘误**：§9 基线为 15 文件 1,973,485 B，验收轮实测 **14 文件 1,974,146 B**——净增 +661 B ≤ 预算 +1.0 KB，总量在硬限与预算上限内；文件数差 1 未逐文件归因（§9 基线为起草会话所摄快照，验收轮不复现 HEAD 构建核对清单，如实登记差异）。
7. **check-naming.mjs 追加**：spec 未预列；实施期把 src/ 域禁词扫描从 node -e 内联固化为正式脚本（用法 `node scripts/check-naming.mjs <禁词正则>`，退出码 0=通过），与 check:data 同批入库。
8. **残留待办**：无阻断残留。后续复核节奏已排程在字典头注（NBS 年度收支 2027-01；社保基金会年报每年 8–10 月注意 7.62% 传导；SBBI China 年报约每年 4 月；育娲报告不定期）。

---

## 附：本会话已执行的核验（起草期实跑记录）

1. `node scripts/check-share.mjs` → 「六组断言全部通过」exit 0。
2. `node scripts/check-currency.mjs` → 「五组样本断言全部通过」exit 0。
3. node 独立推导全部 §4 期望值：折月 2,456.33/2,989.08、480、489.6000000000017、1,663,904.0000000051、1,635,200、35,880、1,435,200、2,541.67（反向默认）、10,000（算例 B）、四画像 breakdown 和全等、SBBI 实际 8.1%/7.84%——与 README:55 面板锚与 research-source-evidence §1/§4 引值一致。
4. dist 余量实测：1,973,485 B → 余量 26,515 B（§9 勘误依据）。
5. 未执行项（如实登记）：`cargo test` 与 `npm run build` 留待实施会话（验收 #4/#5/#10 现场跑）；禁词扫描待本 spec 定稿后随验收 #6 执行（起草稿已自查行文，见下方扫描记录）。
