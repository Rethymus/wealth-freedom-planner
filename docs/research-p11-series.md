# P11 研究笔记：指数序列结构审计与扩展设计（蒙特卡洛抽样源）

| 项目 | 说明 |
|---|---|
| 文档性质 | 研究笔记：审计既有年度收益序列结构，给出可溯源的新序列候选、区间元数据 schema 与 check:data 断言扩展设计。非实施规范——数值录入须由实施会话按 §2 各候选「获取路径」独立查证后落库（p1-spec §0 纪律：本会话实跑，非转引） |
| 规范输入 | `src/data/indexSeries.ts`（61 行全读）、`src/components/advanced/MonteCarloPanel.tsx`（全读）、`docs/p8-spec.md`（全读：引擎消费口径与 dist 预算）、`src/services/share.ts` / `src/store/useCalculatorStore.ts`（seriesId 消费点 grep 定位）、`scripts/check-data.mjs`（全读）、`scripts/check-size.mjs`（门禁行读取）、`docs/p1-spec.md` §0（查证记录格式） |
| 本会话实跑 | `node scripts/check-size.mjs`（门禁通过，逐文件字节实测）；`node -e` 体积估算 ×2；三路外部来源实测取证（GuruFocus H00300 年度表、Damodaran 数据页、中债-新综合指数词条+官方查询平台入口）——取证命令与输出摘录见附 A |

---

## §1 现有序列结构审计

### 1.1 数据结构（src/data/indexSeries.ts 实读）

| 要素 | 现状 | 行号 |
|---|---|---|
| `IndexId` 联合 | `"csi300" \| "sp500"` 两值 | indexSeries.ts:8 |
| `IndexSeries` 接口 | `id / firstYear / annualReturnsPct / source / kind / note` 六字段 | indexSeries.ts:14-26 |
| `kind` 口径枚举 | `"price"`（不含股息）｜`"total"`（含股息再投资） | indexSeries.ts:23 |
| 序列登记 | `INDEX_SERIES: Record<IndexId, IndexSeries>` 两序列 | indexSeries.ts:28-58 |
| 展示顺序 | `INDEX_ORDER = ["csi300","sp500"]`（与 Record 键序解耦） | indexSeries.ts:61 |
| 区间纪律 | 「2026 年为不完整年度，一律不录入」（文件头注释） | indexSeries.ts:4 |

**区间/口径现值**：csi300 = 2005–2024、20 样本、**价格指数**（不含股息，note 自认「约 2%/年低估总回报」，indexSeries.ts:42）；sp500 = 2005–2025、21 样本、**总回报**（含股息再投资，indexSeries.ts:56）。起止年/样本数**不落盘**——运行时由 `firstYear + annualReturnsPct.length` 派生（MonteCarloPanel.tsx:378-385 的 `lastYear: seqSeriesMeta.firstYear + seqSeries.length - 1`）；拉取日期只存在于 `source` 散文（「2026-11-18 拉取」），无机读字段。

### 1.2 消费面盘点（grep 实测全量）

| 消费点 | 位置 | 用途 |
|---|---|---|
| bootstrap 抽样注入 | MonteCarloPanel.tsx:299 `series: INDEX_SERIES[seriesId].annualReturnsPct` | 有放回重抽的样本源（唯一直接数值消费） |
| 序列风险对照 | MonteCarloPanel.tsx:221-222、:236（`runSequenceRolling(seqSeries, firstYear, …)`） | 滚动窗/三序对照逐段切片 |
| 序列选择器 ×2 | MonteCarloPanel.tsx:531-537（bootstrap 模式页）、:830-836（序列风险子区） | `INDEX_ORDER.map` 出 options |
| 口径句组装 | MonteCarloPanel.tsx:378-385 `seriesNoteText`（插值 `{{name}}{{firstYear}}{{lastYear}}{{count}}{{kind}}{{source}}`）→ FieldTip | 样本区间+口径+来源展示（模板 zh-CN.ts:515） |
| id→i18n 映射 | MonteCarloPanel.tsx:63-66 `INDEX_NAME_KEY`、:68-71 `INDEX_KIND_KEY` | **按 id 硬编码两份 Record**——新增序列须改面板两处 |
| 分享载荷 | share.ts:75（类型）、**:320 白名单** `seriesId !== "csi300" && seriesId !== "sp500" → return null` | 新 id 不改此处则分享链接解码失败 |
| store | useCalculatorStore.ts:124/:192（默认 `"csi300"`）/:319/:346 | 状态切片与 share 往返 |

### 1.3 口径矩阵（名义 × 价格/全收益）

|  | 价格（不含股息） | 总回报（含股息/票息） |
|---|---|---|
| **名义**（未扣通胀） | csi300（现有） | sp500（现有）；C1/C2/C3/C4（候选全在此格） |
| **实际**（扣通胀） | —— 数据层**有意不留实际序列**：通胀是 MC 引擎独立抽样流（`inflationMeanPct`，MonteCarloPanel.tsx:113-115 锁态同帧覆盖），实际回报 = 名义样本与通胀样本的组合结果，两条流分开抽样保留联合分布的自由度 | 同左 |

引擎侧（p8-spec 口径）：生命周期引擎为**零随机均值引擎**，不消费任何序列（p8-spec §2.1，:176「确定性口径」裁定）；序列进入引擎的唯一合规路径是 `SampleProvider` 注入缝（p8-spec §1.3 :134-146、§2.1.4 :179「经本缝注入历史序列，零新随机消费」）。**本轮扩展不触碰 wasm**。

### 1.4 缺口清单（扩展动机）

1. **口径不对称**：A 股只有价格口径（低估总回报 ~2%/年）、美股只有总回报——同一面板内两序列口径不可比。
2. **资产类别缺口**：无债券类序列——自助抽样只能模拟纯权益路径。
3. **样本量小**：两序列各 20/21 样本，有放回重抽的经验分布粗糙（极端年 2008 仅 1 个样本点）。
4. **区间元数据不可机读**：无 `fetchedAt`/`sourceUrl` 字段，check:data 无法对「拉取日期/来源」做断言。
5. **面板映射硬编码**：`INDEX_NAME_KEY`/`INDEX_KIND_KEY` 两份按 id 的 Record（MonteCarloPanel.tsx:63-71）——扩序列必须同步改面板，遗漏即裸键。

---

## §2 新序列候选（4 个；全部总回报口径、名义值）

> 录入纪律（沿 p1-spec §0）：实施会话须按各候选「获取路径」重新拉取并在该轮研究文档登记查证记录；本节的「本会话实测」仅为可达性与形态取证，**不构成录入值**。2026 年为年内不完整年度，一律不录入（indexSeries.ts:4 同款）。

### C1 沪深300全收益（中证 H00300）——A 股口径升级，优先级 P0

- **来源**：一手 = 中证指数有限公司官网（csindex.com.cn，「沪深300全收益指数」检索页，本会话搜索命中官网条目）；二手交叉 = GuruFocus CN 指数页 H00300 年度涨跌幅表。**本会话 2026-11-24 实读 GuruFocus 全表**（2017–2025 明文可读）：2025=+20.98、2024=+18.24、2023=−9.14、2022=−19.84、2021=−3.52、2020=+29.89、2019=+39.19、2018=−23.64、2017=+24.25；同页价格指数列 2017–2024 与库内 csi300 序列**逐值一致**（+24.25/+21.78/−25.31/…/+14.68）——二手交叉验证通过。
- **区间**：2005–2025，21 样本（与价格指数同基日 2004-12-31，实施时以官网指数文件复核基点口径）；2026 YTD（页面示 −12.67%）不录入。
- **获取路径**：① 官网指数详情页历史行情下载（Excel）→ 按年末收盘独立复算年度涨跌幅（p1-spec §0 对 csi300 的同法复算先例）；② GuruFocus 年度表逐值交叉（免费、免登录）。官网下载端点本会话未直连验证（页面为 SPA）——**实施首验项，失败则回退 GuruFocus 表为录入源并登记**。
- **定位**：**并列新增**（不替换 csi300——旧 id 已入分享链接，改名破坏兼容；`kind: "total"` 让用户自选口径）。
- **体积**（本会话 node 实测）：数据对象 **616 B** + 显示名三语 ≈124 B ≈ **740 B**。

### C2 中债-新综合财富指数（CBA00101）——债券类补全，优先级 P0

- **来源**：中国债券信息网（chinabond.com.cn）/中债金融估值中心——官方一手。**本会话实测**：官方查询平台 yield.chinabond.com.cn「中债指数」单指数查询入口在位；指数词条（2026-11-24 读取）确认：财富指数代码 **CBA00101**、基日 2001-12-31=100、财富指标含票息（利息与提前偿付本金按月度再投资回组合）、每交易日发布；公募基金（易方达中债新综合等）以其为跟踪标的。
- **区间**：2002–2025，24 样本（基日次年起算）；2026 不录入。
- **获取路径**：官方平台按年查询年末财富指标值 → 相邻年末比值复算年度收益（同「独立复算」纪律）；统计月报 PDF（官网「中债指数产品动态」栏目）交叉。
- **锚值**：本会话未实读年度值——**录入会话按官方查询实读登记**（禁从实现输出反推，check:data J1 同口径）。
- **体积**（实测）：**596 B** + 124 B ≈ **720 B**。

### C3 标普500含股息长历史（Damodaran 表）——样本区间延深，优先级 P1

- **来源**：NYU Stern Aswath Damodaran「Historical Returns on Stocks, Bonds and Bills」数据页。**本会话 2026-11-24 fetch 实测可达**：全表 1928–2025（页面更新 2026-01-05），列名「S&P 500 (includes dividends)」；实测行样：1928=+43.81%、1929=−8.30%、2025=+17.78%。
- **口径交叉注记**：2025 年 Damodaran +17.78% vs 库内 sp500（Slickcharts）+17.88%，差 0.10pp——两源股息估计 vintage 不同所致，如实登记为口径差异，不强行调和。
- **区间**：两档——**全档 1928–2025（98 样本）**；**裁剪档 1972–2025（54 样本）**（1971 前含大萧条/战时管制期，且 54 档体积减半）。推荐裁剪档起步。
- **定位**：并列新增（sp500 不动，默认序列 store:192 不变）；bootstrap 的抽样池选择是用户显式动作，长样本价值（98/54 个独立年样本）由面板口径句的 {{count}} 透明呈现。
- **体积**（实测）：全档 **2,231 B**、裁剪档 **1,417 B**（各 +124 B i18n）。

### C4 美国十年期国债总回报（Damodaran 同页）——债类跨市场对照，优先级 P2（备选）

- **来源**：同 C3 同一页面「US T. Bond (10-year)」列（本会话实测同表在位；1928=+0.84%、2025=+7.80%）。
- **区间/口径**：1928–2025 或 1972–2025 同 C3 两档；票息再投资假设口径（页面方法学注记，录入时随 note 登记）。
- **定位**：与 C2 构成中外债类对照；若 dist 余量吃紧先裁（P2）。
- **体积**：同 C3 档位（98 档 ≈2.3 KB、54 档 ≈1.5 KB）。

### 2.5 体积预算（dist 硬约束）

**门禁实测（本会话 `node scripts/check-size.mjs`）**：dist 15 文件合计 **1,994,561 B**、门禁 2,000,000 B（check-size.mjs:34）→ **余量 5,439 B**；wasm 356,864 B、门禁 800,000 B（:35，余量充足）。

| 批次 | 内容 | 实测合计 | 余量后 |
|---|---|---|---|
| Phase 1 | C1+C2（P0） | ≈1.5 KB | ≈3.9 KB |
| Phase 2（54 档） | C3+C4 | ≈3.1 KB | 两相合计 ≈4.5 KB，**<1 KB 缓冲** |
| Phase 2（98 全档） | C3+C4 | ≈4.7 KB | 两相合计 ≈6.2 KB，**超门禁**——禁入 |

> 估算口径：`JSON.stringify` 序列对象 + 三语显示名的 UTF-8 原始字节（minified 对象字面量近似，±30%）；真值以 `npm run build && npm run check:size` 为准。Phase 2 落地前必须走 p8-spec §6.3 同款回收盘点（i18n 并合 → 裁展示项），或维持 54 档并接受 <1 KB 缓冲的显式登记。scripts/（check:data 扩展）不进 dist——零体积成本。

---

## §3 区间元数据 schema（起止年/样本数/口径 入数据结构）

### 3.1 IndexSeries 扩展（单一真源派生，冗余字段禁落盘）

```ts
export type IndexId = "csi300" | "sp500" | "csi300tr" | "cba00101" | "sp500long" | "ustbond10";
// 只增不改：旧 id 是分享链接载荷的一部分（share.ts:75/:320），改名即断链

export interface IndexSeries {
  id: IndexId;
  firstYear: number;            // 既有
  annualReturnsPct: number[];   // 既有
  kind: "price" | "total";      // 既有（债类归 "total"：财富/总回报 = 含票息）
  source: string;               // 既有：一句话来源（机构名 + 表名，日期迁出）
  note: string;                 // 既有：口径备注
  // —— P11 新增四字段 ——
  nameKey: string;              // i18n 显示名键——收编 MonteCarloPanel INDEX_NAME_KEY（:63-66）
  kindKey: string;              // 口径说明键——收编 INDEX_KIND_KEY（:68-71）
  fetchedAt: string;            // "YYYY-MM-DD" 拉取/读取日期（机读；check:data J3 断言）
  sourceUrl?: string;           // 可溯源 URL（机读；不入 UI 文案，避免口径句膨胀）
}

/** 区间三件套派生助手（唯一实现；end/count 永不落盘——冗余落盘必漂移，J2 兜底） */
export function seriesRange(s: IndexSeries): { start: number; end: number; count: number } {
  return { start: s.firstYear, end: s.firstYear + s.annualReturnsPct.length - 1,
           count: s.annualReturnsPct.length };
}
```

### 3.2 面板展示（样本区间 + 来源显示）

- `seriesNoteText`（MonteCarloPanel.tsx:378-385）现有插值已承载「样本区间 + 样本数 + 口径 + 来源」四要素（zh-CN.ts:515 模板）；新增 `{{fetched}}` 插值将拉取日期入句（三语各 ≈10 B，或维持日期并入 `source` 散文实现零键增量——**推荐 `{{fetched}}` 独立插值**：日期机读后与机构名解耦，J3 断言可直接锚 `fetchedAt` 字段而非散文）。二选一，实施时登记取舍。
- 两份 id→键 Record 删除，选择器 options 与口径键改读数据字段（`t(s.nameKey)` / `t(s.kindKey)`）——新增序列零面板改动；`INDEX_KIND_KEY` 的两值本就是 kind 语义（price/total），收编后不新增 i18n 键。
- `sourceUrl` 不入 UI：口径句已属长文案（P5 冗长治理收敛史），URL 可溯源职责由 check:data J3 与 docs 台账承载。

### 3.3 分享兼容硬同步点

share.ts:320 白名单是扩展的**唯一硬同步点**：新 id 若未加入该条件串，携带新 id 的分享链接解码即 `null`（静默失效）。旧序列 id 永不改名；默认序列 `"csi300"`（store:192）不随扩展变更。

---

## §4 check:data 三联断言扩展设计（组 J：锚值 + 年份 + 来源）

现状：check-data.mjs 九组断言（A–I，:134-353）对 indexSeries **零覆盖**（全读核实）。新增**组 J**（A–I 零变化锁定），沿用既有管道：`loadModule("../src/data/indexSeries.ts","indexSeries")`——该文件无 import，现有 deps 机制（check-data.mjs:54-76）零改动可用；断言纪律沿 :28「独立推导算式入注释，禁魔法期望数」。

### J0 结构前置（防扩展半成品）

- `INDEX_ORDER` 数组与 `Object.keys(INDEX_SERIES)` **全等**——孤儿序列（在库不在单）UI 不可见即静默死数据。
- 逐 id 断言 share.ts 源文本含 `seriesId !== "<id>"` 字面量（readFileSync share.ts + 字符串模板生成）——**白名单同步强制**（§3.3 遗漏即红）。
- 三语 flats 含每序列 `nameKey` 键值（防裸键；复用现 flats 机制 :118-127）。

### J1 锚值（三联之一）：`PER_SERIES_ANCHORS: Record<IndexId, Array<[year, value]>>`

| id | 锚值（year, %） | 本会话取证状态 |
|---|---|---|
| csi300 | [2005,−7.66]、[2008,−65.95]、[2015,5.58]、[2024,14.68] | 库内在值（indexSeries.ts:35-39），J1 先锁现状 |
| sp500 | [2005,4.91]、[2008,−37.00]、[2020,18.40]、[2025,17.88] | 库内在值（:49-53） |
| csi300tr | [2024,18.24]、[2025,20.98] | **本会话 GuruFocus 实读**（2026-11-24），录入时按官网复算值登记 |
| sp500long | [1928,43.81]、[2025,17.78] | **本会话 Damodaran 实读** |
| ustbond10 | [1928,0.84]、[2025,7.80] | **本会话 Damodaran 实读** |
| cba00101 | 待录入会话实读登记 | 未实读（诚实登记，禁占位） |

断言：`arr[year − firstYear] === value` 严格相等（数据层字面量两位小数，JSON 往返无损）。

### J2 年份（三联之二）

- `seriesRange(s)` 三值与派生式恒等（自证单一真源；未来若引入冗余落盘字段即漂移暴露）。
- 逐 id 期望样本数表 `COUNTS[s.id]`（csi300=20、sp500=21、csi300tr=21、cba00101=24、sp500long=54/98、ustbond10 同档）。
- `seriesRange(s).end ≤ 2025`——「2026 不完整年度禁入」的机读镜像（indexSeries.ts:4）。
- 每锚值年 ∈ [firstYear, lastYear]；逐值 `isFinite(v) && v > −100 && v < 1000`（年度收益物理域：−100 为全损边界必须严格大于）。

### J3 来源（三联之三）

- `source` 含逐 id 机构名关键字（配置表：csi300→「行情历史」、csi300tr→「中证指数」、sp500→「Slickcharts」、cba00101→「中国债券」、sp500long/ustbond10→「Damodaran」）。
- `fetchedAt` 匹配 `/^\d{4}-\d{2}-\d{2}$/` 且 ≤ 当日（防占位未来日期）。
- kind 语义一致性：`kind==="price"` ⇒ note 含「不含股息」；`kind==="total"` ⇒ note 含「含股息」或「含票息」（股债两族）。
- `sourceUrl` 在位时含 `"http"` 且域名前缀命中白名单（csindex.com.cn / chinabond.com.cn / stern.nyu.edu / gurufocus.cn / slickcharts）。

预期新增断言 ≈30 处；`check:data` 输出句补「序列溯源」段。**实施顺序**：J0/J2/J3 可与 schema 扩展同轮落（断言即锁现值）；J1 的 csi300tr/cba00101 锚值随各序列录入轮登记。

---

## 附 A：本会话取证记录（命令与关键输出）

| # | 命令/方法 | 关键输出 |
|---|---|---|
| A1 | 读 src/data/indexSeries.ts 全文（61 行）、MonteCarloPanel.tsx 全文、docs/p8-spec.md 全文、scripts/check-data.mjs 全文 | §1 全部行号引证；check:data 九组无序列覆盖 |
| A2 | `grep -rn "INDEX_SERIES\|INDEX_ORDER" src scripts` | 消费面全量 = MonteCarloPanel×6 + indexSeries 自身 + share.ts:29 + store:24（§1.2） |
| A3 | `node scripts/check-size.mjs` | `DIST_TOTAL_KB=1948`、`WASM_MAX_KB=349`、门禁通过；逐文件字节求和 1,994,561 B（余量 5,439 B）；门禁值 check-size.mjs:34-35 实读 |
| A4 | `node -e`（JSON.stringify 字节计量 ×2） | stock21=616 B / bond24=596 B / dam98=2,231 B / dam54=1,417 B / 三语显示名=124 B（§2.5） |
| A5 | WebFetch Damodaran histretSP 页 | 全表 1928–2025（更新 2026-01-05）；1928=43.81、2025=17.78；T.Bond 列 1928=0.84、2025=7.80 |
| A6 | fox_fetch GuruFocus H00300 表页 | 2017–2025 年度全收益表逐值在位；价格列与库内 csi300 2017–2024 逐值一致 |
| A7 | fox_fetch 中债-新综合指数词条 + 官方查询平台入口搜索 | CBA00101、基日 2001-12-31=100、财富指标含票息月度再投资；yield.chinabond.com.cn 入口在位 |
| A8 | 禁词自检 | 本文档按 p8-spec §7⑩ 同式扫描（模式字面量自身除外）零命中——入库前同法复扫 |

## 结论（三条）

1. **既有结构健壮但口径与样本双缺口**：两序列消费链清晰（bootstrap 唯一数值注入 + 白名单一处硬编码），但 A 股价格口径/美股总回报不可比、无债券类、各 ≤21 样本——C1（csi300tr，740 B）+ C2（cba00101，720 B）为 P0 补全，合计 ≈1.5 KB，余量 5,439 B 内无压力，且双源交叉（官网一手 + 本会话实读二手）可溯源。
2. **区间元数据须先机读化再扩序列**：`fetchedAt`/`sourceUrl`/`nameKey`/`kindKey` 四字段入 `IndexSeries` + `seriesRange()` 单一派生，收编面板两份硬编码映射；share.ts:320 白名单是唯一硬同步点，由组 J0 断言强制；引擎零触碰（p8 零随机裁定 + SampleProvider 缝是序列进引擎的唯一合规路径）。
3. **check:data 组 J 三联断言让序列「可审计」**：锚值（J1，逐 id 年→值严格相等）+ 年份（J2，派生恒等/样本数/2026 禁入/物理域）+ 来源（J3，机构关键字/日期/口径语义/域名白名单），沿既有 loadModule 管道零依赖落地、零 dist 成本；长历史候选（C3/C4）在当前余量下必须走 54 样本裁剪档或先执行 p8-spec §6.3 回收令，98 全档（合计 ≈6.2 KB）超门禁禁入。
