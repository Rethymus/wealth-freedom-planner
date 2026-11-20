# P3「愿景细节」实现规范

| 项 | 值 |
| --- | --- |
| 文档性质 | 实现规范：P3 冲刺可直接施工的文件级改动清单与逐字契约；两份研究（视频口径查证 / 响应式专项）采纳清单已逐条裁定落入 §0 |
| 读者 | 数据方（`src/data/**`、i18n 三份）、界面方（`src/components/**`、`src/App.tsx`、`src/styles/global.css`）、文档方（`README.md` / `README.en.md`） |
| 上游依据 | `docs/research-video-data.md`（下称「数据研究」，2026-11-19 查证，含结构化采纳清单 18 条与偏差汇总 4 条）、`docs/research-responsive.md`（下称「响应研究」，含断点决策矩阵 §10 与采纳清单 D1–D10 §11） |
| 中性约定 | 沿用仓库既有命名纪律：不出现来源品牌名、人名、机制俗称；新增标识符一律 `wf-` / `--wf-` / `INSIGHT_` / `use*` 前缀，自查表见 §10 |
| 门禁 | `npm run build`（= `tsc --noEmit && vite build`）、`npm run check:size`、`cargo test --manifest-path src/wasm/Cargo.toml`（确认零改动仍绿）、i18n 三份语言资源键集全等比对（recipe 见 §9 #6）、新增断言见 §9 |
| 核心边界 | **无 WASM / bridge / services / store 改动**：基础公式 `临界值 = 月开销 × 乘数 + 孩数 × 单孩成本 + 健康预留 + 重大投入`（`src/wasm/src/baseline.rs`）与反向估算永续提取公式（`src/wasm/src/reverse.rs`）一字不动；本轮全部改动为数据层、界面层、样式层与文档 |

---

## 0. 范围定夺

### 0.1 数据研究采纳清单 18 条裁定（全部落 `src/data/insights.ts` + 面板⑨）

| 研究条目 # | 录入值（研究裁定口径） | 核证标注 | 落点 |
| --- | --- | --- | --- |
| 1 | 一年期定存 0.95%、五年期 1.30%（2025-05-20 生效挂牌利率） | 媒体核证 | §2 `INSIGHT_CHAIN_STEPS` 第 1–2 环 |
| 1b | 核心通胀 **1.2%**（2025-12 核心 CPI 同比；视频口径 1.0% 与发布值不一致） | 媒体核证 | §2 链条第 3 环 |
| 2a | 社保基金 7.39%（2000–2024 年均，官方年报原文） | 官方核证 | §2 链条第 4 环 |
| 2b | 企业年金 6.17%（2007–2024 年均） | 媒体核证 | §2 链条第 5 环 |
| 3 | 费用损耗合计 2–3pp（视频口径）；显性费率锚 1.4pp（证监会 2023 费率改革上限口径） | 视频口径（含媒体锚） | §2 链条第 6 环 |
| 4 | 名义 4%–4.5%（本工具默认 4.5%）、长期通胀 2%（本工具默认 2.0%；2022–2025 实际均值 ≈0.6% 随条标注）、实际 2%–2.5%（费雪近似复算） | 视频口径 | §2 链条第 7–9 环 |
| 5 | 育儿成本**以报告原文为准**：全国 53.8 万（0–17 岁）、上海 101 万、北京 93.6 万、最低省份西藏 34.9 万；孩次系数 1 : 0.79 : 0.60；相对人均 GDP 6.3 倍（所列国家第二，仅次于韩国 7.79 倍）。视频口径 58 / 100 / 108 万与「贵州 43 万最低」「每多一孩 −15%」不采纳，偏差在面板内如实标注 | 媒体核证 | §2 `INSIGHT_CHILD_COST_REGIONS` + i18n `insights.childNote` / `insights.childVideoNote` |
| 6 | 医疗年锚 6,454.4 元/年（2024 卫生健康统计公报）；终身 20 万、二线 15–30 万、一线 30–60 万为视频估算，附保守区间 15–50 万 | 年锚媒体核证；终身值视频口径 | §2 `INSIGHT_HEALTH_ENTRIES` |
| 7 | 市场平均消费：全国 2,456 元/月、城镇 2,989 元/月（2025 年，口径含居住 / 医疗保健 / 教育文化娱乐；本工具默认月开销 2,990 即城镇口径取整） | 官方核证 | §2 `INSIGHT_MARKET_ENTRIES` |
| 8 | 算例定性为**视频推演（演示口径，非官方文件）**：直除法「净可投资额 ÷ 480 月」与永续提取口径在默认回报假设下数值一致；反推例 2 视频称 ≈0.9 万含约 10% 不可复算折让 | 演示口径 | §4 演示算例按钮 + 断言 |
| 18 | 480 月（40 年 × 12 月）直除口径随条目 8 一并标注 | 演示口径 | §4 注释行 |

数据研究 §三「偏差汇总」4 条全部执行：生育成本系统性偏差（条目 5）按报告原文录入并在面板标注；「全国平均口径混用」（条目 8：2,990 为城镇口径）在 `insights.marketNote` 说明；「官方算例」不作为官方引用（按钮组更名「演示算例」，见 §0.3 偏差 #1）；2–3pp 损耗 / 终身医疗 20 万 / 名义 4%–4.5% / 长期通胀 2% 全部带「视频口径」标注与保守区间。

### 0.2 响应研究采纳清单 D1–D10 裁定

| 研究项 | 裁定 | 落点 |
| --- | --- | --- |
| D1 断点体系五档登记（375/640/768/1024/1440，768 唯一硬断点） | **采纳断点数值；书写口径调整**：研究原文「CSS 一律 `min-width` 书写（移动优先）」与本仓既有窄屏规则的 `max-width: xxx.9px` 约定（global.css:191/555/716）相左，新增样式统一按 §6.1 的 `max-width` 口径书写（偏差登记 §12 #11） | §6.1 |
| D2 顶栏收纳（375 两行堆叠 / 640 收纳态 / ≥768 现状；标签隐藏以视觉隐藏保读屏；Select 窄档 104/88 → 110/96 → 150/130；aria-label 三处全量落地——组件库透传能力已核实，见 §6.2） | **采纳** | §6.2 |
| D3 两列切点维持 768；<640 关闭 FieldRow 水平 gutter | **采纳** | §6.3 |
| D4 Descriptions 维持 767.9 纵横切点；<640 值右对齐 + 等宽数字 | **采纳** | §6.3 |
| D5 图表高度三档 240/280/320；紧凑档 X 刻度 ≤5、YAxis 宽 72→56 | **采纳**（龙卷风图 240 恒定不改；收租瀑布图窄屏不渲染、改判不适用——RentalPanel 零改动，避免未登记的桌面 280→320 变化；研究提及的「多路径折线图例隐藏」经现状核对无适用面——全仓无 `<Legend>` 组件，图例均为 HTML 数值行，维持现状） | §6.4 |
| D6 触控目标缺口（预设按钮 44、场景 mini 按钮包装、折叠头 44；提示图标触屏退化列为不实施，研究原文即标注低优先级） | **采纳前三项** | §6.5 |
| D7 表格首列 sticky、右缘渐隐、滑动提示、列宽纪律 | **采纳**（渐隐与提示的生效断点按 §6.6 DevTools 实测校准为 <688.9px——初校准 687.9，S3-5 扩展实测发现 688 处 1px 死区后放宽；对比表滚动链裁切层处置见 §12 偏差 #9/#13） | §6.6 |
| D8 底部吸附操作条（复制分享常驻自然可达区；运行模拟落位） | **调整后采纳**：复制分享入全局底部吸附条；MC 运行按钮以「面板内 sticky-bottom 复用按钮」实现（效果等价，避免跨面板事件编排），见 §12 偏差 #7 | §6.7 |
| D9 输出卡紧凑模式（<640 环 56px、明细拆解摘要 + 展开；吸附态自动压缩高度不遮挡输入区） | **采纳** | §6.8 |
| D10 心理学规范（字段顺序锁定——现状已合规；折叠头追加默认值提示；同屏字段数 ≤4/8/10 与选项 ≤5 双检纪律） | **采纳**（折叠头默认值以 `defaults.ts` 实际值 4.5%/2.0% 为准，研究原文的「6%/2%」为笔误，见 §12 偏差 #6） | §6.9 |

### 0.3 与任务口径的偏差裁定（先读）

任务书给出的四处数值/命名经研究查证后按查证结果执行，逐条登记于 §12：

1. **「官方算例」→「演示算例」**：数据研究条目 8 判定算例无官方出处、属视频推演，「不作为官方引用」；界面命名随之改为「演示算例（视频推演口径）」，中性纪律同时满足。
2. **算例 B 期望断言 = 10,000.00 元/月（而非 ≈9,000）**：本工具永续提取口径下 (600 万 − 120 万) × 2.5% ÷ 12 = 10,000.00 精确成立；视频的 0.9 万含约 10% 额外折让、来源不可复算（数据研究条目 8 复算结论）。UI 注明差异，不按 0.9 万修正。
3. **育儿成本数值采用报告原文**（53.8 / 93.6 / 101 / 西藏 34.9 万），不采用任务书列出的视频值（58 / 100 / 108 / 贵州 43 万）——数据研究条目 5 逐值核对为「与报告原文不一致」「未能复核」。
4. **核心通胀录入 1.2%**（2025-12 核心 CPI 同比发布值），视频口径 1.0% 随条标注（数据研究条目 1b）。

### 0.4 本轮主线与不做清单

- **主线**：F1 数据文件 `src/data/insights.ts` + 面板⑨「公式原理与数据依据」；F2 反推面板演示算例 ×2；F3 两处口径提示文案；F4 响应式专项（D2–D10）；F5 README 双语增补。
- **不做**：`src/wasm/**`、`src/wasm/bridge.ts`、`src/services/**`、`src/store/useCalculatorStore.ts` **零改动**（分享/重置/画像等既有切片全部复用）；不新增 npm 依赖；D6 缺口第 4 项（tooltip 触屏退化，研究标注低优先级）；研究两文档各自「不采纳项」清单全部维持。

---

## 1. 施工顺序（三阶段，阶段门禁）

**开工前置（基线固化，先于阶段 A）**：当前工作树为**未提交状态**（仓库仅 1 个 initial commit「5079973」，P1/P2 的 src/wasm/**、src/services/**、src/store/useCalculatorStore.ts 等 44 个路径全部未提交，本次会话 `git status --porcelain` 实测）。因此 §9.1 #4 的范围审计**不能以 HEAD 为基线**——开工第一步先固化 pre-P3 快照：

```bash
git tag pre-p3   # 或 git stash create / worktree snapshot，任选其一并记录 ref
```

后续所有「相对本轮改动」的审计与回滚都以 `<pre-p3-ref>` 为对照点。

| 阶段 | 内容 | 阶段门禁 |
| --- | --- | --- |
| **A 数据先行** | §2 `src/data/insights.ts`（类型先行）；§8 文案键 48 新 + 2 改写入 i18n **三份**（zh-CN 为基准，zh-Hant / en 同步翻译） | `npm run build` 通过；§9 #6 键集全等 |
| **B 面板 / 算例 / 提示** | §3 InsightsPanel + AdvancedPanel 接线；§4 ReversePanel 演示算例；§5 两处 hint；`global.css` 的 §3/§4/§5 关联样式块 | `npm run build`；§9 断言 A1–A3 手测 |
| **C 响应式专项** | §6 全部：hooks、App.tsx、global.css 响应式区、三图表（MC ×2 + 打工）、两表格、输出卡紧凑、吸附条 | `npm run build`；`npm run check:size`；§9 断点矩阵全表 |

每阶段独立可交付；C 阶段不依赖 B 的运行时行为（仅依赖样式区追加无冲突）。

---

## 2. F1a 数据文件：`src/data/insights.ts`（新文件，逐字）

类型先行、值后补（与 `types.ts` 同纪律）；数值/来源/年份/口径**全部为简中数据口径，不入 i18n**（沿用 presets.ts / pensionParams.ts / rentParams.ts 头注释惯例），界面标签走 `insights.chain*` i18n 键（§8）。

```ts
/**
 * 面板⑨「公式原理与数据依据」数据层（docs/p3-spec.md §2；查证记录见 docs/research-video-data.md）。
 * 纪律：
 * - 核证等级三级——official=官方核证（官方原文页面已直读）、media=媒体核证（官方发布数字经
 *   两家及以上独立媒体转载核对）、video=视频口径（仅见于原视频或分析假设，未独立查证，
 *   不参与本工具计算，仅供理解假设来源）；
 * - value / source / year / scope 为简中数据口径（不入 i18n，同 presets.note 惯例），
 *   链条环节标签走 insights.chain* i18n 键（labelKey 静态映射，禁用模板串拼键）；
 * - 本文件全部为展示数据，不参与任何计算；不得被 src/wasm/** 引用。
 */

/** 核证等级（与研究文档标注体系一一对应） */
export type InsightVerification = "official" | "media" | "video";

/** 单条数据依据（展示行） */
export interface InsightEntry {
  /** 数值（展示字符串，含单位） */
  value: string;
  /** 来源（机构与文件名，简中） */
  source: string;
  /** 数据年份或区间 */
  year: string;
  /** 口径说明（简中） */
  scope: string;
  /** 核证等级 */
  verification: InsightVerification;
}

/** 假设链条环节 */
export interface InsightChainStep extends InsightEntry {
  /** 环节标签 i18n 键（insights.chain* 键空间） */
  labelKey: string;
}

/** 育儿成本地区条目 */
export interface InsightChildCostRegion {
  /** 地区标签（简中；数据层惯例同 rentParams.city，不入 i18n） */
  region: string;
  /** 0–17 岁平均养育成本（万元） */
  costWan: number;
  /** 口径备注（简中，可选） */
  note?: string;
}
```

```ts
/** 假设链条：从存款利率到乘数 480（顺序即展示顺序；研究采纳清单 #1–#4） */
export const INSIGHT_CHAIN_STEPS: InsightChainStep[] = [
  {
    labelKey: "insights.chainDeposit1y",
    value: "0.95%",
    source: "主要全国性商业银行人民币存款挂牌利率（同花顺财经 / 证券日报报道核对）",
    year: "2025-05-20 生效",
    scope: "整存整取一年期挂牌利率，本次调整后首次降至 1% 以下；挂牌为大型国有银行口径，中小银行与大额存单实际利率可能更高",
    verification: "media",
  },
  {
    labelKey: "insights.chainDeposit5y",
    value: "1.30%",
    source: "主要全国性商业银行人民币存款挂牌利率（同花顺财经 / 证券日报报道核对）",
    year: "2025-05-20 生效",
    scope: "整存整取五年期挂牌利率",
    verification: "media",
  },
  {
    labelKey: "insights.chainCoreInflation",
    value: "1.2%（视频口径 1.0%）",
    source: "国家统计局 2025 年 12 月 CPI 发布（2026-01-09）",
    year: "2025-12",
    scope: "扣除食品和能源的核心 CPI 同比；视频口径 1.0% 与发布值 1.2% 不一致，按发布值展示",
    verification: "media",
  },
  {
    labelKey: "insights.chainSsf",
    value: "7.39%",
    source: "全国社会保障基金理事会《全国社会保障基金 2024 年度报告》（官网 2025-09-30 发布，原文已直读）",
    year: "2000–2024",
    scope: "基金自成立以来年均投资收益率（累计投资收益额 19,009.98 亿元）；机构组合层面历史平均值，不代表个人账户实际可得收益",
    verification: "official",
  },
  {
    labelKey: "insights.chainAnnuity",
    value: "6.17%",
    source: "人社部社会保险基金监管局《2024 年度全国企业年金基金业务数据摘要》（2025-03 发布，经东方财富 / 财经网转载核对）",
    year: "2007–2024",
    scope: "自 2007 年市场化投资运营以来 18 年平均年化收益率；另经人社部 2022 年度口径（16 年 6.58%）代入复算 ≈6.18% 吻合",
    verification: "media",
  },
  {
    labelKey: "insights.chainFeeDrag",
    value: "2–3 个百分点（显性费率锚 1.4pp）",
    source: "原视频估计；显性部分锚定证监会 2023 年公募基金费率改革（主动权益类管理费 ≤1.2% + 托管费 ≤0.2%，央广网 / 新浪财经报道核对）",
    year: "2023 政策口径 / 视频口径",
    scope: "合计含申赎费用、交易损耗与投资者申赎择时行为损耗，为宽口径估计，未经独立研究证实；显性费率 1.4pp 为政策上限口径",
    verification: "video",
  },
  {
    labelKey: "insights.chainNominal",
    value: "4%–4.5%（本工具默认 4.5%）",
    source: "规划假设（原视频）",
    year: "—",
    scope: "无单一权威来源的分析性假设；量级与多资产组合长期历史收益的一般区间一致",
    verification: "video",
  },
  {
    labelKey: "insights.chainInflation",
    value: "2%（本工具默认 2.0%）",
    source: "规划假设（原视频）；已核证实际值：国家统计局历年 CPI（2022 +2.0%、2023 +0.2%、2024 +0.2%、2025 全年持平）",
    year: "2022–2025",
    scope: "四年算术均值 ≈0.6%；视频的「约 2%」高于近年实际，作为长期规划假设属偏保守（稳健方向）",
    verification: "video",
  },
  {
    labelKey: "insights.chainReal",
    value: "2%–2.5%",
    source: "由上两环按费雪近似复算",
    year: "—",
    scope: "(1+4%)/(1+2%)−1 ≈ 1.96%、(1+4.5%)/(1+2%)−1 ≈ 2.45%，取整为 2%–2.5%（算术自洽）",
    verification: "video",
  },
  {
    labelKey: "insights.chainMultiplier",
    value: "480（= 12 ÷ 2.5%）",
    source: "由上一环复算；「480 法则」由此得名",
    year: "—",
    scope: "12 ÷ 0.025 = 480；乘数含义：每 480 元本金支撑 1 元/月的终身开销",
    verification: "video",
  },
];

/** 市场平均消费参考（研究采纳清单 #7） */
export const INSIGHT_MARKET_ENTRIES: InsightEntry[] = [
  {
    value: "2,456 元/月（29,476 元/年）",
    source: "国家统计局《2025 年居民收入和消费支出情况》（2026-01-19 发布，官方原文已直读）",
    year: "2025",
    scope: "全国居民人均消费支出；口径含居住、医疗保健、教育文化娱乐",
    verification: "official",
  },
  {
    value: "2,989 元/月（35,869 元/年）",
    source: "国家统计局《2025 年居民收入和消费支出情况》（2026-01-19 发布，官方原文已直读）",
    year: "2025",
    scope: "城镇居民口径；本工具默认月开销 2,990 元/月即参考此口径取整",
    verification: "official",
  },
];

/** 分城市育儿成本参考（研究采纳清单 #5：以《中国生育成本报告（2024 版）》原文为准） */
export const INSIGHT_CHILD_COST_REGIONS: InsightChildCostRegion[] = [
  { region: "全国（0–17 岁平均）", costWan: 53.8 },
  { region: "上海", costWan: 101, note: "视频口径 108 万与报告原文不符" },
  { region: "北京", costWan: 93.6, note: "视频口径 100 万与报告原文不符" },
  { region: "最低省份：西藏", costWan: 34.9, note: "视频称贵州 43 万最低，未能复核，不采纳" },
];

/** 医疗支出参考（研究采纳清单 #6） */
export const INSIGHT_HEALTH_ENTRIES: InsightEntry[] = [
  {
    value: "6,454.4 元/年",
    source: "国家卫生健康委《2024 年我国卫生健康事业发展统计公报》（2025-12 发布，官方解读页访问受限，数字经媒体转载核对）",
    year: "2024",
    scope: "全国人均卫生总费用（年口径）；9.09 万亿总量 ÷ 人口 ≈ 6,454 元，算术一致",
    verification: "media",
  },
  {
    value: "约 20 万（保守区间 15–50 万）",
    source: "原视频估算",
    year: "2024 年价格水平",
    scope: "终身口径估算，无官方终身支出口径；等额不折现上限参考：6,454.4 元/年 × 80 年 ≈ 51.6 万，实际就医强度随年龄后移，中青年起点可明显低于上限",
    verification: "video",
  },
  {
    value: "二线 15–30 万；一线 30–60 万",
    source: "原视频估算",
    year: "—",
    scope: "终身口径估算，未独立查证；可作为健康预留的可编辑预设参考",
    verification: "video",
  },
];
```

**不放入本文件的项及理由**：① 公式推导 / 严格版 vs 宽松版 / 直观换算锚点为概念解释与算术演示，无「来源/年份/口径」可标，落 i18n 文案（§8 `insights.formula*` / `insights.strict*` / `insights.anchor*`，§12 偏差 #8）；② 孩次系数、报告其余指标落 `insights.childNote` 长文案（与面板行同源展示）。

---

## 3. F1b 面板⑨「公式原理与数据依据」：`InsightsPanel` + 接线

### 3.1 新组件 `src/components/advanced/InsightsPanel.tsx`（逐字骨架）

```tsx
/**
 * ⑨ 公式原理与数据依据：480 的推导、假设链条与展示数据的来源/年份/核证标注。
 * 纯展示面板（无输入、无计算调用）；数据来自 src/data/insights.ts，环节标签走 i18n。
 */
import { Tag, Typography } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";
import {
  INSIGHT_CHAIN_STEPS,
  INSIGHT_CHILD_COST_REGIONS,
  INSIGHT_HEALTH_ENTRIES,
  INSIGHT_MARKET_ENTRIES,
} from "../../data/insights";
import type { InsightEntry, InsightVerification } from "../../data/insights";

const { Text } = Typography;

/** 核证等级 → i18n 键与 Tag 色（静态映射，禁用模板串拼键；色语义：绿=官方 / 蓝=媒体 / 橙=视频口径） */
const VERIFICATION: Record<InsightVerification, { key: string; color: string }> = {
  official: { key: "insights.tagOfficial", color: "green" },
  media: { key: "insights.tagMedia", color: "blue" },
  video: { key: "insights.tagVideo", color: "orange" },
};

/** 通用数据行（链条 / 市场平均 / 医疗共用同一渲染） */
function EntryRows({ entries }: { entries: (InsightEntry & { labelKey?: string })[] }) {
  const { t } = useTranslation();
  return (
    <ol className="wf-insight-list">
      {entries.map((entry) => (
        <li key={entry.labelKey ?? entry.value} className="wf-insight-row">
          <div className="wf-insight-main">
            {entry.labelKey ? <Text>{t(entry.labelKey)}</Text> : null}
            <Text bold className="wf-nowrap">{entry.value}</Text>
            <Tag size="small" color={VERIFICATION[entry.verification].color}>
              {t(VERIFICATION[entry.verification].key)}
            </Tag>
          </div>
          <Text type="secondary" className="wf-insight-source">
            {entry.source}；{entry.year}；{entry.scope}
          </Text>
        </li>
      ))}
    </ol>
  );
}

export default function InsightsPanel() {
  const { t } = useTranslation();
  return (
    <div className="wf-insights">
      <Text bold className="wf-insight-section-title">{t("insights.formulaTitle")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.formulaBody")}</Text>

      <Text bold className="wf-insight-section-title">{t("insights.chainTitle")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.chainIntro")}</Text>
      <EntryRows entries={INSIGHT_CHAIN_STEPS} />

      <Text bold className="wf-insight-section-title">{t("insights.anchorTitle")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.anchorNote")}</Text>
      <div className="wf-insight-list">
        {(["anchorExpense1", "anchorExpense2", "anchorAsset1", "anchorAsset2"] as const).map((k) => (
          <div key={k} className="wf-insight-row">
            <Text>{t(`insights.${k}` as const)}</Text>
          </div>
        ))}
      </div>

      <Text bold className="wf-insight-section-title">{t("insights.marketTitle")}</Text>
      <EntryRows entries={INSIGHT_MARKET_ENTRIES} />
      <Text type="secondary" className="wf-insight-note">{t("insights.marketNote")}</Text>

      <Text bold className="wf-insight-section-title">{t("insights.childTitle")}</Text>
      <div className="wf-insight-list">
        {INSIGHT_CHILD_COST_REGIONS.map((row) => (
          <div key={row.region} className="wf-insight-row">
            <div className="wf-insight-main">
              <Text>{row.region}</Text>
              <Text bold className="wf-nowrap">{row.costWan} 万元</Text>
            </div>
            {row.note ? (
              <Text type="secondary" className="wf-insight-source">{row.note}</Text>
            ) : null}
          </div>
        ))}
      </div>
      <Text type="secondary" className="wf-insight-note">{t("insights.childNote")}</Text>
      <Text type="secondary" className="wf-insight-note">{t("insights.childVideoNote")}</Text>

      <Text bold className="wf-insight-section-title">{t("insights.healthTitle")}</Text>
      <EntryRows entries={INSIGHT_HEALTH_ENTRIES} />
      <Text type="secondary" className="wf-insight-note">{t("insights.healthNote")}</Text>

      <Text bold className="wf-insight-section-title">{t("insights.strictTitle")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.strictBody")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.looseBody")}</Text>

      <Text type="secondary" className="wf-insight-note">{t("insights.evidenceNote")}</Text>
    </div>
  );
}
```

> 施工注：锚点四行的 `t(\`insights.${k}\`)` 若类型门禁不接受模板串，改为显式四元素数组 `[{ key: "insights.anchorExpense1" }, …]` 静态映射——**键必须是字面量来源**（仓库禁模板串拼键纪律），两种写法任选其一。

### 3.2 接线：`src/components/AdvancedPanel.tsx`

- 导入 `InsightsPanel`（`import InsightsPanel from "./advanced/InsightsPanel";`）；
- 在「⑧ 多情景对比」CollapseItem **之后**追加：

```tsx
<CollapseItem name="insights" header={t("advanced.insightsHeader")}>
  <InsightsPanel />
</CollapseItem>
```

- 文件头注释「8 个子面板」改「9 个子面板」，并补一行「P3 新增第 9 个子面板『公式原理与数据依据』（docs/p3-spec.md §3，置于多情景对比之后）」；
- **修改既有键** `advanced.cardTitle`（§8 表 M-1）。

### 3.3 样式：`src/styles/global.css` 追加（P3 面板⑨块）

```css
/* ===== P3 面板⑨ 公式原理与数据依据（docs/p3-spec.md §3.3） ===== */
.wf-insight-section-title { display: block; margin: 20px 0 4px; }
.wf-insight-section-title:first-child { margin-top: 0; }
.wf-insights-body { display: block; margin-bottom: 4px; }
.wf-insight-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.wf-insight-row {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 12px;
  background: var(--wf-tint-bg);
  border-radius: var(--wf-radius-s);
  font-variant-numeric: tabular-nums;
}
.wf-insight-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wf-insight-main .arco-tag { margin-left: auto; }
.wf-insight-source { font-size: 12px; line-height: 18px; }
.wf-insight-note { display: block; margin-top: 8px; font-size: 12px; }
```

### 3.4 呈现判定（验收 A1 的依据）

- 链条 10 环每行四要素齐备：标签（i18n）+ 数值 + 核证 Tag + 「来源；年份；口径」行；
- 三种 Tag 色可区分（绿 / 蓝 / 橙），不依赖色相单独承载语义——Tag 内文字即语义（「官方核证 / 媒体核证 / 视频口径」）；
- 视频口径条目（链条 5 环 + 医疗 2 条）不参与任何计算，仅展示——面板内不出现任何由本文件驱动的数值计算。

---

## 4. F2 反推面板演示算例：`src/components/advanced/ReversePanel.tsx`

### 4.1 数据与交互（在组件文件内、组件函数之前追加，逐字）

```tsx
/**
 * 演示算例（视频推演口径，docs/p3-spec.md §4）：两段静态输入一键填入。
 * 定性：数据研究条目 8——算例为视频自建推演、非官方文件；只采纳其算术框架。
 * 期望断言（填入后，回报假设同步为 4.5 / 2.0，实际 2.5%）：
 * - investableAssets = 4,800,000.00；sustainableMonthly = 10,000.00（±0.01）；yearsSupported = 4.8；
 * - 算例 B 视频称 ≈0.9 万/月，含约 10% 不可复算折让——本工具如实给出 10,000.00，不修正。
 */
const REVERSE_EXAMPLES: { id: "A" | "B"; nameKey: string; inputs: ReverseEstimateInput }[] = [
  {
    id: "A",
    nameKey: "reverse.exampleA",
    inputs: {
      totalAssets: 6_000_000, childReserve: 700_000, healthReserve: 500_000,
      majorInvestment: 0, nominalReturnPct: 4.5, inflationPct: 2.0,
    },
  },
  {
    id: "B",
    nameKey: "reverse.exampleB",
    inputs: {
      totalAssets: 6_000_000, childReserve: 0, healthReserve: 0,
      majorInvestment: 1_200_000, nominalReturnPct: 4.5, inflationPct: 2.0,
    },
  },
];
```

配套：`import type { ReverseEstimateInput } from "../../wasm/bridge";`；`Message` 加入 arco 导入清单。

### 4.2 JSX（置于「与基础模式同步预留与回报假设」按钮**之前**，逐字）

```tsx
<div className="wf-example-bar">
  <Text type="secondary">{t("reverse.exampleLegend")}</Text>
  {REVERSE_EXAMPLES.map((example) => (
    <Button
      key={example.id}
      size="small"
      className="wf-pressable"
      onClick={() => {
        setInputs(example.inputs);
        Message.success(t("reverse.exampleApplied", { name: t(example.nameKey) }));
      }}
    >
      {t(example.nameKey)}
    </Button>
  ))}
</div>
```

面板尾部 `wf-panel-note`（既有 `reverse.note`）之前追加两行注：

```tsx
<Text type="secondary" className="wf-panel-note">{t("reverse.exampleNote")}</Text>
<Text type="secondary" className="wf-panel-note">{t("reverse.exampleBNote")}</Text>
```

**配套样式（global.css P3 区新增，评审补缺）**：

```css
/* 反推面板演示算例按钮行（docs/p3-spec.md §4） */
.wf-example-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0 12px; }
```

### 4.3 行为边界

- 只写 `reverseInputs` 切片（`setInputs` 整体覆盖六个字段），**不触碰** `baselineInputs` / 画像状态 / 分享切片；随后「与基础模式同步」按钮仍可整体覆盖回基础模式口径（既有行为，不冲突）；
- 回报假设随算例填入 4.5 / 2.0 是断言成立的前提（实际 2.5% → 每月可花 = 可投资产 ÷ 480）；用户填入后仍可自由修改；
- 不新增 store 状态、不新增 wasm 调用——断言完全经既有 `useFinanceCall(calcReverse)` 防抖链路呈现。

---

## 5. F3 口径提示（纯文案，核心公式不动）

`src/components/BasicCalculator.tsx` 两处字段加 `hint`（`fields.tsx` 的 hint 通道常态展示、触屏可达，优于 tooltip）：

1. 「买房等重大投入」`AmountField`（BasicCalculator.tsx:633-641）追加 prop：
   `hint={t("basic.majorInvestmentHint")}`
2. 「单孩成本」`AmountField`（BasicCalculator.tsx:612-621）追加 prop：
   `hint={t("basic.childCostHint")}`

**公式边界**：`childCount × costPerChild` 线性结构一字不动（wasm `baseline.rs` 不改）；−15% 折算属用户自选操作，工具不自动应用；已核证孩次系数 1 : 0.79 : 0.60 在面板⑨ `insights.childNote` 呈现，两处口径各自标注、并存不混用。

---

## 6. F4 响应式专项（响应研究 D2–D10 逐条 → 文件级改动）

### 6.1 D1 断点体系（文档纪律）

五档 375 / 640 / 768 / 1024 / 1440；**768 是唯一硬断点**（组件库 md 语义），640 为紧凑收纳档；1024/1440 档不引入新样式（现状桌面布局即目标态；D2 顶栏收纳档 768–789.9 实测补档例外见 §12 #14）。**书写口径**：与研究原文「一律 `min-width`（移动优先）」不同，本仓既有窄屏规则全部为 `max-width` + 0.9px 尾数（global.css:191/555/716），本轮新增样式沿用仓库口径——窄屏档写 `max-width: 639.9px` / `max-width: 767.9px`，区间档写 `(min-width: 640px) and (max-width: 767.9px)`，禁止出现 576/992/1200 等外来断点（书写口径替换登记 §12 #11）。

### 6.2 D2 顶栏收纳：`src/App.tsx` + `global.css`

**JSX 改动（App.tsx:186-207）**：
- 「色盲友好配色」`Text` 标签追加类名：`className="wf-header-label wf-header-label-cb"`；
- 币种 Select：删除 `style={{ width: 150 }}`，改 `className="wf-select-currency"`；语言 Select：删除 `style={{ width: 130 }}`，改 `className="wf-select-lang"`（宽度职责移交样式层，三档断点各管各档）；
- **aria-label 三处（研究 D2 要求，逐字落地）**。透传能力已核（本会话读取组件库源码）：
  - Switch：`es/Switch/index.js:91-92` 经 `omit(rest, ['onChange','checked','error'])` 把任意 props（含 `aria-label`）透传到 `<button role="switch">` → **直写 prop 即可**：`<Switch size="small" checked={colorBlindFriendly} aria-label={t("app.colorBlindLabel")} onChange={toggleColorBlindFriendly} />`；
  - Select：`es/_class/select-view.js:381` 的 `role="combobox"` 根元素只接收 `include(rest, ['onClick','onMouseEnter','onMouseLeave'])` + `htmlDataAttributes` + `id`——`aria-label` **不**经 prop 到达 DOM（内部 input 恒 `aria-hidden`），焦点模式下读屏只报「组合框 + 值」而不含标签。**落地方式**：给两 Select 传 `id`（该 prop 在白名单内，直达 combobox 元素），App 内用一个 effect 按 id 定位写 `aria-label`：

```tsx
{/* D2 aria-label（研究 D2）：Select 的 combobox 元素不接受 aria-* prop（组件库
    select-view.js:381 白名单过滤），以 id 定位补写可访问名称；Switch 可直写。
    语言切换时 t 变化重跑，名称随语言更新。 */}
useEffect(() => {
  document.getElementById("wf-select-currency")?.setAttribute("aria-label", t("app.currencyLabel"));
  document.getElementById("wf-select-lang")?.setAttribute("aria-label", t("app.languageLabel"));
}, [t]);
```

  两 Select 分别加 `id="wf-select-currency"` / `id="wf-select-lang"`。标签的视觉隐藏（CSS）与该 aria-label 并存：后者是焦点态可访问名称的可靠通道，前者保浏览态语义。

**CSS 追加（global.css 布局区之后）**：

```css
/* ===== P3 响应式专项（docs/p3-spec.md §6；断点口径 375/640/768/1024/1440，768 唯一硬断点） ===== */
/* D2 顶栏三档收纳。标签隐藏用「视觉隐藏」而非 display:none——读屏与 DOM 语义保留（源 A：
   尺寸类变化时功能不变、可变的是同屏可见功能数量）。 */
.wf-select-currency { width: 150px; }
.wf-select-lang { width: 130px; }

/* 640–789.9：收纳态——色盲标签视觉隐藏，两 Select 缩至 110/96（宽度预算推导见响应研究 §2.2；
   上界 767.9 → 789.9 为验收 S2-3 实测补档，见 §12 #14） */
@media (max-width: 789.9px) {
  .wf-header-label-cb {
    position: absolute; width: 1px; height: 1px; margin: -1px;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
}

@media (min-width: 640px) and (max-width: 789.9px) {
  .wf-select-currency { width: 110px; }
  .wf-select-lang { width: 96px; }
}

/* <640：两行堆叠——三个文字标签全部视觉隐藏（工具组经既有 flex-wrap 换到品牌行下方），
   品牌标题降 14px，Select 窄档 104/88 */
@media (max-width: 639.9px) {
  .wf-header-label {
    position: absolute; width: 1px; height: 1px; margin: -1px;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
  .wf-header-brand .arco-typography { font-size: 14px; }
  .wf-select-currency { width: 104px; }
  .wf-select-lang { width: 88px; }
}
```

不采用抽屉/溢出菜单（控件 ≤5 个，响应研究 §2.3 优先级第 5 档否决）。

### 6.3 D3/D4 表单与 Descriptions：`global.css`

```css
/* D3 <640 关闭 FieldRow 水平 gutter（组件库经内联样式落 margin/padding，须 !important 压制；
   两列切点维持 768 不变——<640 时全部字段 xs=24 单列，关闭 gutter 只影响列内边距） */
@media (max-width: 639.9px) {
  .wf-field-row { margin-left: 0 !important; margin-right: 0 !important; }
  .wf-field-row > .arco-col { padding-left: 0 !important; padding-right: 0 !important; }
}

/* D4 <640 Descriptions（此时已因 767.9 切点呈 vertical）值右对齐 + 等宽数字：数值列形成视觉右边缘 */
@media (max-width: 639.9px) {
  .arco-descriptions-item-value { text-align: right; font-variant-numeric: tabular-nums; }
}
```

`fields.tsx` 的 `FieldRow` JSX **不改**（gutter 仍 `[16, 0]`，由 CSS 断点覆盖）。

### 6.4 D5 图表三档：`src/components/hooks.ts` + 两个面板（MC / 打工；收租瀑布图不适用，见下表）

**hooks.ts 追加**（`useIsNarrowViewport` 之后）：

```ts
/** 紧凑视口判定（< 640px，P3 响应式专项的紧凑收纳档；与 useIsNarrowViewport 同构） */
const COMPACT_MEDIA_QUERY = "(max-width: 639.9px)";

export function useIsCompactViewport(): boolean {
  const [isCompact, setIsCompact] = useState(() => window.matchMedia(COMPACT_MEDIA_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(COMPACT_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsCompact(e.matches);
    setIsCompact(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isCompact;
}

/** 图表响应式三档（响应研究 D5）：高度 <640:240 / 640–767:280 / ≥768:320；
 *  YAxis 宽 <640:56（刻度字号 12 保持，跌破可读下限的不再缩）/ 其余 72 */
export interface ChartMetrics {
  chartHeight: number;
  yAxisWidth: number;
  isCompact: boolean;
}

export function useChartMetrics(): ChartMetrics {
  const isNarrow = useIsNarrowViewport();
  const isCompact = useIsCompactViewport();
  return {
    chartHeight: isCompact ? 240 : isNarrow ? 280 : 320,
    yAxisWidth: isCompact ? 56 : 72,
    isCompact,
  };
}

/** 紧凑档 X 轴刻度上限 5：按刻度总数返回 recharts XAxis 的 interval 值（非紧凑档不调用） */
export function compactXInterval(totalTicks: number): number {
  return Math.max(0, Math.ceil(totalTicks / 5) - 1);
}
```

**各图表接线**（高度与 YAxis 宽换 hook 值；XAxis 追加 `interval={isCompact ? compactXInterval(N) : undefined}`，N = 刻度总数）：

| 图表 | 位置（本会话逐块核对） | 高度 | YAxis 宽 | interval 总数 N |
| --- | --- | --- | --- | --- |
| 蒙特卡洛主图（50 条路径 + 中位线，`chartData`） | MonteCarloPanel.tsx:826（数据装配 :237-251，行数 = `inputs.years`） | `chartHeight` | `yAxisWidth` | `inputs.years` |
| 序列命运曲线（最好/中位/最差三线，`seqChartData`） | MonteCarloPanel.tsx:661（数据装配 :262-271，行数 = `assetPath.length` = 窗长；`sequence.rs:123` `Vec::with_capacity(years)`、`:151` 每年恰好 push 一次） | `chartHeight` | `yAxisWidth` | 窗长（`seqWindowYears`） |
| 打工积累折线 | AccumulationPanel.tsx:507 | `chartHeight` | `yAxisWidth` | `inputs.years` |
| 收租瀑布图 | **不适用**：该图经 `data && !isNarrow` 短路、窄屏不渲染（RentalPanel.tsx:240-243 注释「md+ 桌面渲染；窄屏不渲染」），240/280 紧凑档与紧凑 interval 对它是死代码；若按表接线会把桌面高度从现状 280 改成 320（未登记的桌面视觉变化）。**RentalPanel 本轮零改动**（高度 280、`interval={0}`（:618）、YAxis 72 均保持） | 现状 280 | 现状 72 | `interval={0}` 不动 |
| 龙卷风图 | BasicCalculator.tsx:189 | **240 恒定不改**（研究矩阵：240 三档不变） | 56 恒定 | 不改 |

图例现状核对结论：全仓无 `<Legend>` 组件（`grep -n "Legend" src/components` 零命中；龙卷风图例为自定义 HTML 行 `wf-sens-legend`），研究 D5 的「紧凑档隐藏多路径图例」**无适用面，不实施**（§12 偏差 #5）。

### 6.5 D6 触控目标缺口：`global.css` + `ScenarioPanel.tsx`

```css
/* D6 触控目标缺口补齐（生效口径与既有触控块一致：触屏或窄屏） */
@media (pointer: coarse), (max-width: 767.9px) {
  /* 预设画像按钮 32 → 44 */
  .wf-preset-btn { min-height: 44px; }
  /* 折叠面板头补最小触控高（整行可点，天然超宽；只加 min-height，不改组件库布局） */
  .arco-collapse-item-header { min-height: 44px; }
}
```

`src/components/advanced/ScenarioPanel.tsx:204-208`：两个 `size="mini"` 文字按钮（载入 / 删除）各自外包触控区扩展；**删除按钮加二次确认**（`Popconfirm`，确定 / 取消按钮文案由组件库语言包随 `ArcoLocaleGate` 联动，无需新键，仅标题一个新键 `scenario.deleteConfirm`；`Popconfirm` 加入 arco 导入清单）：

```tsx
<span className="wf-touch-target-sm">
  <Button size="mini" type="text" disabled={!valid} onClick={() => onLoad(entry)}>
    {t("scenario.load")}
  </Button>
</span>
<span className="wf-touch-target-sm">
  <Popconfirm title={t("scenario.deleteConfirm")} onOk={() => onDelete(entry)}>
    <Button size="mini" type="text">
      {t("scenario.delete")}
    </Button>
  </Popconfirm>
</span>
```

（`wf-touch-target-sm` 既有 +14px padding 扩展使 mini 按钮命中 ≥44px，桌面无副作用。**命中区重叠风险与对策**：两包装相邻 gap 仅 6px，扩展命中区相互重叠约 22px（14+14−6，global.css:431-436），重叠带内 DOM 靠后者胜出——靠载入按钮边缘的误触可能命中删除；现状 `onDelete` 直连 `deleteScenario` 无任何确认（ScenarioPanel.tsx:137-141），误触即丢一个已存情景。对策即上述 Popconfirm 二次确认（误触不再直接销毁数据）；如施工实测仍有困扰，可再在两包装间补 `margin-inline-start: 2px` 隔断，属可选项、登记 §12 #12。）字段提示图标触屏退化**不实施**（研究标注低优先级，§0.4）。

### 6.6 D7 表格滚动容器：`global.css` + `LoanPanel.tsx` + `ScenarioPanel.tsx`

**JSX**：

1. `LoanPanel.tsx`：滑动提示插在 `<div style={{ marginTop: 12 }}>`（:148）内、`<Table>`（:149-156）之前的首行。锚点以 **Table 元素**为准——`wf-panel-note` 行（:157-159）在表格**之后**，「表格上方」与「panel-note 之前」两个说法相反，以 Table 前为准（评审修正）：

```tsx
<div style={{ marginTop: 12 }}>
  <Text type="secondary" className="wf-swipe-hint">{t("common.swipeHint")}</Text>
  <Table columns={columns} /* 既有 props 不变 */ … />
  <Text type="secondary" className="wf-panel-note">…既有 rowsNote…</Text>
</div>
```

2. `ScenarioPanel.tsx`：提示插在**非空分支内**、`<Table>` 之前（空态 Empty 分支不渲染——无表可滚时不虚示）；对比表滚动结构改为「外层定位容器 + 内层滚动容器」两层——渐隐 `::after` 必须挂在**不滚动**的外层上（挂在内层滚动容器上会随内容滚走）：

```tsx
) : (
  <>
    <Text type="secondary" className="wf-swipe-hint">{t("common.swipeHint")}</Text>
    <div className="wf-scenario-table-outer">
      <div className="wf-scenario-table-wrap">
        <Table size="small" border columns={tableColumns} data={tableData} className="wf-scenario-table" />
      </div>
    </div>
  </>
)}
```

**CSS**（级联顺序纪律：同特异性的基础规则必须排在媒体查询**之前**——媒体查询不增加特异性、按源序胜出；基础规则置后会反向压掉媒体档，致提示恒隐藏，评审修正）：

```css
/* D7 滑动提示：基础档隐藏，媒体档放行——基础规则必须在源序上先于媒体查询块 */
.wf-swipe-hint { display: none; }

/* D7 表格 <768：首列 sticky（行标识恒可见；底色取组件库表面变量，深色随 arco-theme 联动） */
@media (max-width: 767.9px) {
  .wf-amortize-table th:first-child,
  .wf-amortize-table td:first-child,
  .wf-scenario-table th:first-child,
  .wf-scenario-table td:first-child {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--color-bg-2, #fff);
  }
}

/* 右缘渐隐 + 提示放行的生效档：「保证横滚」上界由容器 chrome 链推导（三段均为本会话读取
   实际样式所得）：Content 两侧 16×2=32（App.tsx:242 padding "24px 16px"）+ 高级估算卡 body
   16×2=32（.arco-card-size-default .arco-card-body { padding: 16px 16px }，组件库
   Card/style/index.css）+ 折叠内容 34+13=47（.arco-collapse-item-content-box
   { padding: 8px 13px 8px 34px }，Collapse/style/index.css）= chrome 111px；
   摊销表 min-width 560（global.css:708-710）→ 视口 <671 必然横滚。
   688.9 档同时覆盖 S3 矩阵的 375 / 640 两列（640 − 128 = 512 < 560，640 确在横滚；断点
   数值为 §6.6 六宽度实测校准结果——chrome 实测 128px 非推导 111px，见 §12 #9；
   S3-5 扩展实测 688 处 1px 死区后由 687.9 放宽至 688.9，689 起无横滚） */
@media (max-width: 688.9px) {
  .wf-swipe-hint { display: block; font-size: 12px; margin-bottom: 4px; }
  .wf-amortize-table { position: relative; }
  .wf-amortize-table::after,
  .wf-scenario-table-outer::after {
    content: "";
    position: absolute;
    top: 0; right: 0; bottom: 0;
    width: 24px;
    background: linear-gradient(to left, var(--color-bg-2, #fff), transparent);
    pointer-events: none;
  }
}

.wf-scenario-table-outer { position: relative; }
.wf-scenario-table-wrap { margin-top: 8px; overflow-x: auto; }

/* S2-1 列压缩防护（施工补记，见 §12 #13）：组件库表格滚动链有连续两层裁切容器，均须
   放开为 visible（双轴显式，避开 visible+hidden 组合被计算成 auto 的规范行为）——
   ① .arco-table-content-inner ② .arco-table-content-scroll（width:100%;overflow:hidden，
   S3-1 复测发现的第二裁切层，漏放则宽表在内层被裁、外层 wrap 无从滚动）；
   列下限 + 数值列 nowrap 落实列宽纪律。 */
.wf-scenario-table .arco-table-content-inner { overflow: visible; }
.wf-scenario-table .arco-table-content-scroll { overflow: visible; }
.wf-scenario-table table { min-width: 560px; }
.wf-scenario-table th:first-child, .wf-scenario-table td:first-child { min-width: 150px; }
.wf-scenario-table th:not(:first-child), .wf-scenario-table td:not(:first-child) {
  min-width: 120px; white-space: nowrap;
}
```

**横滚临界实测要求（验收 S3 附带）**：施工后在 DevTools 于 592 / 640 / 664 / 670 / 671 / 768 六个宽度读取摊销表滚动容器的 `scrollWidth` 是否超过 `clientWidth`；若实测临界与推导值 671 偏差超过 ±8px（组件库版本内边距差异所致），以实测值回改 `670.9` 并回填 §12 #9——渐隐与提示只在「确有横滚」的区间放行，无横滚区间保持不虚示。（已执行两轮：chrome 恒 128px，临界 688px → 生效断点回改为 <687.9px；S3-5 扩展实测发现 688 处 1px 死区 → 收口为 <688.9px，689 起无横滚，见 §12 #9。）对比表列数可变（≤12 列、1 情景即可渲染），已按 §12 #13 落实 S2-1 列压缩防护与 S3-1 第二裁切层放开——min-width 560 使 <688.9 档横滚恒成立，虚示窗口收敛为空。

**列宽纪律**（不改代码，验收口径）：数值列保持 `wf-nowrap` + 等宽数字；禁止为塞下全表在 <768 压缩列宽或允许断词——宁可横滚。

### 6.7 D8 工效落位：底部吸附操作条 + MC 运行按钮

**复制分享吸附条（BasicCalculator）**：把既有 `wf-share-row` 内按钮的 `onClick` 逻辑提取为组件内局部函数 `handleCopyShare`（原按钮与吸附条按钮共用，DRY）；在 `.wf-share-row` 之后（同一输入 Card 内）追加：

```tsx
{/* D8 底部吸附操作条：<768 常驻自然可达区 [0.66H, 1.0H]（响应研究 §7.2；样式层断点控制显隐） */}
<div className="wf-action-dock">
  <Button size="small" type="primary" className="wf-pressable" title={t("share.copyTooltip")} onClick={handleCopyShare}>
    {t("share.copyShort")}
  </Button>
</div>
```

**MC 运行按钮（MonteCarloPanel）**：面板内容末尾（结果 Descriptions / 图表之后）追加复用按钮（与既有运行按钮 MonteCarloPanel.tsx:751-754 同口径：同 `run` 处理函数、同 `loading={running}` / `disabled={running}`，文案复用 `mc.run`）：

```tsx
<div className="wf-mc-dock-run">
  <Button type="primary" loading={running} onClick={run} disabled={running} className="wf-pressable">
    {t("mc.run")}
  </Button>
</div>
```

（`run` 为既有运行函数实名，MonteCarloPanel.tsx:214；序列子区的 `runSeq` 不入吸附条——研究矩阵仅锁定主「运行模拟」。）

**CSS**：

```css
/* D8 吸附落位：<768 生效；底色实底防与滚动内容叠印；原分享行在窄屏隐藏避免双入口 */
.wf-action-dock, .wf-mc-dock-run { display: none; }

@media (max-width: 767.9px) {
  .wf-share-row { display: none; }
  .wf-action-dock {
    position: sticky;
    bottom: 0;
    z-index: 30;
    display: flex;
    padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
    background: var(--wf-bg-page);
  }
  .wf-action-dock .arco-btn { flex: 1; }
  .wf-mc-dock-run {
    position: sticky;
    bottom: 8px;
    z-index: 20;
    display: flex;
    padding: 8px 0;
    background: var(--wf-bg-page);
  }
  .wf-mc-dock-run .arco-btn { flex: 1; }

  /* S2-2 sticky 祖先裁切修正（施工补记，见 §12 #15）：组件库 .arco-collapse /
     .arco-collapse-item-content overflow:hidden 使面板内 sticky 的最近滚动口退化为
     不可滚动的折叠内容盒；hidden→clip 裁切视觉不变（动画收合仍被裁切），
     但 clip 不构成滚动容器，sticky 恢复以视口为滚动口。 */
  .arco-collapse,
  .arco-collapse-item-content {
    overflow: clip;
  }
}
```

**拇指可达判定表**（写入验收 #10 的判定依据，响应研究 §7.2 系数带 [0.66H, 1.0H]）：

| 动作 | <768 落位 | 判定 |
| --- | --- | --- |
| 复制分享 | 底部吸附条，滚动中恒在视口底 | 自然可达区，常驻 ✓ |
| MC 运行模拟 | 面板尾部 sticky-bottom，面板在视口内时恒在视口底 | 自然可达区 ✓ |
| 展开 / 收起折叠 | 折叠头整行（44px 最小高） | 整行宽命中 ✓ |
| 敏感性展开 | 输出卡内（吸附态仍可点，既有 pointer-events 豁免） | 查看类操作，可居困难区 ✓ |
| 顶栏工具 | 顶栏 | 低频设置类，不强制热区 ✓ |

### 6.8 D9 输出卡紧凑模式：`BasicCalculator.tsx` + `global.css`

**JSX**：
1. `FreedomGauge` 增加 `size` prop（默认 72）：`width={size} height={size}`，`viewBox="0 0 72 72"` 与几何常量不变（等比缩放，`fontSize 13` 等内部值不动）；调用处 `size={isCompact ? 56 : 72}`；
2. 组件内：`const isCompact = useIsCompactViewport(); const isNarrow = useIsNarrowViewport(); const [breakdownOpen, setBreakdownOpen] = useState(false);`
3. 明细拆解（BasicCalculator.tsx:495-508）改为：<768 默认收起、按钮切换；≥768 现状全量：

```tsx
{data ? (
  isNarrow ? (
    <>
      <Button
        type="text"
        size="small"
        className="wf-breakdown-toggle"
        aria-expanded={breakdownOpen}
        onClick={() => setBreakdownOpen((v) => !v)}
      >
        {t("basic.breakdownTitle")} {breakdownOpen ? t("basic.collapse") : t("basic.expand")}
      </Button>
      {breakdownOpen ? (
        <div className="wf-output-breakdown">
          <Text type="secondary">{t("basic.breakdown", { /* 插值同现状 */ })}</Text>
        </div>
      ) : null}
    </>
  ) : (
    <div className="wf-output-breakdown">
      <Text type="secondary">{t("basic.breakdown", { /* 插值同现状 */ })}</Text>
    </div>
  )
) : null}
```

**CSS**（吸附态压缩，保证 pinned 高度不遮挡输入区）：

```css
/* D9 吸附态紧凑：<768 输出卡吸附时隐藏明细区（含已展开态），pinned 仅留大数字 + 两条 summary 行 + 两个开关 */
@media (max-width: 767.9px) {
  .wf-output-card.wf-is-stuck .wf-output-breakdown { display: none; }
  .wf-output-card.wf-is-stuck .wf-sens-block { display: none; }
  /* 吸附态点击穿透的交互豁免同步扩一项（既有 .wf-sens-toggle 同口径） */
  .wf-output-card.wf-is-stuck .wf-breakdown-toggle { pointer-events: auto; }
}
.wf-breakdown-toggle { margin-top: 8px; }
```

紧凑档判定：<640 环 56px + 明细摘要；640–767 环 72px + 明细摘要；≥768 全量（研究 D9 断点值）。

### 6.9 D10 心理学规范：顺序锁定 + 折叠头默认值提示 + 分组间距

1. **字段决策顺序锁定**（现状已合规，任何断点不得重排语义顺序）：`monthlyExpense → planChildren（开关）→ childCount / costPerChild → healthReserve → majorInvestment → 已有资产（选填）→ 回报假设（折叠）`（BasicCalculator.tsx:575-650 现状即此序）；375/640 顺序 = 纵向滚动序，≥768 = 组内「左→右、上→下」。新增字段必须先过「同屏字段数 ≤4（<768）/ ≤8（768–1024）/ ≤10（≥1024）」与「独立选项 ≤5」双检（写入本规范为后续 P 阶段纪律）。
2. **修改既有键** `basic.coreParams`（§8 表 M-2）：折叠头静态携带默认值提示，让用户不展开即可校准预期（文案值以 `defaults.ts` BASELINE_DEFAULTS = 4.5% / 2.0% 为准，全断点生效）。
3. **分组间距（<768）**：

```css
/* D10 认知负荷：组块边界间距（组头与首字段 ≥12px、组间 ≥24px = --wf-space-5） */
@media (max-width: 767.9px) {
  .wf-preset-bar { margin-bottom: 12px; }
  .wf-preset-tags { margin-bottom: 12px; }
  .wf-core-params { margin-top: 24px; }
  .wf-action-dock { margin-top: 16px; }
}
```

---

## 7. F5 README 双语增补（`README.md` + `README.en.md` 镜像）

1. **功能特性表**新增一行（置于「480 法则基线计算」之后）：

   | 公式原理与数据依据 | ✅ 已实现 | 面板⑨：公式推导（资产 = 12X ÷ r，r = 2.5% → 480）、假设链条表（存款挂牌利率 → 社保基金 7.39% → 企业年金 6.17% → 费用损耗 → 名义 / 通胀假设 → 乘数 480，逐环带来源 / 年份 / 核证标注）、直观换算锚点、市场平均消费（2025 全国 2,456 / 城镇 2,989 元/月）、分城市育儿成本（《中国生育成本报告 2024 版》原文值）与医疗支出参考、严格版 vs 宽松版口径说明；「视频口径」条目如实标注、不参与计算 |
   | --- | --- | --- |

   （en 镜像：`Formula & data provenance | ✅ Done | Panel ⑨: derivation (assets = 12X ÷ r; r = 2.5% → 480), the assumption chain table (deposit rates → social-security fund 7.39% → enterprise annuity 6.17% → fee drag → nominal/inflation assumptions → multiplier 480, each row with source / year / verification tag), conversion anchors, 2025 average consumption (national ¥2,456 / urban ¥2,989 per month), regional child-raising cost (original figures from the 2024 China child-raising cost report) and lifetime health-cost references, plus strict vs loose interpretation notes; unverifiable "video-only" figures are labeled as such and never enter the computation.`）

2. **演示区**新增两行（素材为**真实运行画面**截图，沿用演示区口径；施工时补拍入库 `docs/assets/`）：
   - `demo-insights.png`：面板⑨展开态截图（浅色 1024 宽），图注概述公式推导 + 假设链条 + 标注体系；
   - `demo-responsive.png`：375 / 768 / 1440 三档真宽截图横向拼合（双主题各一张或注明主题），图注写明断点矩阵「375 / 640 / 768 / 1024 / 1440 × 浅深双主题」与要点（顶栏收纳三态、底部吸附操作条、表格首列 sticky、图表三档高度）。
3. **面板计数**：「八个子面板」→「九个面板（新增『公式原理与数据依据』）」（zh README.md:43；en README.md:43 `eight sub-panels` → `nine panels, including a new "Formula & data provenance" panel`）；演示区若有面板数引用同步核对。
4. **数据来源与口径表**追加 6 行：存款挂牌利率（2025-05-20，媒体核证）、社保基金 7.39%（2000–2024 年报，官方核证）、企业年金 6.17%（2007–2024 摘要，媒体核证）、《中国生育成本报告（2024 版）》（2024-02，媒体核证，以报告原文为准）、人均卫生总费用 6,454.4 元/年（2024 公报，媒体核证）、2025 居民消费支出（2026-01-19，官方核证）。
5. **项目结构注释**：`AdvancedPanel.tsx # 高级估算与公式原理（9 个子面板 Collapse）`；`advanced/…` 注释补 insights（zh README.md:280-281；en 镜像）。

---

## 8. 文案键清单（i18n 三份同步；zh-CN 为基准）

新键 **49** 条、修改既有键 **2** 条（当前基线 **447** 键，2026-11-19 以 §9 #6 recipe 实测：三份 447 / 447 / 447 全等、diff 均空；本轮净增 49、改 2）；三份文件逐键同步，`{{xxx}}` 插值名三份一致；键集全等比对 recipe 见 §9 #6。

### 8.1 新增键（48）

| # | key | 简体中文（zh-CN） |
| --- | --- | --- |
| 1 | `advanced.insightsHeader` | ⑨ 公式原理与数据依据 —— 480 从哪里来：推导、假设链与数据出处 |
| 2 | `insights.formulaTitle` | 公式推导 |
| 3 | `insights.formulaBody` | 每年开销 X 需要的本金 = X ÷ r（r 为实际年回报率）——靠这笔本金每年的实际收益恰好覆盖开销、本金不动。月开销 X 换算成年开销 12X 代入，即：资产 = 月开销 × 12 ÷ r。当 r = 2.5%（默认名义回报 4.5% − 通胀 2%）时，12 ÷ 0.025 = 480：每 480 元本金支撑 1 元月开销，「480 法则」由此得名。总临界值再叠加三笔一次性预留：孩子数 × 单孩成本 + 健康预留 + 重大投入。 |
| 4 | `insights.chainTitle` | 假设链条：从存款利率到乘数 480 |
| 5 | `insights.chainIntro` | 回报假设的推导路径如下（数值自上而下逐步抬升）；每条附来源、年份、口径与核证等级——「视频口径」条目不参与本工具计算，仅供理解假设来源。 |
| 6 | `insights.chainDeposit1y` | 一年期定存挂牌利率 |
| 7 | `insights.chainDeposit5y` | 五年期定存挂牌利率 |
| 8 | `insights.chainCoreInflation` | 核心通胀（2025 年末时点） |
| 9 | `insights.chainSsf` | 社保基金年均投资回报 |
| 10 | `insights.chainAnnuity` | 企业年金年均投资回报 |
| 11 | `insights.chainFeeDrag` | 基金到散户的综合损耗 |
| 12 | `insights.chainNominal` | 普通人名义回报（规划假设） |
| 13 | `insights.chainInflation` | 长期通胀（规划假设） |
| 14 | `insights.chainReal` | 长期实际回报（名义 − 通胀） |
| 15 | `insights.chainMultiplier` | 对应乘数（12 ÷ 实际回报率） |
| 16 | `insights.tagOfficial` | 官方核证 |
| 17 | `insights.tagMedia` | 媒体核证 |
| 18 | `insights.tagVideo` | 视频口径 |
| 19 | `insights.anchorTitle` | 直观换算锚点 |
| 20 | `insights.anchorNote` | 以下锚点按乘数 480（实际回报 2.5%）的算术演示给出，人民币口径；实际参数可自行调整，乘数随实际回报率变化。 |
| 21 | `insights.anchorExpense1` | 月开支 1 万 → 需要本金 480 万 |
| 22 | `insights.anchorExpense2` | 月开支 5,000 → 需要本金 240 万 |
| 23 | `insights.anchorAsset1` | 已有本金 4.8 万 → 每月可多花 100 元 |
| 24 | `insights.anchorAsset2` | 每多攒 480 元 → 每月可多花 1 元 |
| 25 | `insights.marketTitle` | 市场平均消费参考（2025 年） |
| 26 | `insights.marketNote` | 口径为居民人均消费支出，含居住、医疗保健、教育文化娱乐三大类；本工具默认月开销 2,990 元/月即参考城镇口径取整。 |
| 27 | `insights.childTitle` | 分城市育儿成本参考 |
| 28 | `insights.childNote` | 《中国生育成本报告（2024 版）》原文值：0–17 岁全国平均 53.8 万元；养育至本科毕业约 68 万元；孩次成本系数 1 : 0.79 : 0.60（二孩约 −21%、三孩约 −24%）；相当于人均 GDP 的 6.3 倍，为报告所列国家中第二高（仅次于韩国 7.79 倍）。 |
| 29 | `insights.childVideoNote` | 原视频称「全国 58 万 / 北京 100 万 / 上海 108 万 / 贵州 43 万最低 / 每多一孩约降 15%」，与报告原文不一致；贵州数值与「月均 2,543.84 元」未能复核——本面板采用报告原文值（视频口径不采纳）。「单孩成本」提示中的 −15% 为视频口径的保守简化，如需按报告口径可自行按 −21% 折算。 |
| 30 | `insights.healthTitle` | 医疗支出参考 |
| 31 | `insights.healthNote` | 「一辈子约 20 万」「二线 15–30 万 / 一线 30–60 万」均为原视频估算、未独立查证（保守区间 15–50 万，2024 年价格水平）；等额不折现上限参考：6,454.4 元/年 × 80 年 ≈ 51.6 万，实际就医强度随年龄后移，中青年起点可明显低于上限。 |
| 32 | `insights.strictTitle` | 严格版与宽松版口径 |
| 33 | `insights.strictBody` | 严格版：要求资产永不缩水（只动用实际收益、不动本金）。对应本工具基础模式「财富自由参考线」与反向估算「每月可放心花费」的永续提取口径。 |
| 34 | `insights.looseBody` | 宽松版：允许资产在后期缓慢下降，换取更高的当期开销。对应蒙特卡洛面板「阈值带调整」与「余额比例」两类支取策略——可在模拟中观察耗尽概率与末年购买力的权衡。 |
| 35 | `insights.evidenceNote` | 标注说明：「官方核证」= 官方原文页面已直读；「媒体核证」= 官方发布数字经两家及以上独立媒体转载核对一致；「视频口径」= 仅见于原视频或属分析假设、未找到独立权威来源。各条年份与口径以行内标注为准；查证记录见 docs/research-video-data.md。 |
| 36 | `reverse.exampleLegend` | 演示算例（视频推演口径） |
| 37 | `reverse.exampleA` | 算例 A：600 万 − 1 孩 70 万 − 健康 50 万 |
| 38 | `reverse.exampleB` | 算例 B：600 万 − 0 孩 − 房 120 万 |
| 39 | `reverse.exampleApplied` | 已填入「{{name}}」，回报假设同步为默认 4.5% − 2.0%；结果见下方。 |
| 40 | `reverse.exampleNote` | 两个算例来自原视频的推演（演示口径，非官方文件）：视频的期望值按「净可投资额 ÷ 480 月」直除；本工具按永续提取口径计算（可投资资产 × 实际回报率 ÷ 12），默认回报假设（4.5% − 2.0%，实际 2.5%）下两种口径数值一致。 |
| 41 | `reverse.exampleBNote` | 算例 B 原视频称结果约 0.9 万/月（含约 10% 的额外折让，来源无法复算）；本工具按同一口径如实给出 1.0 万/月，不按 0.9 万修正。 |
| 42 | `basic.majorInvestmentHint` | 计划一直租房？可不填本项，将月租金计入每月开销。 |
| 43 | `basic.childCostHint` | 多孩平均成本通常每多一孩约降 15%（视频口径默认忽略），可自行折算。 |
| 44 | `basic.breakdownTitle` | 构成明细 |
| 45 | `basic.expand` | 展开 |
| 46 | `basic.collapse` | 收起 |
| 47 | `common.swipeHint` | 左右滑动查看全部列 |
| 48 | `share.copyShort` | 复制分享 |
| 49 | `scenario.deleteConfirm` | 确认删除该情景？删除后不可恢复。 |

### 8.2 修改既有键（2）

| # | key | 原值（zh-CN） | 新值（zh-CN） | 动因 |
| --- | --- | --- | --- | --- |
| M-1 | `advanced.cardTitle` | 高级估算（按需展开，默认全部收起） | 高级估算与公式原理（按需展开，默认全部收起） | 面板⑨入列后卡片标题如实 |
| M-2 | `basic.coreParams` | 核心参数（回报率与通胀） | 核心参数（回报率与通胀；默认 名义 4.5% / 通胀 2%） | D10 折叠头默认值提示（值以 BASELINE_DEFAULTS 为准） |

---

## 9. 验收清单

### 9.1 门禁与回归断言

| # | 验收项 | 命令 / 口径 | 期望 |
| --- | --- | --- | --- |
| 1 | 类型与构建 | `npm run build` | 通过（tsc strict） |
| 2 | 尺寸门禁 | `npm run check:size` | dist 总和 ≤ 2MB 且最大 .wasm ≤ 800KB |
| 3 | 核心零回归 | `cargo test --manifest-path src/wasm/Cargo.toml` | 全绿（本轮 wasm 零改动，跑一次确证） |
| 4 | 范围审计 | 先按 §1 固化基线（`git tag pre-p3`），再 `git diff --name-only pre-p3 -- src/wasm src/services src/store` | 空输出（当前树为未提交状态——仓库仅 initial commit，P1/P2 改动 44 路径未提交，本次会话 `git status --porcelain` 实测；**不能直接对 HEAD 审计**） |
| 5 | 核心公式回归 | 默认参数首屏临界值 | 1,635,200 元不变（面板⑨ / 提示 / 响应式改动不得影响输出） |
| 6 | i18n 键集全等 | recipe 见下 | 三份键集全等（基线 447/447/447）；相对基线恰为 §8 的 49 增 2 改，无删键 |
| 7 | 命名审计 | `grep -rnE 'wf-(insight|example|action-dock|mc-dock-run|swipe-hint|select-currency|select-lang|header-label-cb|breakdown-toggle|scenario-table-wrap)' src/` 与研究文档 §13 中性条款 | 新增标识符全部在 §10 自查表内；文档与注释无品牌名/俗称 |
| 8 | 演示算例断言 | 手测（1440 与 375 各一次）：点「算例 A」→ 可投资资产 ¥4,800,000.00、每月可放心花费 ¥10,000.00、回报杠杆年限 4.8 年；点「算例 B」→ 可投资资产 ¥4,800,000.00、每月可放心花费 ¥10,000.00、杠杆 4.8 年；两注行可见且如实说明 B 与视频 0.9 万的差异 | 与 §4.1 断言逐值一致（B 不按 0.9 万修正） |
| 9 | 面板⑨内容断言 | 手测：链条 10 环每环四要素齐备；官方核证 ≥3 行（社保基金、市场平均 ×2）、媒体核证 ≥5 行（定存 ×2、核心通胀、企业年金、医疗年锚）、视频口径 ≥7 行；三条育儿成本行与 `INSIGHT_CHILD_COST_REGIONS` 逐值一致（53.8 / 101 / 93.6 / 34.9 万元） | 与 §2 数据文件逐值一致 |
| 10 | 可访问名称断言（D2） | DevTools / 读屏：`#wf-select-currency` 与 `#wf-select-lang` 元素存在非空 `aria-label` 且随语言切换更新（App effect 写入）；色盲 Switch 的 `aria-label` 经属性面板可读（组件库透传直写） | 三控件均有非空可访问名称 |

i18n 键集比对 recipe（临时脚本，置于 `.tmp-research/scripts/p3-i18n-check.mjs`，不入库）：

```js
// 用法：node .tmp-research/scripts/p3-i18n-check.mjs
// 依赖 vite 自带的 esbuild（node_modules 内直取）把三份 locale TS 转 JS 后求值、展平键集比对
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { transformSync } = require("esbuild");

function loadKeys(path) {
  const src = readFileSync(path, "utf8");
  const name = src.match(/const (\w+) =/)[1];
  const js = transformSync(src, { loader: "ts" }).code
    .replace(/export default \w+;?/, `return ${name};`);
  const obj = new Function(js)();
  const keys = [];
  const walk = (o, prefix) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object") walk(v, `${prefix}${k}.`);
      else keys.push(`${prefix}${k}`);
    }
  };
  walk(obj, "");
  return keys.sort();
}

const base = "src/i18n/locales/";
const [cn, ht, en] = [loadKeys(base + "zh-CN.ts"), loadKeys(base + "zh-Hant.ts"), loadKeys(base + "en.ts")];
const diff = (a, b) => a.filter((k) => !b.includes(k)).concat(b.filter((k) => !a.includes(k)));
console.log("counts:", cn.length, ht.length, en.length);
console.log("cn↔ht:", diff(cn, ht), "cn↔en:", diff(cn, en));
if (cn.length !== ht.length || cn.length !== en.length || diff(cn, ht).length || diff(cn, en).length) {
  process.exit(1);
}
```

### 9.2 断点矩阵（5 宽度 × 浅 / 深双主题 × 7 关键屏）

宽度用 DevTools 设备模拟逐档核（375 / 640 / 768 / 1024 / 1440）；每档先浅色后深色；每屏判定 `document.documentElement.scrollWidth ≤ 视口宽`（无横向溢出）。

| 关键屏 | 判定要点（期望值 per 宽度） |
| --- | --- |
| S1 首屏（未滚动） | 顶栏形态：375=两行堆叠（3 标签隐藏、Select 104/88、标题 14px）；640–789.9=单行收纳（色盲标签隐藏、Select 110/96；768–789.9 为 S2-3 实测补档，见 §12 #14）；≥790=单行完整（150/130、sticky）。输出卡：375 环 56px + 「构成明细 展开」按钮；640 环 72px + 按钮；≥768 全量明细。首屏可见输入字段 ≤4（375/640）。字段顺序 = 决策流（月开销→孩子→预留→已有资产→折叠）。**D3 判定**：375/640 档字段区无 16px 水平残留（FieldRow gutter 归零生效，检查字段左缘与卡体 padding 对齐）。**D10 判定**：<768 档预设按钮行 / 消费构成 Tag 行 / 核心参数折叠三组块间距 ≥12px、组间 ≥24px。**D2 判定**：`#wf-select-currency` / `#wf-select-lang` 的 aria-label 存在（§9.1 #10） |
| S2 首屏滚动（输出卡吸附态） | <768：pinned 卡无明细区（大数字 + 两条 summary + 敏感性开关），不遮挡下方输入区可点性；底部吸附条常驻视口底、按钮可点（elementsFromPoint 直达按钮）；≥768 无吸附条、分享行原位 |
| S3 高级面板 · 贷款（展开） | 375/640：摊销表横滚、期次首列 sticky 恒可见、右缘渐隐 + 「左右滑动查看全部列」提示可见（<688.9 档，实测校准见 §12 #9；附横滚临界实测：592/640/664/670/671/768 六宽度读滚动容器 scrollWidth vs clientWidth，见 §6.6）；768/1024/1440：表满宽无滚动、无提示无渐隐。折叠头命中 ≥44px（触屏模拟） |
| S4 高级面板 · 蒙特卡洛（已运行） | 图表高度：375=240、640=280、≥768=320；YAxis 宽 375=56、其余=72；X 刻度 375 ≤5 个；面板尾部 sticky-bottom「运行模拟」可达 |
| S5 高级面板 · 场景对比（≥2 情景） | 对比表横滚 + 首列（指标）sticky；mini 载入/删除按钮命中 ≥44px（触控区扩展）；提示行随 <688.9 档出现（空态不显示）；点删除弹 Popconfirm 二次确认，确认后情景才被删除（误触不直接销毁） |
| S6 高级面板 · 反向估算 | 演示算例按钮 ×2 可见可点；<640 结果 Descriptions 纵向 + 值右对齐；≥768 横向；断言 §9.1 #8 |
| S7 高级面板 · 公式原理 | 链条 10 环 + 三区数据行逐值渲染；Tag 三色可辨（双主题下文字语义可读，不只靠色）；深色下 `wf-insight-row` 着色底与正文字对比 ≥4.5:1 |

矩阵通过标准：每一格「无溢出 + 对应档期望形态成立 + 深色可读性不劣于浅色」。

---

## 10. 中性命名纪律与新增标识符自查表

沿用 design-spec 文首豁免条款（组件库类名 / `arco-theme` / `--primary-N` / `--color-bg-2` / 包导入名为既有机制标识符，豁免）；本轮新增全部中性：

| 标识符 | 类型 | 文件 |
| --- | --- | --- |
| `InsightVerification` / `InsightEntry` / `InsightChainStep` / `InsightChildCostRegion` | TS 类型 | src/data/insights.ts |
| `INSIGHT_CHAIN_STEPS` / `INSIGHT_MARKET_ENTRIES` / `INSIGHT_CHILD_COST_REGIONS` / `INSIGHT_HEALTH_ENTRIES` | 常量 | src/data/insights.ts |
| `InsightsPanel` / `EntryRows` / `VERIFICATION` | 组件 / 映射 | src/components/advanced/InsightsPanel.tsx |
| `useIsCompactViewport` / `ChartMetrics` / `useChartMetrics` / `compactXInterval` / `COMPACT_MEDIA_QUERY` | hook / 函数 | src/components/hooks.ts |
| `REVERSE_EXAMPLES` / `handleCopyShare` / `breakdownOpen` / `isCompact` / `isNarrow` | 常量 / 状态 | ReversePanel.tsx / BasicCalculator.tsx |
| `size`（FreedomGauge prop） | prop | BasicCalculator.tsx |
| `.wf-insights` `.wf-insight-section-title` `.wf-insights-body` `.wf-insight-list` `.wf-insight-row` `.wf-insight-main` `.wf-insight-source` `.wf-insight-note` | 类 | global.css / InsightsPanel.tsx |
| `.wf-example-bar` `.wf-action-dock` `.wf-mc-dock-run` `.wf-swipe-hint` `.wf-breakdown-toggle` `.wf-scenario-table-wrap` `.wf-scenario-table-outer` `.wf-select-currency` `.wf-select-lang` `.wf-header-label-cb` | 类 | global.css + 对应组件 |

文案禁语核对：新增键与数据字段不含品牌名 / 人名 / 机制俗称；「视频口径」「演示算例（视频推演口径）」为定性描述，符合「不可查证标视频口径」的门禁要求。

---

## 11. 文档回填（随 C 阶段收尾）

- `docs/design-spec.md`：响应式一节补两行登记——①五档断点体系（375/640/768/1024/1440，768 唯一硬断点）；②字段决策顺序锁定与「同屏字段数 ≤4/8/10、选项 ≤5」新增字段双检纪律（docs/p3-spec.md §6.9）。
- 本规范 §12 偏差表如有施工中发现的新偏差，先回填本文件再实施。

---

## 12. 偏离登记（deviations，对照任务书与研究原文）

| # | 偏差 | 依据 |
| --- | --- | --- |
| 1 | 按钮组命名「官方算例」→「演示算例（视频推演口径）」 | 数据研究条目 8：算例无官方出处，不作为官方引用；中性纪律 |
| 2 | 算例 B 期望断言 10,000.00 元/月，非任务书的 ≈9,000 | 数据研究条目 8 复算：480 万 ÷ 480 月 = 1.0 万；0.9 万含约 10% 不可复算折让；UI 注明差异不断言 |
| 3 | 育儿成本录入报告原文 53.8 / 93.6 / 101 / 西藏 34.9 万，非任务书的 58 / 100 / 108 / 贵州 43 万 | 数据研究条目 5：视频值与报告原文不一致 / 未能复核；工具一律采用报告原文值 |
| 4 | 核心通胀链环节录入 1.2%（视频口径 1.0% 随条标注） | 数据研究条目 1b：2025-12 核心 CPI 同比发布值 |
| 5 | 「紧凑档隐藏多路径折线图例」不实施 | 现状核对（`grep -n "Legend" src/components` 零命中）：全仓无图表 Legend 组件，图例均为 HTML 数值行，无适用面 |
| 6 | D10 折叠头默认值提示取 4.5% / 2.0%（研究原文写 6% / 2%） | `src/data/defaults.ts:38-39` BASELINE_DEFAULTS 实际值；研究笔误 |
| 7 | MC「运行模拟」以面板内 sticky-bottom 复用按钮落位，不并入全局吸附条 | 等价满足「自然可达区常驻」；避免跨面板事件编排（Collapse 展开态上提 + store 请求通道）的额外复杂度 |
| 8 | 直观换算锚点为 i18n 算术演示文案，不入 insights.ts | 锚点是乘数 480 的算术演示（无来源/年份/口径可标），与数据研究的「查证数据」性质不同；面板仍整体呈现 |
| 9 | 表格右缘渐隐与滑动提示的生效断点取 **<688.9px**（研究未给数值；初稿 591.9 仅计入 Content 内边距 32，漏掉高级卡 body 与折叠内容内边距，且与 §9.2 S3 的 640 列自相矛盾，评审修正；施工后按 §6.6 六宽度实测校准，推导值 670.9 与实测临界偏差 17px > ±8px 阈值，以实测回改并回填本条；S3-5 扩展实测（592/640/664/670/671/687/688/768）发现 688px 处 sw=560 > cw=559 仍有 1px 横滚而提示/渐隐已关——1px 死区，断点再放宽至 688.9px，689 起实测无横滚） | chrome 链按实际样式求和：Content 16×2=32（App.tsx:242）+ 卡体 16×2=32（`.arco-card-size-default .arco-card-body { padding: 16px 16px }`）+ 折叠内容 34+13=47（`.arco-collapse-item-content-box`）= 111px（推导值）；560（表 min-width）+ 111 = 671 → 推导 <671。§6.6 六宽度 DevTools 实测（chrome 恒 128px：592→cw464、640→512、664→536、670→542、671→543、768→640），横滚实际止于 560+128=688px——671–687.9px 窗口「确有横滚却无提示/渐隐」→ 生效断点回改为 <687.9px；S3-5 复测按 688.9 收口（global.css 已同步） |
| 10 | 「单孩成本」提示保留任务书逐字文案「每多一孩约降 15%（视频口径…）」，同时面板⑨给已核证孩次系数 1 : 0.79 : 0.60 | 任务书指定文案自带「视频口径」标注、如实；两处口径并存且各自标注（数据研究条目 5） |
| 11 | D1 书写口径以 `max-width: xxx.9px` 替换研究原文「CSS 一律 `min-width` 书写（移动优先）」 | 与本仓既有窄屏规则同构（global.css:191/555/716 全为 max-width + 0.9 尾数）；字面执行研究原文会破坏与现状代码的一致性；断点数值本身照采（§0.2 D1 行） |
| 12 | mini 按钮（载入/删除）扩展命中区相互重叠约 22px（gap 6 + 两侧 padding 14 / margin −14），研究 §5.3 的 ≥8px 间距豁免口径被扩展包装实际吃掉 | 对策：删除动作加 `Popconfirm` 二次确认（新键 `scenario.deleteConfirm`），误触不再直接销毁情景；载入动作非破坏性、可接受；可选 2px 隔断 margin 不作默认（§6.5） |
| 13 | 对比表右缘渐隐采纳落地（研究 D7 全量，初稿漏给对比表），对比表列数可变（1 情景即可渲染）；验收 S2-1 发现无 min-width 时窄断点列被压缩、数值断行（「¥1,635,200」375px 实测断 4 行），属数字断行而非无害虚示——已加 table min-width 560 + 指标列 150 / 场景列 120 下限 + 数值列 nowrap（D7 列宽纪律）；S3-1 复测发现滚动链还有第二裁切层 `.arco-table-content-scroll`（width:100%;overflow:hidden）漏放——560px 表在内层被裁、外层 wrap 无从滚动（实测 wrap sw=cw=232，提示虚示），已补 `overflow: visible` 与 content-inner 同口径放开（global.css 已同步） | <688.9 档横滚恒成立（双层裁切放开后 min-width 560 > 各档可用宽，689 起无横滚）：空态（Empty 分支）不渲染提示行 + 有表即横滚 → 有提示必有横滚，虚示窗口收敛为空；≥689 档可用宽 ≥560 无横滚、提示不显示（§6.6） |
| 14 | 顶栏「≥768 单行完整态」实测在 768–789px 不成立：768 视口（cw 753）下品牌块实测 188px（20px 字号 × 8 字 + 图标，高于响应研究 §2.2 按 156px 的推导）+ 工具组 526px > 可用 705px → 换行；790–1000 逐宽扫描全部单行 | 对策：D2 顶栏收纳档上界从 767.9px 放宽至 **789.9px**（768–789 走「色盲标签隐藏 + Select 110/96」收纳态，单行成立；≥790 恢复 150/130 完整态）。768 仍是 D3/D7 等其余块的唯一硬断点，仅 D2 顶栏档例外（global.css 已同步） |
| 15 | D8 MC「运行模拟」面板内 sticky-bottom 被祖先 overflow:hidden 中和：组件库 `.arco-collapse` / `.arco-collapse-item-content` 均为 hidden（收合动画裁切用），使 sticky 的最近滚动口退化为不可滚动的折叠内容盒，375×667 实测 dock 在视口外 3.4k px | 对策：<768 档将二者 hidden→**clip**——裁切视觉与动画收合裁切完全不变，但 clip 不构成滚动容器，sticky 最近滚动口恢复为视口，「面板在视口内时按钮恒在视口底」生效（global.css 已同步） |
| 16 | 收纳档（≤789.9）币种/语言 Select 当前值被 ellipsis 截断为「CNY（¥…」「简体…」（375 探针实测 .arco-select-view-value sw>cw；响应研究 §2.3 收纳手段第 3 档「控件收缩显示短值」此前未实施） | 对策：选项标签改双形态节点（App.tsx 顶栏 JSX）——桌面全称「CNY（¥）」「简体中文」，≤789.9 由样式层切换为短形态「CNY」「中文/繁體/EN」（global.css `.wf-select-label-full/.wf-select-label-short` 显隐切换），value 不变、无需 JS 断点状态；语言短形态仍为自身文字/通行缩写，不入 i18n 资源（语言名按既有设计不做翻译） |
| 17 | 375 档演示算例按钮标签被裁：组件库 `.arco-btn` white-space:nowrap 使算例 A 按钮 300px > 折叠内容盒 247px（尾部「万」不可见，标签含关键数值信息） | 对策：<640 档对 `.wf-example-bar .arco-btn` 放开 `white-space: normal` + `height: auto; min-height: 28px`（组件库 small 档定高 28px）——按钮两行呈现、标签完整可读，按钮行既有 flex-wrap 承载堆叠；桌面单行不变（global.css 已同步） |
| 18 | 高级面板桌面档（≥768）字段单列纵排（1024 实测 5 字段各列 912px），与响应研究 §10 矩阵「两列 md=12 生效（高级面板）✅」记述不符——fields.tsx:79 默认 md=24，各面板从未显式传 md=12，属研究记述与实现不一致而非规范违反（p3-spec D3 仅裁定两列切点维持 768） | 裁定**维持单列**：字段顺序即决策流（D10），单列纵向扫读与其一致；两列化为产品级视觉变更、收益未经实测验证，不随本轮实施。design-spec §3.6 已登记裁定，research-responsive.md §3.1 / §10 矩阵记述已修正；后续若两列化需重走桌面档验收矩阵 |
