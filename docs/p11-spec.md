# P11 实现规范：数据时效元数据化 · 官方更新采值 · 过期提示 UI · 指数序列扩展 · check:data 组 J/K

| 项 | 值 |
| --- | --- |
| 文档性质 | 实施规范（施工蓝图；本文档轮次零施工，不写实现代码、不改任何数值） |
| 输入物（起草会话全读） | `docs/research-p11-data-audit.md`（75 项注册表 + §2 官方核实 + §3 判据 + §4 元数据 schema）、`docs/research-p11-series.md`（序列结构审计 + C1–C4 候选 + 组 J 断言设计）、`src/data/` 九文件全读（defaults / presets / pensionParams / insights / regional / rentParams / taxTables / indexSeries / types）、`src/components/advanced/MonteCarloPanel.tsx`（1185 行全读）、`src/components/advanced/InsightsPanel.tsx`（282 行全读）、`docs/data-dictionary.md`（全读）、`scripts/check-data.mjs`（全读）、`scripts/check-size.mjs`（门禁行实读）、`scripts/zero-scroll-check.mjs`（头注实读）；佐证 grep：`share.ts:261/:320/:338`、`useCalculatorStore.ts:124/:192/:282/:319/:346`、三语 locale 序列键各 5 处命中 |
| 范围红线 | ①不装新依赖（package.json 零变化）；②公式语义零变化——`calc*` 调用面与 wasm 导出面零改动，480 法则 / 费雪双口径 / 策略阈值 / 计发月数联动 / 租售现金流公式全部不动；③既有序列数值不改——csi300 既有 20 值、sp500 既有 21 值逐值冻结，新增序列走「新登记项 + 新选择项」，X1 仅允许尾部追加一格（§1-2，追加前后既有 20 值 diff 为空）；④零自动播种——运行时零外部请求，全部数据为编译期静态登记；⑤待证不填猜测值——X1 精确复算值 / I5 精确均值 / cba00101 年度值在录入轮实读登记，不可达则挂起并展示「复核受限」 |
| 基线实测（起草会话实跑） | `npm run check:data` → 「九组断言全部通过」（A–I 基线绿）；`node scripts/check-size.mjs` → `DIST_TOTAL_KB=1948`、`WASM_MAX_KB=349`、门禁通过；node 逐文件求和 → dist 15 文件 **1,994,561 B**、wasm 356,864 B、对 2,000,000 B 门禁**余量 5,439 B**（与研究 p11-series 附 A3 同值） |

---

## §1 数据更新清单（研究 p11-data-audit §2 需更新项逐条；14 数据项 / 36 处数值字段变更）

计数口径：研究 §2 结论「需更新 13」按**核查组**计（US 两表并作一组、R1 的 GDP 与消费锚点并作一项）；本清单按**数据项**细数为 **14 项**，数值字段级旧值→新值共 **36 处**（年度与文案字段另计）。全部为外部统计/法规采值更新；工程参数、假设、派生项（D2–D14、P1–P4、I6–I10、I18–I19）无外部时效语义，零改动（研究 §2 末行裁定）。

| # | 数据项 | 落点 | 旧值 | 新值 | 来源与日期 | 同步点（三处纪律） |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PE2 计发工资锚点 | `pensionParams.ts:49` | `10343` | **`10787`**（129,441 ÷ 12 = 10,786.75 → 取整） | NBS《2025年城镇单位就业人员年平均工资情况》stats.gov.cn 官网直读，2026-05-15 发布，审计日 2026-11-24 核实（城镇非私营 +4.3%；私营 71,590 元 → 约 5,966 元/月作 note 注） | ①常量与 `PENSION_WAGE_SOURCE_NOTE`（pensionParams.ts:52-55）②data-dictionary 一表行 ③组 K 元数据 CHECKED_AT |
| 2 | X1 沪深300 序列 2025 年度值 | `indexSeries.ts:35-39` | 20 值（2005–2024，末值 14.68） | 尾部**追加一格**（精确值待复算：行情历史接口按年末收盘价独立复算；交叉锚=全年 +17.66%（Wind 年末收盘口径转述）、12-30 阶段值 4651.28 ÷ 基准 3934.91 复算 +18.21% 自洽——审计日实拉基准值一致） | 行情历史接口（仓库原方法先例 indexSeries.ts:32-33）；审计日 2026-11-24 | ①数组尾部一格（既有 20 值逐值不动，实施轮以 node 逐值比对登记）②note/firstYear 区间句 ③组 J1/J2 COUNTS（csi300=21） |
| 3 | I5 企业年金均值 | `insights.ts:79-86` | `"6.17%"`（2007–2024 十八年均值） | **待证采值**：人社部《2025年度全国企业年金基金业务数据摘要》「自 2007 年以来平均」精确值（正文为 PDF，须直读后录入；媒体核对：2025 单年加权 6.69%、规模 4.17 万亿，每日经济新闻 2026-03-25） | 人社部官网页 2026-03-20 在案确认；审计日 2026-11-24 核实 | ①value/scope ②data-dictionary 二表行 ③组 K 内联；PDF 直读不可达则**保持 6.17%** + scope 补「2025 年度摘要已发布、精确均值复核受限」（待证纪律） |
| 4 | T2 美国单身表 | `taxTables.ts:50-72` | year 2025；`15750`；档起 11925/48475/103350/197300/250525/626350 | year **2026**；`16100`；**12400/50400/105700/201775/256225/640600**（3 档七档税率不变） | IRS Rev. Proc. 2025-32（2025-10 发布），经 Tax Foundation 整理页 2026-11-24 读取 | ①standardDeduction + 6 档 + year + name「（2026，单身）」+ note ②data-dictionary ③组 K 内联 YEAR |
| 5 | T3 美国合并表 | `taxTables.ts:73-94` | year 2025；`31500`；档起 23850/96950/206700/394600/501050/751600 | year **2026**；`32200`；**24800/100800/211400/403550/512450/768700** | 同上（Rev. Proc. 2025-32） | 同 T2 |
| 6 | T5 德国表 | `taxTables.ts:114-142` | year 2025；`12096`；九档近似（0.157 起档 1782…265730） | year **2026**；`12348`；九档**按 2026 公式重推**——§32a EStG 2026 五段：≤12,348 欧 0；12,349–17,799：(914.51·y+1,400)·y；17,800–69,878：(173.10·z+2,397)·z+1,034.87；69,879–277,825：0.42x−11,135.63；≥277,826：0.45x−19,470.38 | §32a EStG 官方法条库 gesetze-im-internet.de 直读，2026-11-24 | ①standardDeduction + 九档重推（原 2025 近似段不可沿用）+ note 重写 + 精度声明按既有「数值扫描微调」法重验登记 ②data-dictionary ③组 K |
| 7 | R1 中国城镇 GDP + 消费锚 | `regional.ts:24-39` | GDP `27100`（2024）；锚 `2880`（2024 年 34,557÷12） | GDP **`29300`**；锚 **`2989`**（2025 年城镇 35,869÷12 = 2,989.08 → 取整）；year **2025**；消费率列 40 不动（世行 NE.CON.PRVT.ZS 最新仍 2024，note 注明「消费率为 2024 年值」）；头注/source「34,557 / 2,880 / 2024年居民收支」句同步换 2025 年度发布（2026-01-19） | 世界银行 API NY.GDP.PCAP.PP.CD（快照 lastupdated 2026-11-11，审计日 curl 实查）；NBS 2025 年度收支（2026-01-19，在案） | ①数据 + 头注（regional.ts:15-16 锚句）②data-dictionary ③组 A 无涉（A6 只锚 README，README 零改动） |
| 8 | R2 美国 GDP | `regional.ts:40-51` | `86200`（2024） | **`90000`**；year 2025；消费率 67.9 不动 | 同 R1 世行 API | 同上（消费率 note 同款） |
| 9 | R3 德国 GDP | `regional.ts:52-62` | `74000` | **`75400`**；year 2025 | 同上 | 同上 |
| 10 | R4 英国 GDP | `regional.ts:63-73` | `62800` | **`64600`**；year 2025 | 同上 | 同上 |
| 11 | R5 日本 GDP | `regional.ts:74-86` | `54200` | **`55400`**；year 2025 | 同上 | 同上 |
| 12 | R6 新加坡 GDP | `regional.ts:87-100` | `153200` | **`163400`**；year 2025 | 同上 | 同上 |
| 13 | R7 澳大利亚 GDP | `regional.ts:101-110` | `72100` | **`71900`**；year 2025 | 同上 | 同上 |
| 14 | R8 加拿大 GDP | `regional.ts:111-121` | `65500` | **`66700`**；year 2025 | 同上 | 同上 |

**待证项零采值清单**（审计判「待证」，本轮一律不改值，展示「复核受限」）：I17 卫生公报、I1/I2 存款挂牌利率、I13–I16 育娲报告（新版即便发布亦不得静默替换 580000——data-dictionary §4 既有禁则）、T6 日本、T8 澳大利亚、T9 加拿大、D7 房贷占位。US 2026 表（#4/#5）落地后，`TAX_TABLE_DISCLAIMER`（taxTables.ts:18「基于 2025 年公开税档」）与各 note 内同名句须随表内 year 改为对应年度句（每表 note 独立字面量，互不影响；types.ts:123 消费点 UI 去重逻辑零改动）。

## §2 元数据化施工（每数据文件头部 YEAR/CHECKED_AT/SOURCE 注释块；逐文件清单）

模板承 research-p11-data-audit §4：单源文件用头块，异源多表文件逐条目内联单行注释。机读规则四条照录：`YEAR` 与税表结构化 `year` 字段同源（L2 类二者必须一致）；`CHECKED_AT` = 复核动作发生日（非发布日），改值或复核必刷；`NEXT_DUE` 仅 L1/L3 必填（锚：NBS 收支 2027-01、工资 2027-05、年金摘要 2027-03、社保年报 2027-09、世行 WDI 2027-07、年度序列收宫后 Q1、Numbeo 每半年）；`derived` 禁填 SOURCE（须引基座 ID）。

```ts
/**
 * @data-meta
 *   YEAR: 2025               // 统计年份；快照/序列类=数据时点；混合文件可省略
 *   CHECKED_AT: 2026-11-24   // 最近复核日（ISO 8601；改值或复核必刷）
 *   NEXT_DUE: 2027-05        // 下一官方发布窗口（YYYY-MM；仅 L1/L3 必填）
 *   SOURCE_TYPE: official    // official | media | video | engineering | derived | snapshot | rolling
 *   EXPIRY: L1               // 过期判据类别 L1–L5（research-p11-data-audit §3）
 *   SOURCE:
 *     - <机构，《发布名》，日期>
 */
```

逐条目内联形式：`// @data-meta YEAR=2026 CHECKED_AT=2026-11-24 SOURCE_TYPE=media EXPIRY=L2`（已有结构化字段——insights 的 year/verification/source、rentParams 的 year/source——视为同源，内联只补 `CHECKED_AT`/`EXPIRY`/`NEXT_DUE`，禁重复写 source 防双源漂移）。

| # | 文件 | 形式 | YEAR | CHECKED_AT | NEXT_DUE | SOURCE_TYPE | EXPIRY | 施工说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | defaults.ts | 头块 + FX 内联 | 头块省略（工程/派生混合） | 2026-11-24（审计判类日） | — | engineering | L4 | `FX_RATE_SNAPSHOT` 内联：YEAR=2026-11-20（接口时点）、CHECKED_AT=2026-11-21、SOURCE_TYPE=snapshot、EXPIRY=L3（快照类豁免 hard——研究 §3-L3） |
| 2 | presets.ts | 头块 + 四画像内联 | 省略 | 2026-11-21（在案台账复核列） | — | engineering | L4 | 四内联行同值（工程整理口径）；注释零 dist 成本 |
| 3 | pensionParams.ts | 头块 + PE1/PE2 内联 | PE2=2025 | PE1/PE2=2026-11-24（#1 采值轮刷新） | PE2：2027-05 | official | PE2=L1；PE1=L2（制度表，修法即 hard） | PE2 延迟退休注释块零改动（pensionParams.ts:7-21 不入机读） |
| 4 | insights.ts | 头块 + 19 条内联 | 与各条既有 `year` 字段同源（不重写） | 头块=2026-11-21（在案台账复核列；审计日仅判级不重读源，不虚刷） | L1 条：I3=按 NBS 月度节奏省略；I4=2027-09；I5=2027-03；I11/I12=2027-01；I17 复核受限 | 与既有 verification 字段映射（official/media/video） | official/media→L1；video→L4 | insights.ts:9 纪律不变（展示数据不参与计算、不得被 src/wasm/** 引用） |
| 5 | regional.ts | 头块（单源模板） | 2025（#7–14 采值轮） | 2026-11-24 | 2027-07 | official | L1 | 恩格尔区间各国口径年份仍在各 note（头块 YEAR 仅锚 GDP 列） |
| 6 | rentParams.ts | 头块（单源模板） | 2025 | **2026-11-20**（在案滚动读取登记轮，git 提交日与 NUMBEO_NOTE「2026-11 读取」双证；审计日仅按 §3-L3 判类未重读源，不虚刷。note 仅月精度，实施轮考证出逐城精确读取日可逐条刷新） | 2027-05 | rolling | L3 | 16 城逐条内联可选省略（同源同判据，头块承载；实施轮登记取舍） |
| 7 | taxTables.ts | 头块 + 9 表内联 | **=== 各表 `year` 字段**（L2 机读一致，组 K3 断言） | T1–T5=2026-11-24（审计日直读/采值）；T6/T8/T9=2026-11（文件头注查证轮 taxTables.ts:13，审计复核受限）；T7=2026-11 | — | T4/T5=official；T2/T3=media（Rev. Proc. 2025-32 经 Tax Foundation 转载核对）；T1=official；T6/T8/T9=official（在案）+「复核受限」状态 | L2 | 「2025-11 查证」（各 note 在案）为表值原始查证轮，先于仓库建库（2026-11-17 initial commit），不作为 CHECKED_AT |
| 8 | indexSeries.ts | **不放 @data-meta 注释块（有意偏差）** | — | — | — | — | L3（年度序列类：上年收宫后 Q1 未补录即 soft——研究 §3-L3，X1 现状即命中案例） | 机读走 §4 schema 新字段 `fetchedAt`/`sourceUrl`（单一真源；注释块 + 字段双写必漂移）。文件头注释保留序列纪律文字（「2026 不完整年度一律不录入」等） |
| 9 | types.ts | 零施工 | — | — | — | — | — | 纯类型契约，无数据项（research-p11-data-audit §1 范围注） |

元数据注释全部为 TS 注释，构建期剥离，**dist 零成本**。机读消费方 = 组 K（§5）读源文本正则（先例组 F 的 dLines 窗口法，check-data.mjs:260-267）；UI 消费方 = `src/data/freshness.ts`（§3）。

## §3 过期提示 UI 设计（三档 ok/soft/hard + 复核受限；面板落点、提示形态、i18n 键）

### §3.1 档位判据与形态

| 档 | 判据（研究 §3-L1–L5） | 行内形态 | 详情句 |
| --- | --- | --- | --- |
| ok | 判据未命中 | **不渲染任何标记**（诚实性纪律：无缺口不占视觉资源） | — |
| soft | L1 发布窗口已过未更新 / L2 落后一届 / L3 滚动 >6 个月或序列收宫未补录 / L4 复核 >24 个月 | `Tag size="small"` 灰档「数据为 {{year}} 年度口径」 | `本值基于 {{year}} 年度官方数据，最新发布窗口约 {{due}}；复核于 {{checked}}。`（并入该行既有 FieldTip 文本尾部，零新布局高度） |
| hard | L1 连续两届未采值 / L2 落后两届及以上 / L3 滚动 >12 个月 | `Tag size="small"` 红档「该数据已落后官方最新发布」 | `官方已于 {{date}} 发布 {{newValue}}，当前展示值为 {{oldValue}}（{{year}} 年度）。`——**{{newValue}}/{{date}} 仅在数据层 freshness 条目显式携带已核证新值时填充**；写作裁定类（如社保 7.62% 更新口径）与待证类禁填 |
| 复核受限 | 审计判「待证」（§1 待证清单 + T6/T8/T9） | 行内不挂角标（无已证缺口） | 清单页状态列「复核受限：最新官方发布未能核验，以在案口径展示」（待证项展示复核受限而非编造更新值——data-dictionary §4 禁则） |

禁则沿用 data-dictionary §4：不写「研究表明/历史平均」、不把折月值写成官方月度数据、社保收益率仅按句式 3/5 与年份边界同源引用（组 G 断言继续锚定）。

### §3.2 面板落点

| 落点 | 形态 | 触发 | 纪律与登记 |
| --- | --- | --- | --- |
| 面板⑨ InsightsPanel E2/E3/E4 数据行（`InsightsPanel.tsx:78-103` EntryRows） | 行内 Tag（gray=soft / red=hard）+ 详情句并入行 FieldTip（compact 通道既有，`:91`） | `INSIGHT_FRESHNESS` 映射按 labelKey 命中 | 19 条展示数据「不参与计算」纪律不变；Tag 复用组件库既有三色机制（`:35-39` VERIFICATION 同款静态映射，禁模板串拼键） |
| 面板⑨ E5 声明条目 → 新增第 2 分页「数据时效清单」（`InsightsPanel.tsx:270-278` 现单节无分页器） | `FILE_FRESHNESS` 9 行文件级清单：数据文件 / 年度 / 最近复核 / 判据（L1–L5）/ 状态（含「复核受限」）；复用 SlotPager（`≤480` 档 3 行/页、其余 4 行/页，E2 chainPerPage 同机制 `:122-124`） | 常驻可达（E5 条目内翻页） | **登记**：E5 由 1 页改 1+⌈9/每页⌉ 页；此为 p10 红线 10 路线 (b)（SlotPager 等高互换）已收口形态的延伸，A-12 以 `scripts/zero-scroll-check.mjs` 贪心遍历复测 principles 页（该脚本自动点击 SlotPager 前进钮，新页自动入遍历） |
| MonteCarloPanel 序列口径句（`MonteCarloPanel.tsx:378-385` seriesNoteText） | `mc.seriesNote` 模板追加「，拉取于 {{fetched}}」插值；序列若命中 L3 soft（如 X1 挂起未补录态）则在序列选择器 FieldTip（`:530`/`:828`）尾部追加 soft 详情句 | `fetchedAt` 字段 + L3 判据 | 零新面板元素，复用既有 FieldTip 通道（P5 冗长治理口径不变） |
| ~~设置页数据时效清单~~ | **无此页**——App 为五任务页结构（TaskSwitcher），无设置页（研究 §3 落点为此处偏差登记） | — | 清单落点改挂面板⑨ E5 分页（信息等价、零新增导航层），登记为对研究落点的偏差修正 |
| PensionPanel / RentalPanel / TaxPanel | 本轮**不挂角标**（未采纳登记） | — | 理由：PE2 采值后无 hard 项驻留养老面板；租售/税表的时效提示由数据层元数据 + 组 K 断言承载，UI 增量收益低于体积与视觉成本；通用键已预留，后续轮可挂 |

### §3.3 i18n 键预算（新键 14 ×3 语 = 42 条；既有键值变更 1 ×3 语）

| 键 | zh-CN 文案 | 用途 |
| --- | --- | --- |
| `insights.freshnessSoft` | 数据为 {{year}} 年度口径 | soft 角标 |
| `insights.freshnessHard` | 该数据已落后官方最新发布 | hard 角标 |
| `insights.freshnessSoftDetail` | 本值基于 {{year}} 年度官方数据，最新发布窗口约 {{due}}；复核于 {{checked}}。 | soft 详情句 |
| `insights.freshnessHardDetail` | 官方已于 {{date}} 发布 {{newValue}}，当前展示值为 {{oldValue}}（{{year}} 年度）。 | hard 详情句（待证禁填插值） |
| `insights.freshnessRestricted` | 复核受限：最新官方发布未能核验，以在案口径展示 | 待证状态句 |
| `insights.freshnessListTitle` | 数据时效清单 | E5 第 2 分页标题 |
| `insights.freshnessColFile` | 数据文件 | 清单列头 |
| `insights.freshnessColYear` | 年度 | 清单列头 |
| `insights.freshnessColChecked` | 最近复核 | 清单列头 |
| `insights.freshnessColClass` | 判据 | 清单列头 |
| `mc.indexCsi300Tr` | 沪深300全收益（中国） | §4 新序列显示名 |
| `mc.indexCba00101` | 中债新综合财富（债券） | §4 新序列显示名 |
| `mc.indexSp500Long` | 标普500长历史（1972–） | §4 新序列显示名 |
| `mc.seriesTotalCoupon` | 财富口径（含票息按月再投资） | cba00101 kind 键（新键；既有 `mc.seriesPriceOnly`/`mc.seriesTotalReturn` 零改动） |
| `mc.seriesNote`（既有键**值变更** ×3 语） | …；来源：{{source}}，拉取于 {{fetched}} | 追加插值 |

既有键值变更 = `mc.seriesNote` ×3 语（en/zh-Hant 同构追加 fetched 插值）。三语同构纪律与 zh-CN ≥140 字符界面串 0 条门禁（P5 §8 #19）适用——详情句走 FieldTip 通道不计界面串。

## §4 序列扩展清单（采纳 3 条新增序列 + 区间元数据 schema；既有序列数值零改动）

### §4.1 采纳裁定

| 候选 | 采纳 | id / kind / 区间 / 样本 | 来源与录入纪律 | 体积（研究实测） |
| --- | --- | --- | --- | --- |
| C1 沪深300全收益（中证 H00300） | **采纳（P0）** | `csi300tr` / total / 2005–2025 / 21 | 一手=中证指数官网历史行情按年末收盘独立复算（实施首验项，SPA 端点未直连验证）；失败回退 GuruFocus 年度表为录入源并登记（本会话 2026-11-24 全表实读：2024=18.24、2025=20.98，2017–2024 价格列与库内 csi300 逐值一致——交叉验证通过）。**并列新增，不替换 csi300**（旧 id 已入分享载荷） | ≈740 B |
| C2 中债-新综合财富指数（CBA00101） | **采纳（P0）** | `cba00101` / total（含票息）/ 2002–2025 / 24 | 官方查询平台 yield.chinabond.com.cn 按年查年末财富指标 → 相邻年末比值独立复算；**年度值本会话未实读，录入轮按官方查询实读登记，禁从实现输出反推**（J1 锚值随录入轮登记） | ≈720 B |
| C3 标普500含股息长历史 | **采纳（P1，裁剪档）** | `sp500long` / total / **1972–2025 / 54** | Damodaran「Historical Returns on Stock…」表（本会话 2026-11-24 fetch 实测：1972 起裁剪，2025=17.78 与库内 sp500 2025=17.88 差 0.10pp 为股息估计 vintage 差异，note 如实登记，不调和）。98 全档（≈2.2KB）超门禁**禁入**（研究 §2.5 裁定） | ≈1,541 B |
| C4 美国十年期国债总回报 | **缓置（P2）** | — | 与 C3 同页同表；触发条件：C3 落地并回收（§7.3）后实测余量 ≥2.2KB 时启用，否则登记下轮评估，本轮不落库 | （≈1.5KB 档） |

新增序列数 = **3**（csi300tr / cba00101 / sp500long-54）；全部 `kind: "total"`（债类含票息归 total 口径，note 注明——J3 语义一致性断言同款）。

### §4.2 schema 扩展（`indexSeries.ts`；承研究 §3.1）

```ts
export type IndexId = "csi300" | "sp500" | "csi300tr" | "cba00101" | "sp500long";
// 只增不改：旧 id 是分享链接载荷组成部分（share.ts:75/:320），改名即断链

export interface IndexSeries {
  id: IndexId;
  firstYear: number;            // 既有
  annualReturnsPct: number[];   // 既有
  kind: "price" | "total";      // 既有
  source: string;               // 既有：机构名 + 表名（日期迁出至 fetchedAt）
  note: string;                 // 既有：口径备注
  // —— P11 新增四字段 ——
  nameKey: string;              // 收编 MonteCarloPanel INDEX_NAME_KEY（:63-66）
  kindKey: string;              // 收编 INDEX_KIND_KEY（:68-71）
  fetchedAt: string;            // "YYYY-MM-DD"（机读；组 J3 断言锚）
  sourceUrl?: string;           // 溯源 URL（机读；不入 UI 文案——口径句已属长文案）
}

/** 区间三件套单一派生（end/count 永不落盘——冗余落盘必漂移，J2 兜底） */
export function seriesRange(s: IndexSeries): { start: number; end: number; count: number } {
  return { start: s.firstYear, end: s.firstYear + s.annualReturnsPct.length - 1, count: s.annualReturnsPct.length };
}
```

### §4.3 面板选择项与区间展示（MonteCarloPanel 消费点逐处）

1. **删除两份 id→键硬编码 Record**（`MonteCarloPanel.tsx:63-66` INDEX_NAME_KEY、`:68-71` INDEX_KIND_KEY）；选择器 options 与口径句改读数据字段：`:534`/`:833` 两处 `INDEX_ORDER.map((id) => ({ label: t(INDEX_SERIES[id].nameKey), value: id }))`；`seriesNoteText` 的 `:379`/`:383` 改 `t(INDEX_SERIES[seriesId].nameKey)` / `t(INDEX_SERIES[seriesId].kindKey)`。此后新增序列**零面板改动**（J0 断言防裸键）。
2. `INDEX_ORDER = ["csi300","sp500","csi300tr","cba00101","sp500long"]`——新序列**追加尾部**，旧两序列顺序不变（UI 稳定纪律，indexSeries.ts:60-61 注释口径）；`INDEX_ORDER` 与 `Object.keys(INDEX_SERIES)` 全等（J0）。
3. 区间展示单一真源：`seriesNoteText` 的 `lastYear`/`count` 改经 `seriesRange()` 派生（`:381-382` 现内联算式迁入助手，数值恒等）；追加 `{{fetched}}` 插值（§3.3）。序列风险子区窗长上限 `max={seqSeries.length}`（`:848`）与 `seq.note1 {{count}}`（`:374`）随所选序列长度自适应，**零面板改动**（数据驱动）；sp500long 下滚动窗起点数上限 = 54 − 窗长 + 1。
4. 分享白名单硬同步：`share.ts:320` 放行为五 id（`if (!["csi300","sp500","csi300tr","cba00101","sp500long"].includes(seriesId)) return null;`——或保持条件串式样，实施轮登记式样；J0 以 readFileSync 字面量断言强制）。默认序列 `store:192 "csi300"` 不变；分享载荷字段零新增（`:338` 原样）。
5. bootstrap 抽样注入点（`:299` `INDEX_SERIES[seriesId].annualReturnsPct`）零改动；引擎零触碰（p8-spec 零随机裁定 + SampleProvider 缝是序列进引擎的唯一合规路径）。

## §5 check:data 三联断言扩展（组 J 锚值/年份/来源 + 组 K 元数据；A–I 零变化锁定）

现状：check-data.mjs 九组（A–I，check-data.mjs:134-353）对 indexSeries **零覆盖**、对元数据零覆盖（全读核实）。管道照旧：`loadModule("../src/data/indexSeries.ts","indexSeries")`（该文件无 import，deps 机制 check-data.mjs:54-76 零改动）；组 K 读源文本正则（readFileSync，先例 `:129-130`/`:260-267`）。断言纪律沿 `:28`「独立推导算式入注释，禁魔法期望数」。预期新增断言 ≈40 处；`check:data` 输出句扩为「九组 + 序列溯源 + 元数据」。

### 组 J（三联；锚 research-p11-series §4）

| 组 | 断言 | 期望 |
| --- | --- | --- |
| J0 结构前置 | ①`INDEX_ORDER` 与 `Object.keys(INDEX_SERIES)` 全等；②逐 id 断言 share.ts 源文本含该 id 字面量（白名单同步强制，§4.3-4）；③三语 flats 含每序列 `nameKey` 指向的键（防裸键，复用 flats 机制 `:118-127`） | 五 id 全量 |
| J1 锚值 | `PER_SERIES_ANCHORS: Record<IndexId, Array<[year, value]>>`，`arr[year − firstYear] === value` 严格相等（数据层字面量两位小数，JSON 往返无损） | csi300：[2005,−7.66]/[2008,−65.95]/[2015,5.58]/[2024,14.68]（库内在值，先锁现状）；sp500：[2005,4.91]/[2008,−37.00]/[2020,18.40]/[2025,17.88]；csi300tr：[2024,18.24]/[2025,20.98]（录入轮按官网复算值登记）；sp500long：[1972,?]（录入轮登记）/ [2025,17.78]；cba00101：随录入轮实读登记（禁占位） |
| J2 年份 | ①`seriesRange(s)` 三值与派生式恒等（单一真源自证）；②逐 id 期望样本数 `COUNTS`（csi300=21 若 #2 补录落地 / 20 若挂起，**两终点态均合法，实施轮登记实际态**；sp500=21；csi300tr=21；cba00101=24；sp500long=54）；③`seriesRange(s).end ≤ 2025`（「2026 不完整年度禁入」机读镜像，indexSeries.ts:4）；④每锚年 ∈ [firstYear, lastYear]；⑤逐值 `isFinite(v) && v > −100 && v < 1000` | — |
| J3 来源 | ①`source` 含逐 id 机构名关键字（csi300→「行情历史」、csi300tr→「中证指数」、sp500→「Slickcharts」、cba00101→「中国债券」、sp500long→「Damodaran」）；②`fetchedAt` 匹配 `/^\d{4}-\d{2}-\d{2}$/` 且 ≤ 当日（防占位未来日期）；③kind 语义：`"price"` ⇒ note 含「不含股息」；`"total"` ⇒ note 含「含股息」或「含票息」；④`sourceUrl` 在位时含 `"http"` 且域名前缀命中白名单（csindex.com.cn / chinabond.com.cn / stern.nyu.edu / gurufocus.cn / slickcharts） | — |

### 组 K（@data-meta 元数据机读；承 research-p11-data-audit §4）

| 组 | 断言 | 说明 |
| --- | --- | --- |
| K1 | 除 types.ts（零数据项）与 indexSeries.ts（字段路径，J3 承载）外七文件源文本含 `@data-meta` 头块，必填键齐备（YEAR 可省略于混合文件；CHECKED_AT/SOURCE_TYPE/EXPIRY 必填；NEXT_DUE 仅 L1/L3 必填） | 正则解析注释块，不经转译 |
| K2 | 逐个 `CHECKED_AT` 匹配 `/^\d{4}-\d{2}-\d{2}$/` 且 ≤ 当日（构建日） | 防占位未来日期 |
| K3 | L2 类：税表内联 `YEAR` === 该表结构化 `year` 字段（转译加载 taxTables 对齐）；且 T1–T9 `year` ≥ 当前适用年度 − 1 | US/DE 表升 2026 后既有边界即过 |
| K4 | L1/L3 类 `CHECKED_AT` 未超 §3 soft 阈值（L1：NBS 收支 >14 个月 / 工资 >18 个月 / 年金 >15 个月；L3：滚动 >6 个月、快照豁免） | 超期即红（发布窗口管理机读化） |
| K5 | `NEXT_DUE` 已过窗口且 CHECKED_AT 未刷新 → `console.warn` 提醒，**非阻断**（exit 0） | 与 K4 阻断档分级 |
| K6 | insights 内联 `EXPIRY` 与既有 `verification` 映射一致（official/media→L1、video→L4）；`YEAR` 对齐仅在既有 `year` 字段为纯年份数字时断言（区间串「2007–2024」跳过） | 防结构化字段与注释漂移 |

实施顺序（承研究 §4 迁移序）：①§1 七项采值（DE 近似段重推、X1 走行情接口复算）→ ②七文件补 `@data-meta` + indexSeries 四字段 + data-dictionary 扩表（35 项缺口首次全量登记）→ ③组 J/K 落地（J1 的 csi300tr/cba00101/sp500long 锚值随各序列录入轮补登）→ ④D6/D7/D8 占位项「缺登记→待校准」专项清单移交数据研究员（本轮不采值）。

## §6 回归红线（违反即返工）

1. **公式语义零变化**：`calcBaseline`/`calcMonteCarlo`/`calcMonteCarloBootstrap`/`calcSequence`/`calcTax` 等调用面与 wasm 导出面零改动（`git diff --stat -- src/wasm` 全空，含 bridge.ts）；480 法则 / 费雪双口径（组 B/D 期望值）/ 策略阈值带五参 / 计发月数联动 `effectiveMonthsDivisor` / 租售现金流公式不动；`BASELINE_DEFAULTS` 全部字段现值不动（PE2 是养老锚点，不是基础假设）。
2. **S1–S26 零变化**：p10-spec §6 登记表 26 行全部 ∈ 不动——本轮零新增、零退役、零迁移；新 Tag 角标与 E5 分页不进入任何 S 宿主高度预算（Tag 为行内元素、分页复用既有 SlotPager 交互词汇——交互词汇零新增红线）。
3. **既有断言零变化**：check:data 组 A–I 期望值零改动（全读核实：九组无 indexSeries/rentParams/regional 引用，§1 全部采值不触 A–I；组 A6 只锚 README，README 零改动）；`check:share`/`check:currency`/`check:a11y`/`check:lifecycle` exit 0；组 J/K 为纯新增。
4. **既有序列数值不改**：csi300 既有 20 值、sp500 既有 21 值逐值冻结；新序列走新增登记项 + 新选择项（§4.1）；X1 仅尾部追加一格（§1-2），追加前后既有 20 值 diff 为空（实施轮 node 逐值比对登记）。若评审裁 X1 追加为红线冲突，降级为待证挂起（COUNTS 保持 20），不硬改。
5. **零自动播种**：运行时零外部请求（types.ts FxRateSnapshot「应用运行时不发起任何外部请求」契约不变）；freshness/元数据全部编译期静态登记；不存在任何「自动拉取/自动更新」机制——过期提示只是静态登记的判据比对。
6. **分享链接兼容**：旧 id 永不改名；`share.ts:320` 白名单扩展后旧链接（csi300/sp500）解码行为逐字节不变；默认序列 `store:192` 不变；分享版本与载荷结构零新增字段。
7. **展示数据纪律**：insights.ts:9（不参与计算、不得被 src/wasm/** 引用）扩展适用于 `src/data/freshness.ts` 与 IndexSeries 新增展示字段（`sourceUrl` 不入 UI 文案）；freshness.ts 不入任何计算路径。
8. **依赖锁定**：package.json 零变化（组 J/K 沿 esbuild 转译管线，零新依赖）；零新测试框架。
9. **三处同步纪律**：§1 十四项逐项「数据层落点 → data-dictionary 行 → check:data 断言」同轮同步；data-dictionary 台账缺口（indexSeries/taxTables/regional/rentParams 四文件 35 项未入台账——研究首要发现）随 §2 施工首次全量登记。
10. **诚实性**：待证项展示「复核受限」，不编造更新值；hard 详情句 {{newValue}} 禁占位；CHECKED_AT 不虚刷（审计日仅判类未重读源的条目保留原复核日，§2 表逐行登记）；文档与本规范零禁词（起草后复扫，附 A）。

## §7 尺寸预算（≤20KB 记账上限；原始字节；dist 门禁 2,000,000 B 不放宽）

### §7.1 基线实测（起草会话实跑，非转抄）

`node scripts/check-size.mjs` → `DIST_TOTAL_KB=1948`、`WASM_MAX_KB=349`、门禁通过；node 逐文件求和（排除 dist/.git，check-size walk() 同款规则）= **1,994,561 B**（15 文件）、wasm **356,864 B**、对门禁余量 **5,439 B**（与研究 p11-series 附 A3 完全一致）。

### §7.2 本轮预算（分相；估算口径 = minified 字面量近似 ±30%，真值以 `npm run build && npm run check:size` 为准）

| 相 | 内容 | 预算 | 依据 |
| --- | --- | --- | --- |
| Phase A | §1 采值（值/年份/文案同量级替换 ≈+0.3KB）+ §2 元数据（注释，dist 0）+ `freshness.ts`（FILE_FRESHNESS 9 行 + INSIGHT_FRESHNESS 精简映射 ≈0.9KB）+ §3 UI（i18n 42 条 ≈1.1KB + Tag/清单 JSX ≈0.4KB + E5 分页 ≈0.15KB） | **≈2.9KB** | 组 K/§3.3 |
| Phase B | §2 indexSeries 四字段 ×5 序列（≈0.35KB）+ seriesRange 助手（≈0.1KB）− 删两份面板 Record（≈−0.1KB）+ C1+C2 落库（1,460B + 显示名 248B） | **≈2.1KB** | 研究 §2.5 实测 616/596 B |
| Phase C | C3 sp500long-54 落库（1,417B + 显示名 124B） | **≈1.7KB** | 研究 §2.5 实测 1,417 B |
| **合计（全落）** | — | **≈6.7KB ≤ 20,480B（≤20KB）记账上限 ✓** | 上限宽裕；**dist 余量才是真约束** |
| wasm 增量 | **+0（硬线）** | 缓冲线沿用 p10 §8.2（≤387,590 B 不触发）；任何 wasm 增量即返工重审 | — |
| scripts/ | 组 J/K 扩展 | **0（不进 dist）** | 零体积成本 |

### §7.3 dist 余量闸门与回收顺序（门禁不放宽、不特批）

两约束关系（诚实声明）：全落 ≈6.7KB > 当前余量 5,439B ⇒ **Phase C 必须闸门放行**：

1. Phase A + B 落地后实测余量（`npm run build && npm run check:size` + node 求和）；实测 slack ≥ 2,200B（Phase C 1.7KB + ≥500B 安全缓冲）→ Phase C 直落；
2. 不足 → 先执行回收盘点（p8-spec §6.3 同款，逐项实测登记）：①`INSIGHT_FRESHNESS` 映射裁剪为仅非 ok 项（ok 零渲染纪律下可行，省 ≈0.25KB）；②清单页四列并三列（文件/复核/判据并合，省 ≈0.2KB）；③`mc.indexSp500Long` 等显示名缩短；④`freshnessSoftDetail`/`freshnessHardDetail` 模板并合为一个参数化键（省 ≈0.15KB ×3 语）；
3. 回收后仍不足 → **C3 缓置登记**（与 C4 同轨，触发条件同 §4.1），本轮采纳序列数按实际落地数登记，不硬塞、不超卖。

## §8 验收断言（12 条；全过才收口）

- [ ] **A-1 基线与扩展断言**：`npm run check:data` exit 0——组 A–I 期望零变化（对照基线输出「九组断言全部通过」）+ 组 J/K 全过；输出句含「序列溯源」「元数据」段；组 J1 锚值逐 id 年→值严格相等；组 K2 无一 CHECKED_AT 晚于当日。
- [ ] **A-2 采值逐项**：PE2 = 10787 且注释含 129,441÷12 算式；T2/T3 standardDeduction = 16,100/32,200、六档下沿 = 12400/50400/105700/201775/256225/640600 与 24800/100800/211400/403550/512450/768700 逐值；T5 = 12348 且九档按 2026 公式重推的精度扫描记录在案；R1–R8 GDP 列逐值 = §1 表新值、year = 2025、消费率列零变化；R1 锚 = 2989；以上逐项与 data-dictionary 行同步（diff 在案）。
- [ ] **A-3 X1 追加零重写**：追加前后既有 20 值逐值相等（node 比对输出登记）；新值 = 行情接口年末收盘复算登记值（不可达则挂起，COUNTS=20 终点态登记）；组 J2 COUNTS 与实际态一致。
- [ ] **A-4 序列结构**：IndexId 五值；`INDEX_ORDER` ≡ `Object.keys(INDEX_SERIES)`（J0）；`share.ts` 源文本含五 id 白名单字面量；`seriesRange()` 与面板 `lastYear`/`count` 恒等；全部序列 `end ≤ 2025`。
- [ ] **A-5 新序列可溯源**：csi300tr/cba00101/sp500long 的 fetchedAt 为合法 ISO 日期且 ≤ 当日；source 含 J3 机构关键字；kind=total ⇒ note 含「含股息」或「含票息」；sourceUrl 域名命中白名单；cba00101 年度值 = 录入轮官方查询实读登记（录入记录在案，禁从实现输出反推）。
- [ ] **A-6 面板选择项**：两处 Select（bootstrap 页与序列子区）options 由 `INDEX_SERIES[id].nameKey` 派生，五项齐全，前两项顺序 csi300/sp500 不变；`INDEX_NAME_KEY`/`INDEX_KIND_KEY` 两 Record 已删（grep 零命中）；三语无裸键（J0-③）。
- [ ] **A-7 区间展示**：序列口径句含 {{fetched}} 拉取日期；sp500long 显示 1972–2025 / 54 样本；序列风险子区窗长上限随所选序列长度自适应（sp500long 下窗长上限 54）；`seq.note1 {{count}}` 与 `seriesRange().count` 一致。
- [ ] **A-8 分享往返**：携带 csi300tr / cba00101 / sp500long 的分享链接生成→恢复 seriesId 不变；旧 csi300/sp500 链接解码行为与基线逐字节一致；默认序列仍 csi300；分享载荷无新增字段。
- [ ] **A-9 元数据机读**：七文件 @data-meta 头块在位且必填键齐备；税表内联 YEAR === 结构化 year 字段（九表）；L2 断言 `year ≥ 当前适用年度 − 1` 过；K5 过窗提醒为 warn 非阻断（人工触发一次登记输出）。
- [ ] **A-10 过期提示 UI**：ok 项零渲染；soft/hard 角标句式与 §3.3 键一致（三语 grep 逐键在位）；E5 清单页 9 行文件级 + 状态列（待证项显示「复核受限」）；hard 详情句 {{newValue}} 仅在已核证时填充（待证项路径不出现数字占位）。
- [ ] **A-11 零滚动与可达性**：`scripts/zero-scroll-check.mjs` 贪心遍历（含 E5 新分页）六视口零失败；`npm run check:a11y` 零回退；E5 分页控件与既有 SlotPager 交互词汇一致（零新交互模式）。
- [ ] **A-12 回归门禁**：`git diff --stat -- src/wasm` 全空；package.json 零变化；`check:share`/`check:currency`/`check:lifecycle` exit 0；`npx tsc --noEmit` 过；`npm run build && npm run check:size` exit 0——dist ≤ 2,000,000 B、wasm ≤ 387,590 B（§7.3 缓冲线，预期 +0）；净增记账 ≤ 20,480B（§7.2 分相回测差值），Phase C 闸门/回收/缓置裁决记录在案。

---

## 附 A：本规范自身合规自检（起草会话实跑记录）

| # | 检查 | 命令/方法 | 结果 |
| --- | --- | --- | --- |
| A-1 | check:data 基线 | `npm run check:data` | 「[check-data] 九组断言全部通过：消费口径/480/年支出/费雪/预设/育儿标注/社保环/算例B/假设区间」——A–I 基线绿（§6-3 零变化参照） |
| A-2 | 尺寸基线 | `node scripts/check-size.mjs` + node 逐文件求和 | `DIST_TOTAL_KB=1948`、`WASM_MAX_KB=349`、门禁通过；files=15 total=1994561 wasm=356864 **slack=5439**（与研究 p11-series 附 A3 同值） |
| A-3 | 消费点定位 | grep share.ts / useCalculatorStore.ts / MonteCarloPanel / 三语 locale | share.ts:261/:320/:338；store:124/:192/:282/:319/:346（默认 "csi300" 在 ：192）；MonteCarloPanel:63-71（两 Record）/:299（注入）/:378-385（口径句）/:534/:833（两 Select）/:848（窗长上限）；mc 序列键三语各 5 处命中（键三语同构在位） |
| A-4 | 数据文件在案日期 | git log（逐文件 -1） | rentParams/regional/indexSeries/taxTables=2026-11-20；pensionParams/insights/presets=2026-11-21；defaults=2026-11-24——§2 CHECKED_AT 取值依据（在案登记轮 vs 审计判类日的区分） |
| A-5 | TAX_TABLE_DISCLAIMER 消费点 | grep src scripts | 仅 types.ts:123（注释引用）——无断言锚定，年度句随表更新零断言风险（§1 注） |
| A-6 | 禁词扫描 | `grep -inE` 对任务书给定禁词清单（13 词：4 个来源品牌词 + 9 个材质/动效词；词表本身不入本文，模式串见任务书铁律行）逐词扫描 docs/p11-spec.md 全文（起草后复跑） | 0 命中 |
| A-7 | 局限声明 | — | ①X1 精确复算值 / I5 精确均值 / cba00101 逐年年值 / sp500long 1972 锚值本会话未取得——全部标待证，录入轮实读；②体积为 minified 估算 ±30%（研究口径），真值以 build + check:size 为准；③E5 分页高度为静态推算，A-11 程序化复测为裁决路径；④本规范零施工——未跑 build/tsc/零滚动遍历（无实现可测），A-1/A-2 为唯一已执行门禁；⑤研究「需更新 13」与本文「14 数据项」的差异 = 计数口径（组 vs 项），§1 表头已登记 |

## 实施顺序（收口路径）

① §1 七项采值 + 三处同步 → ② §2 七文件元数据 + data-dictionary 扩表（35 项缺口）→ ③ §4.2 schema + 面板收编 + Phase B 落库 → ④ §3 freshness.ts + UI + i18n → ⑤ 组 J/K → ⑥ §7.3 闸门裁决（Phase C 直落 / 回收 / 缓置）→ ⑦ §8 十二条逐条过 → 收口登记（含 X1 终点态、C3 裁决、E5 复测读数三处必须留痕）。

---

## 实施结果与收口记录（文档收口会话复测登记，2026-11-25）

> 登记性质：p8/p9/p10-spec「实施结果与收口记录」同款结构——实施落地入库后的工作树上，由文档收口会话**独立复跑门禁**后登记。本节数字全部为本会话实跑/实读取证（命令与读数随条目给出），不转抄实施会话自述；无法在本会话验证的事实（GUI 通道类、官网重拉类）如实登记为未跑/未复算，不虚报。

### 一、实施终点态（工作树实读）

1. **采值（§1）**：PE2=10787（pensionParams.ts:63，注释载 129,441÷12=10,786.75 取整、私营 71,590≈5,966 元/月注，`PENSION_WAGE_SOURCE_NOTE` 同步 2026-05-15 发布句）；T2/T3 US 升 2026（taxTables.ts year=2026@:66/:90，16,100/32,200 与六档下沿逐值同 §1 表）；T5 DE 升 2026（year=2026@:135，12,348 欧，九档重推，note 载逐点扫描精度结论）；R1–R8 GDP 列升 2025 年值（regional.ts，R1=29,300@:39 + 锚 2,989@:44，year=2025，消费率列零变化）；X1 尾部追加 2025=+17.66（indexSeries.ts:63-69，4,629.94÷3,934.91−1=+17.663%→17.66）；I5 保持 6.17% + scope 补「复核受限」句（§1-3 待证纪律兑现）。
2. **X1 追加零重写（A-3）**：本会话以 `git show HEAD:src/data/indexSeries.ts` 既有 20 值与现行文件前 20 位 node 逐值比对——全部相等（比对输出 `x1AppendZeroDiff=true`）。
3. **序列（§4）**：IndexId 四值落库（indexSeries.ts:18）——**C3 sp500long 缓置**（indexSeries.ts:14-17 头注登记 §7.3-3 裁决；Damodaran 54 值录入轮实读在案、组 J1 锚注释预登记、share 白名单注释预留下轮补第五字面量）；INDEX_ORDER 四项追加尾部（:140）；新增四字段 nameKey/kindKey/fetchedAt/sourceUrl + `seriesRange()` 助手（:48-54）；面板两份 id→键硬编码 Record 已删（`grep -rn "INDEX_NAME_KEY|INDEX_KIND_KEY" src/` 零命中），两处 Select options 与口径句改读数据字段（MonteCarloPanel.tsx:537/:836）；share.ts:320 白名单扩四 id（旧 id 字面量原样保留，J0 断言强制）。
4. **元数据（§2）**：七文件 @data-meta 头块 + 逐条目内联（defaults/presets/pensionParams/insights/regional/rentParams/taxTables）；indexSeries 有意不放注释块（:6-9 头注即 §2-8 登记偏差兑现，机读走 fetchedAt/sourceUrl 单一真源）；组 K 机读四类断言（CHECKED_AT≤当日 / 税表 YEAR≡year / L1·L3 阈值 / insights EXPIRY 映射）全过。
5. **UI（§3）**：`src/data/freshness.ts` 三层（INSIGHT_FRESHNESS:43-50——唯一 soft=企业年金环，待证项零角标；FILE_FRESHNESS:71-81 九文件行；seriesFreshnessHint:99-108——ok 返回 null 零追加）；InsightsPanel 行级 Tag（hard 三值齐备才走 hard 键，待证路径无数字占位）+ 详情句并入行 FieldTip 零新布局高度；E5 由 1 页扩为 1+3 页（九文件清单 ⌈9/每页⌉=3，SlotPager 等高互换、页码随档位钳制）；列头四列并三列回收（§7.3-②登记在代码注释）；MonteCarloPanel seriesNote 追加 {{fetched}} 插值 + L3 soft 并句，两处 FieldTip 共用同一段落。
6. **i18n（§3.3）实况**：**9 新键 ×3 语 + 既有 `mc.seriesNote` 值变更 ×3 语**——较规范 14 键差 5：`mc.indexSp500Long`（随 C3 缓置不落）+ `freshnessCol` 四键（列头行整体裁剪回收，列语义由行字段顺序承载）。残句勘误：InsightsPanel.tsx:336 注释「freshnessColChecked 键三语在位保留」与实况不符（该键未入三语 locale）——文档轮不改代码，列为下轮顺手清理项。

### 二、门禁复跑（本会话实跑命令与读数）

| 门禁 | 命令 | 读数 |
| --- | --- | --- |
| 数据断言 | `npm run check:data` | 「十一组断言全部通过：消费口径/480/年支出/费雪/预设/育儿标注/社保环/算例B/假设区间 **+ 序列溯源（J：结构/锚值/年份/来源）+ 元数据（K：头块/日期/税表年度/阈值/条目映射）**」——A–I 零变化 + 组 J/K 全过（A-1 ✓） |
| 分享往返 | `npm run check:share` | v6 往返（含事件数组 + mcMeansSynced 闸）+ v5/v4/v3 失效 + …八组断言全部通过 |
| 类型 | `npx tsc --noEmit` | exit 0 |
| 尺寸 | `npm run build && npm run check:size` | `DIST_TOTAL_KB=1951`、`WASM_MAX_KB=349`、门禁通过；node 逐文件求和 dist 14 文件 **1,997,485 B**、wasm 356,870 B、对 2,000,000 B 门禁**余量 2,515 B**（基线 1,994,561/356,864/5,439 → **净增 +2,924 B**，与 §7.2 Phase A+B 预算 ≈2.9KB 同量级，合计 ≤ 20,480B ✓；wasm 源 `git diff --stat -- src/wasm` 全空，dist 内 wasm ±6 B 属重建产物差异、非源变化） |
| 其余三道 | `check:a11y` / `check:currency` / `check:lifecycle` | 63 组令牌对零违规 / 五组样本断言全过 / L1–L13 全部通过（89 项断言） |
| 依赖与源红线 | `git diff --stat -- package.json`、`git status --short src/wasm/` | 双双为空（A-12 依赖锁定 ✓） |

**A-8 抽查**（check-share 未随 P11 扩展新 id roundtrip 断言——其 +44 行为 P10 v6 工作）：本会话以 check-share BASE_STATE 同款夹具 + share.ts 真实编码/解码跑「csi300 / sp500 / csi300tr / cba00101」四 id 编码→解码，seriesId 逐 id 恒等（旧 id 行为不变）；默认序列 store:192 仍 `"csi300"`（实读）。

### 三、§8 十二条验收状态

| 条 | 状态 | 证据（本会话） |
| --- | --- | --- |
| A-1 | ✅ | 上表 check:data 读数（十一组，J/K 段落在输出句中） |
| A-2 | ✅ | 采值逐项与 §1 表一致（工作树实读，行号随 §一-1 条目）+ data-dictionary 台账行同步（文档收口轮逐行校正行号后复核一致） |
| A-3 | ✅ | 逐值比对零 diff + 17.66 复算自证（4,629.94÷3,934.91−1=+17.663%→17.66，与 Wind 年末收盘口径转述一致） |
| A-4 | ✅ | 四 id + 组 J0 过；`seriesRange()` 派生本会话 harness 实测与数据恒等（csi300 2005/2025/21 · sp500 2005/2025/21 · csi300tr 2005/2025/21 · cba00101 2002/2025/24，全部 end ≤ 2025） |
| A-5 | ◐ 部分 | fetchedAt 合法且 ≤ 当日 / source 机构关键字 / kind⇒note 语义 / sourceUrl 域名白名单——组 J3 机读全过；csi300tr/cba00101 年度值为**实施轮官网录入登记**（data-dictionary §八行在案），本会话未独立重拉中证/中债官网复算 |
| A-6 | ✅ | 两 Record grep 零命中；options 由 `INDEX_SERIES[id].nameKey` 派生（面板 diff 实读）；三语裸键由组 J0-③ 断言承载 |
| A-7 | ✅ | seriesNote 含 {{fetched}} 拉取日期；区间经 seriesRange 派生；窗长上限数据驱动零面板改动（sp500long 展示项不适用——未落库）；起点窗口数本会话复算：csi300 21 值 × 窗长 10 → **12 个起点窗口** |
| A-8 | ✅ | 四 id 往返抽查全过（上节）+ check:share v6 八组 |
| A-9 | ◐ 部分 | 组 K 全过（头块必填键/日期/税表年度/阈值/条目映射）；K5 过窗提醒的「人工触发一次登记输出」未在本会话执行（非阻断 warn 路径，未跑） |
| A-10 | ◐ 部分 | 静态代码实读：ok 零渲染 / Tag 静态色映射 / 「复核受限」状态列 / hard 三值齐备门槛（freshnessTagAndDetail）；三语键 grep 在位；UI 视觉走查（GUI 通道）未做 |
| A-11 | ✗ 未复跑 | 零滚动贪心遍历需 GUI 驱动通道（browser-use/CDP 注入 driver），本会话未接入；**E5 新分页入遍历的六视口复测为唯一未收口验收项，列开放验证** |
| A-12 | ✅ | 上表六行全绿 + 净增 +2,924 B ≤ 记账上限；Phase C 闸门裁决=缓置（台账在案） |

### 四、README 双语数据口径核对（文档收口轮交付）

- **更新 8 处 ×2 语**：CAUTION 快照年度句（「2024–2025 年度口径、2026-11 查证」→「2025–2026 年度口径、2026-11-25 数据补充轮复核」+ 页内「数据时效清单」指引）；面板⑦示例（社平 10,343→**10,787** + 复算新数值）；bootstrap 示例（20 个样本 2005–2024→**21 个样本 2005–2025** + 新数值，并补「面板另提供沪深300全收益 / 中债新综合财富序列」）；序列滚动示例（同上 + **11→12 个起点窗口**）；税档功能行（2025→2025–2026，US/DE 2026、日/新/澳/加复核受限注）；税档来源表行（IRS Rev. Proc. 2024-40→**2025-32**、DE 注 2026 课税年度公式）；GDP 来源表行（2024 年值→GDP 2025、消费率仍 2024 + 复核日）；bootstrap / 序列两功能行的可选序列清单（四序列）。
- **复算方法与夹具自校验**（诚实性锚）：复用 check-lifecycle.mjs 同款 harness（esbuild bundle finance.ts + 真实 wasm 二进制注入，临时脚本用后即删）跑 calcPension / calcMonteCarlo / calcMonteCarloBootstrap / runSequenceRolling；夹具正确性以**旧值逐字节复现**自证四组——社平 10,343 → ¥2,842.03（¥2,482.32+¥359.71）/95%/¥147.97/¥271,025.6、正态 seed 42 → 94.4%/¥64,936.61、旧 20 值 bootstrap seed 42 → 62.4%/¥4,156,029.52/¥92,520,332.77、旧 20 值滚动 → 11 窗口/最好（2006）3.5×/中位 1.11×/最差（2008）0.19×。四组全中后落定新值：社平 10,787 → **¥2,948.59（基础 ¥2,588.88 + 个人账户 ¥359.71）/99%/¥41.41/¥219,876.8**；21 值 bootstrap → **59.7% / ¥4,485,764.59 / ¥113,237,764.96**（中位数终值仍 ¥0）；21 值滚动 → **12 个起点窗口**、最好（2006）3.5× / 中位 1.11× / 最差（2008）0.19×（README 只引最好/最差起点与倍数——二者不变；中位起点 2014→2013 属同倍数下「取较差者」口径平移，不涉 README 文句）。
- **演示截图未重制**：docs/assets/demo-*.png 摄于 P11 前状态，两处示例句尾已注明「演示截图摄于…前，界面数值以本句为准」（截图重制列为下轮可选）。
- **README 断言锚零回退**：check:data 组 A5（35,869 在位）/ A6（34,557·2,880 清零）/ F6（默认值免责行 53.8）复跑全过——§6-3「README 零改动」系实施轮红线；文档轮数据口径核对后经全量门禁复跑确认。

### 五、残留与移交

1. **sp500long 落库（下轮首选项）**：实施轮按 §7.3-3 闸门裁决缓置（台账 §八行登记）；本会话复测余量 2,515 B **≥ §7.3-1 直落阈值 2,200 B**——两读数并存如实登记，下轮按 §7.3 复评直落（J1 锚预登记 + Damodaran 54 值实读在案，落库即登记）。
2. **A-11 零滚动全矩阵复测**（含 E5 新分页贪心遍历，六视口）——GUI 驱动通道，本会话未跑；唯一未收口验收项。
3. K5 过窗提醒人工触发登记（未跑）；I5 年金 PDF 直读、T6/T7/T8/T9 年度复核、I17/I1/I2 待证清单按 @data-meta NEXT_DUE 节奏走。
4. InsightsPanel.tsx:336 注释残句勘误（`freshnessColChecked`「三语在位」与实况不符）——下轮代码顺手清理。
5. D6/D7/D8 占位项「缺登记→待校准」专项清单移交数据研究员（§5 实施顺序 ④——本收口轮未执行采值）。
6. check-share 未随 P11 扩展新 id roundtrip 断言（现由 check:data 组 J0 白名单字面量断言 + 本会话抽查承载）；下轮落 sp500long 时建议一并补 roundtrip 断言与第五白名单字面量。
