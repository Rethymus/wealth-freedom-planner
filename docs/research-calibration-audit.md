# 研究校准现状台账（8 项逐项审计）

> 性质：只读现状审计——逐项 grep 落点 + 现值 + 目标 + 证据；不含任何修改。
> 方法：全仓 `grep -rn`（范围 src / docs / README.md / README.en.md / scripts / index.html / public，排除 wasm/target 构建产物与 .mimosa 元数据），逐命中回读语境；§8 另实跑 `node scripts/check-share.mjs`。
> 落点计数口径：代码 / i18n / README / scripts / 测试的 file:line 锚点计入总数；docs/*.md 为裁定依据（引用不计入）；与校准无关的子串误命中单独登记、不计入。

## §1 消费口径 2,456 / 2,990 / 2990

- 命令：`grep -rn "2,456\|2,990\|2990" src docs README.md README.en.md scripts index.html public`（过滤后 **112 行命中**；其中 docs 依据 52 行）。
- 现值语义分三层，仓库内自洽：
  1. **面板口径注（报告原文值）**：`src/data/insights.ts:132`（全国 2,456 元/月 = 29,476/年）、`:139-142`（城镇 2,989 元/月 = 35,869/年，并注明「默认月开销 2,990 即参考此口径取整」）；三语镜像 zh-CN.ts:175 / zh-Hant.ts:163 / en.ts:193。
  2. **默认值（取整整数）**：`src/data/defaults.ts:31-33`（注释：按国家统计局城镇口径整理；首屏临界值 = 2990×480+200,000=1,635,200）、`:113,116`（MC 年支出 2990×12）、`:186`；WASM 测试夹具锚定同一值（integration.rs:80,750 等 32 处，含 480 乘数 / 1,635,200 临界值锚点）。
  3. **README 展示层**：README.md:41,67,86,111,163,288 与 en 对应行均用 2,990；**README.md:263 / en:259 来源表行仍是 2024 年数据（34,557 元/年 ≈ 2,880 元/月）**，与面板 2025 年口径（2,989→2,990）并存两个统计年份。
- 校验脚本侧：scripts/check-share.mjs:54,101、check-currency.mjs:63 夹具同步 2990。
- 目标：数值 2990 保持（取整口径已注明来源）；**README.md:263 来源表行与 insights 面板口径统一到 2025 年统计**（2,456/2,989/35,869），或在行内注明「面板默认采用 2025 年城镇口径取整」。
- 无关命中：research-video-data.md:84 东方财富 URL 内子串「2990」（非数据）。

## §2 育儿成本 58 万 / 580,000 / 53.8 万

- 现状存在**双口径并存**：
  1. **输入层默认 580,000（视频口径）**：defaults.ts:35（costPerChild，注释仅「每孩总抚养成本（元）」）、`:84`（childReserve）；presets.ts:43,50,57,64（四画像全部 580000）+ `:59`（note：「1 孩抚养成本按 58 万整理」）。
  2. **展示层 53.8 万（报告原文值）**：insights.ts:149（全国 0–17 岁 53.8；`:150-152` 上海 101 / 北京 93.6 / 西藏 34.9，逐条标注视频口径偏差）；三语 childShort / childNote / childVideoNote：zh-CN.ts:177,179,182,183 / en.ts:195,197,201,202 / zh-Hant.ts:165,166,168,169——childVideoNote 明示「视频 58 万与报告原文不一致…本面板采用报告原文值」。
  3. **测试与夹具**：integration.rs 16 处 580000；check-share.mjs:56,64；README.md:126,288 / en:126,284。
- 裁定依据：design-atlas-brief.md:108 已裁定「58 万降级为可编辑示例值/历史预设，不标为报告原始结论」；research-video-data.md:127,140 与 p3-spec.md:26 同口径。
- 目标：按已冻结裁定落实——defaults.ts:35 与 presets.ts 的 58 万**注明视频口径属性**（现状注释无标注），childCostTooltip 口径句与报告 0–17 岁对齐（见 §6）；数值 580000 可保留为可编辑示例值（atlas-brief 允许），但不得表述为报告原始结论（README.md:288 现把它列入「公开统计整理的参考口径」，与报告原文值关系需注明）。
- 无关命中：taxTables.ts:147,162（日本 58 万円基礎控除，非本项）。

## §3 社保基金 7.39%

- 命令：`grep -rn "7\.39\|739"`（过滤后代码/README 命中 5 锚点 + docs 依据 12 行；4 处子串误命中见尾注）。
- 现值：insights.ts:73-77（chainSsf，value "7.39%"，source 为社保基金会 2024 年报原文直读，scope 注明「机构组合历史平均，不代表个人账户可得收益」，verification=official）——链条第 4 环，仅作参照环、**不进计算**（README.md:163「视频口径条目不参与任何计算」；7.39 环为官方核证参照）。
- 其余落点均为文档/README 描述：README.md:101,163、README.en.md:101,158、p3-spec.md:22,164,924,927,933、design-atlas-brief.md:109（「仅作研究背景，不作个人收益默认」）、research-video-data.md:31-36,123,147。
- 目标：现状已满足裁定（不作默认、带标注）；无需改动，列为**基准锚点**。

## §4 4.5% 名义回报默认值

- 默认值分布（`grep "nominalReturn"` + `grep "4\.5%"`）：
  - defaults.ts:38（BASELINE）、`:87`（REVERSE）、`:117-118`（MC mean 4.5/std 12）、`:188`（ACC mean）。
  - 折叠头默认值提示：zh-CN.ts:74 / zh-Hant.ts:68 / en.ts:88（「默认 名义 4.5% / 通胀 2%」，p3-spec.md:1001,1112 记载该文案以 defaults.ts 实际值为准）。
  - 公式体/算例文案：zh-CN.ts:148,279,281（en:165,311,313；zh-Hant:139,253,254 同步）。
  - insights 链条环：insights.ts:97（「4%–4.5%（本工具默认 4.5%）」，verification=video）+ `:116`（费雪复算 2%–2.5%）。
  - 夹具/测试：check-share.mjs:59,67,86,87,103,104；integration.rs:975,1045。
  - README：md:38,91,101,121,126,288 / en:38,91,101,121,284。
- 校准属性：4.5% 为**视频口径假设**（research-video-data.md:60「无对应权威单一来源→假设口径」）；仓库已按 design-atlas-brief.md:110（「提供假设区间并允许调整，注明非推导均值」）落实——链条环带 video 标签、README.md:288 免责句声明。
- 相邻校准：README.md:126 已并列 Morningstar 2026 起始支取率 3.9% 作外部参照。
- 目标：现状合规；**保持 4.5 默认 + 视频口径标注**，无需改值。

## §5 README 9,000 算例（算例 B）

- 现值：README.md:101 / README.en.md:101——算例 B「原视频称约 0.9 万/月（含约 10% 不可复算折让），本工具按同一口径如实给出 1.0 万/月、不按 0.9 万修正」。
- 工具实际计算值为 **10,000.00**：ReversePanel.tsx:35-42 算例 B 输入（600 万−120 万房）→ 480 万÷480；注释 `:22` 与口径注 `:143`（FieldTip 拼接 exampleNote+exampleBNote）明示差异。
- 三语文案：zh-CN.ts:283 / zh-Hant.ts:255 / en.ts:315（exampleBNote）。裁定链：research-video-data.md:107（复算）→ design-atlas-brief.md:111（「更正示例」）→ p3-spec.md:54,1108（断言 10,000.00 非 ≈9,000）。
- 目标：现状即裁定落地态（README、面板、三语一致）；无需改动，列为基准锚点。

## §6 月开销 / 健康 / 育儿 tooltip 现文案

- 基础面板（zh-CN.ts / en.ts / zh-Hant.ts）：
  - monthlyExpenseTooltip：:60 / en:65-66 / :54——「当前生活方式下平均每月总支出，是整条参考线的锚点」（无口径来源注）。
  - childCountTooltip：:64 / en:71-72 / :58；childCountHint：en:73-74（「0–18 岁累计抚养成本口径」）。
  - childCostTooltip：:67 / en:76-77 / :61——「把一个孩子养到成年（**0–18 岁**累计口径）」。
  - childCostHint：:68 / en:78-79 / :62——「每多一孩约降 15%（视频口径默认忽略）」。
  - healthReserveTooltip：:70 / en:81-82 / :64——「大病、长期护理等医疗支出一次性预留」。
- 反向面板：healthReserveTooltip zh:258 / en:285-286 / :232；childReserveTooltip zh:268 / en:298-300 / :242（「从总资产划出、不参与每月可花计算」）。
- 积累面板：monthlyExpenseTooltip zh:508 / en:571-573 / :463（「自第 1 年起随通胀上行」）。
- **发现的不一致**：childCostTooltip / childCountHint 说 **0–18 岁**，而报告原文与展示层（childShort/childNote、insights.ts:149「0–17 岁平均 53.8」）均为 **0–17 岁**——tooltip 口径句与数据层差 1 岁，需统一。
- 目标：①统一 0–17 岁（或双口径注明：tooltip 语境是「养到成年」习惯说法、面板数字为报告 0–17 岁值）；②monthlyExpenseTooltip 可选补一句「默认值参考城镇口径取整」与 §1 联动；③childCostHint −15% 已带视频口径标注，保持。

## §7 「420 乘数」语境（区分无关命中）

- 唯一乘数语境命中：**docs/design-atlas-brief.md:106**——「神秘乘数 420 | 转录错误 | 不引用」。research-video-data.md 全文无 420；面板/计算/测试零命中 → 420 从未进入代码，裁定「不引用」已落实。
- CSS/布局命中（与乘数无关，登记区分、不动）：`style={{ maxWidth: 420 }}` ×3——AccumulationPanel.tsx:530,544、MonteCarloPanel.tsx:880。
- 其余无关子串命中（18 处，均不动）：税档 420,000 元（taxTables.ts:33,44）、人均 GDP 54200 子串（regional.ts:77）、−420B 字节数（global.css:1338、p6-spec.md:356,444）、文档行数引用（research-ui-trends.md:5,406「420 行草稿」）、CSS 行号区间引用（global.css:399-420 / :420-425，见 research-a11y.md:41,284、research-fintech-ui.md:15,86,134,166、research-responsive.md:14、p0-spec.md:643、p6-spec.md:31,76,242）、PANTONE 11-4201（research-ui-trends.md:21）。

## §8 check-share 断言先例结构（scripts/check-share.mjs）

- **实跑验证**：`node scripts/check-share.mjs` → 输出「六组断言全部通过」，exit 0（本会话执行）。
- 结构骨架（新断言脚本可复制的先例，1 文件锚 + package.json:12 的 `check:share`）：
  1. 头部 docblock：登记 spec 出处（p7-spec.md §3.9）、零新依赖声明、断言清单预告（check-share.mjs:1-21）。
  2. `loadModule(rel, name)`：readFileSync 源码 → esbuild `transformSync`（ts→esm, es2020）→ mkdtemp 临时目录写出 → 动态 import（:33-40）——纯函数模块零运行时依赖路径。
  3. `BASE_STATE` 夹具：与 store 各业务切片一一对应、数值全有限数（:52-123）。
  4. 断言组 0–6 全在 `try` 内，node:assert/strict，每条带「断言 N 失败：…」定位消息（:130-252）：往返深相等（:134-163）→ 缺键整体 null（:165-177）→ 版本闸（:179-185）→ 枚举外拒绝 + 遗留值规范化信号（:187-205）→ 三语键集一致 + 新键在位（:207-247）→ 改写键抽查（:249-251）。
  5. `catch` 与成功路径均 `rmSync` 清理临时目录（:253-257）；成功输出一句汇总（:254）。
- 更早先例 scripts/check-currency.mjs 同构（其头注 :4 自证先例链）；两者经 package.json `check:*` 脚本接线。

## §9 落点汇总表（文件 × 项 × 改法）

改法图例：A=改文案/注释（校准标注）｜B=改数值/同步夹具｜C=保持不动（已合规/无关）｜D=统一口径。

| 文件 | 项 | 锚点 | 改法 |
| --- | --- | --- | --- |
| src/data/defaults.ts | ①②④ | :31-33,:35,:38,:84,:87,:113,:116,:186,:117-118,:188 | ①④ C；② A（:35/:84 补「视频口径示例值」注释，数值按 atlas-brief:108 可保留） |
| src/data/presets.ts | ② | :43,:50,:57,:59,:64 | A（:59 note 已注「按 58 万整理」，可补 53.8 万对照句） |
| src/data/insights.ts | ①②③④ | :73-77,:97,:116,:132,:142,:149 | C（报告原文值 + 三级核证标注，基准锚点） |
| src/i18n/locales/zh-CN.ts | ①②④⑤⑥ | :60,:64,:67,:68,:70,:74,:148,:175,:177,:179,:182,:183,:258,:268,:279,:281,:283,:508 | ⑥ D（:67/:68「0–18 岁」→与报告 0–17 岁对齐）；①②④⑤ C |
| src/i18n/locales/zh-Hant.ts | ①②④⑤⑥ | :54,:58,:61,:62,:64,:68,:139,:163,:165,:166,:168,:169,:232,:242,:253,:254,:255,:463 | 同 zh-CN（:61/:62 D，余 C） |
| src/i18n/locales/en.ts | ①②④⑤⑥ | :65,:71,:73,:76,:78,:81,:88,:165,:193,:195,:197,:201,:202,:285,:298,:311,:313,:315,:571 | 同 zh-CN（:76/:78 D，余 C） |
| src/components/advanced/ReversePanel.tsx | ⑤⑦ | :22,:143,:35-42,:530,:544 | ⑤ C（10,000 差异注完整）；⑦ C（maxWidth 420 为布局） |
| src/components/advanced/MonteCarloPanel.tsx | ⑦ | :880 | C（布局命中） |
| README.md | ①②③④⑤ | :38,:41,:67,:86,:91,:101,:111,:121,:126,:163,:263,:288,:101(⑤) | ① D（:263 来源表 2024 行与 2025 面板口径统一/注明）；② A（:288「每孩 58 万」注明视频口径示例值属性）；余 C |
| README.en.md | ①②③④⑤ | :38,:41,:67,:86,:91,:101,:111,:121,:126,:158,:259,:284 | 与 README.md 同步 |
| scripts/check-share.mjs | ①②④⑧ | :52-123 夹具（:54,:56,:59,:64,:67,:86-87,:101,:103-104）；结构 :1-40,:130-257 | ⑧ C（先例本体）；①②④ B——若 §2 裁定改默认数值则夹具同步 |
| scripts/check-currency.mjs | ① | :63 | C（夹具与默认同源） |
| src/wasm/tests/integration.rs | ①②④ | :4,:74-103,:125,:750,:1020-1049,:1092-1197,:1215-1261（48 锚） | C——480/1,635,200/2990/580000/4.5 为锁定锚点，改默认须同步重锚 |
| src/styles/global.css | ⑦ | :1338 | C（字节数子串） |
| src/data/taxTables.ts / regional.ts | ⑦②(无关) | tax:33,44,147,162；regional:77 | C（税档/58 万円/GDP 子串，均无关） |

docs 依据（不计入落点）：design-atlas-brief.md:105-114（§五校准清单裁定）、research-video-data.md:56-107,127-147、p3-spec.md:22-32,54,924-986,1108-1112、p0/p1/p7-spec 夹具镜像、research-model-audit.md:127-172。

## 落点总数与结论

- **落点总数：182**（§1=60，§2=42，§3=5，§4=38，§5=7，§6=25，§7=3，§8=2；docs 依据与 19 处无关子串命中不计入）。
- **结论一**：8 项中 5 项（③7.39%、④4.5%、⑤9,000 算例、⑦420、⑧check-share）现状已与仓库冻结裁定一致，属「保持不动」；仅 §6「0–18 岁 vs 0–17 岁」tooltip 口径差与 §1 README.md:263 来源表 2024 年份是明确的待改点（共 3 个文件 6 行内）。
- **结论二**：§2 育儿成本是唯一的「双口径并存」项——输入默认 58 万（视频口径）与展示层 53.8 万（报告原文）并存；atlas-brief:108 的「降级为示例值」裁定只落在 note/childVideoNote，defaults.ts:35 注释与 README.md:288 免责句尚未注明该属性。
- **结论三**：改默认值的回归面集中在两处夹具——integration.rs（48 锚，含 480/1,635,200 锁定锚点）与 check-share.mjs BASE_STATE；任何 §2 数值变更必须同步这两处并重跑 `node scripts/check-share.mjs`（本会话已实跑通过）。

## 尾注：误命中登记（不计入落点）

- ③ 子串误命中 4 处：wasm/Cargo.lock:334,435（checksum 含 739）、integration.rs:1438（473910.67）、design-spec.md:39（色值 #373739）。
- ① 子串误命中 1 处：research-video-data.md:84（东方财富 URL）。
- ⑦ 无关命中 18 处清单见 §7 第三段。
