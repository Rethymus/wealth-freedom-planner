# P0 三件套实现规范：预设场景 · 自由刻度 · 打工模拟

> 状态：**待施工**（本文档为可直接施工的实现规范，代码块均可复制粘贴）。
> 读者：核心方（Rust/WASM 与 service）、界面方（组件/store/数据层）、同步方（i18n/README）。
> 现状依据：本文所有「现状」引用均以本仓库当前代码为准（`src/wasm/bridge.ts`、`src/wasm/src/**`、`src/services/finance.ts`、`src/components/**`、`src/store/useCalculatorStore.ts`、`src/data/defaults.ts`、`README.md` / `README.en.md`）。
> 全局约定（不重复展开，下文直接引用）：WASM 导出统一 `(input: string) => string` JSON 进 JSON 出（`bridge.ts:24-25`）；金额单位元、百分比单位百分点（`bridge.ts:11-14`）；`error` 空串成功、非空中文错误（`bridge.ts:15-17`）；Rust 侧任何路径不得 panic（`lib.rs:15-17`）；输出金额统一两位小数、概率 6 位小数（`common.rs:15-16`、`common.rs:116-118`）。

---

## 0. 三件套总览

| # | 特性 | 涉及层 | 核心新产物 |
| --- | --- | --- | --- |
| ① | 预设场景（4 组生活画像 + 自定义态） | 仅界面方 | `src/data/presets.ts`（新文件）+ store 增量 + `BasicCalculator.tsx` 增量 |
| ② | 自由刻度（已有资产 → SVG 进度环） | 仅界面方 | store `progressInputs` 切片 + `BasicCalculator.tsx` 增量（不新增依赖） |
| ③ | 打工模拟（新高级面板⑥） | 三方协作 | Rust 导出 `simulate_accumulation` + 契约类型 + service + `AccumulationPanel.tsx`（新文件） |

依赖关系：①② 不依赖核心方，可立即开工；③ 的 UI 依赖核心方在 `bridge.ts` 落契约类型后才可施工（`AccumulationPanel.tsx` 需要 `import type { AccumulationInput, AccumulationOutput } from "../../wasm/bridge"`）。

---

## 1. 文件所有权分界与施工顺序

### 1.1 文件所有权分界

| 方 | 文件（本次允许写入的范围） | 说明 |
| --- | --- | --- |
| **核心方** | `src/wasm/bridge.ts`、`src/wasm/src/lib.rs`、`src/wasm/src/accumulation.rs`（新）、`src/wasm/src/common.rs`、`src/wasm/src/montecarlo.rs`（仅 quantile 提升一处）、`src/wasm/tests/integration.rs`、`src/wasm/pkg/**`（wasm-pack 产物再生成）、`src/services/finance.ts` | **`bridge.ts` 的契约类型是核心方的第一次写入**（§4.1），其余各方以其为准；`src/wasm/pkg/` 当前已是真实 wasm-pack 产物（`pkg/finance_core.d.ts` 已含 6 个导出函数声明，非占位 stub——`bridge.ts:19-21` 头注释描述已过时，核心方再生成产物时可顺带修正该注释） |
| **界面方** | `src/data/presets.ts`（新）、`src/components/**`、`src/store/**`、`src/data/defaults.ts`（追加 `PROGRESS_DEFAULTS` / `ACCUMULATION_DEFAULTS`）、`src/styles/global.css`（追加 `wf-preset-*` / `wf-progress-*` / `wf-acc-*` 类） | defaults.ts 与 global.css 是任务书所有权清单之外的两个必要触碰点：store 各切片初值的既有惯例是统一引用 defaults.ts（`useCalculatorStore.ts:3`），组件样式集中放在 global.css（现无组件内联样式文件），故划入界面方 |
| **同步方** | `src/i18n/locales/zh-CN.ts`（基准）、`zh-Hant.ts`（逐词字形转换）、`en.ts`（翻译）、`README.md`、`README.en.md`、`docs/assets/`（新增演示素材） | 键结构三份一致（`zh-CN.ts:3-7` 既有约定）；数据层口径注释不入 i18n |

### 1.2 施工顺序

```
第 1 步（界面方，可立即开工，不碰 bridge 契约）：
  1a. 新建 src/data/presets.ts（§2.1，类型 + 4 组值）
  1b. store 增量：activePresetId / applyPreset / progressInputs（§2.2、§3.1）
  1c. BasicCalculator：画像按钮排 + 消费构成 Tag + 自定义切换（§2.3）
  1d. BasicCalculator：已有资产字段 + 进度环（§3.2）
  1e. defaults.ts 追加 PROGRESS_DEFAULTS；global.css 追加对应类（§7）

第 2 步（核心方，与第 1 步并行）：
  2a. bridge.ts 追加 §4.1 契约（核心方第一次写入，此后契约冻结）
  2b. common.rs 提升 quantile_f64（§4.2.0）；montecarlo.rs 改用之（行为逐字节不变，
      现有 monte_carlo_* 全部回归测试必须原样通过）
  2c. 新建 accumulation.rs（§4.2）；lib.rs 挂载（§4.1 Rust 签名）
  2d. tests/integration.rs 追加 §4.7 测试清单；cargo test 全绿
  2e. wasm-pack build src/wasm --target web --out-dir pkg --release（产物入库）
  2f. finance.ts 追加 calcAccumulation（§4.3）

第 3 步（界面方，等 2a 契约合入后开工）：
  3a. defaults.ts 追加 ACCUMULATION_DEFAULTS；store 追加 accumulationInputs /
      accumulationTargetSynced（§4.5）
  3b. 新建 src/components/advanced/AccumulationPanel.tsx（§4.6）
  3c. AdvancedPanel.tsx 追加⑥号子面板（§4.6.3）；global.css 追加 wf-acc-* 类

第 4 步（同步方，1c/1d/3b 的键清单确定后）：
  4a. 三份语言资源按 §5 键清单同步
  4b. README 双语增补（§6）；录制并提交演示素材
```

### 1.3 中性命名纪律（审计门禁强制）

- 新增 CSS 类一律 `wf-` 前缀、CSS 变量一律 `--wf-` 前缀；本次新增类名全集：`wf-preset-bar`、`wf-preset-btn`、`wf-preset-custom`、`wf-preset-tags`、`wf-preset-note`、`wf-output-hero`、`wf-progress-ring`、`wf-progress-caption`、`wf-acc-actions`、`wf-acc-running`、`wf-acc-progress`、`wf-acc-chart`（§7 给出样式增量）。
- 标识符中性：新类型/函数/字段名只用描述性英文（`preset`、`progress`、`accumulation`），不得引入任何外部品牌词、机制俗称或项目外专有名词；文案键空间为 `presets.* / progress.* / accumulation.* / advanced.accumulationHeader`。
- 自查命令（合入前各方可自行执行，均应零命中新增违规）：
  `grep -rn "wf-" src/styles/global.css | grep -v -- "--wf"`（列类名，逐个目检前缀）、
  `grep -rniE "俗称词表（由审计门禁维护）" src/ docs/p0-spec.md`（按门禁词表全文检索确认零命中；本规范新增标识符 `preset / progress / accumulation / fiProbability / FreedomGauge` 等均为中性描述词，不含任何俗称）。

---

## 2. ① 预设场景

### 2.1 数据层：`src/data/presets.ts`（新文件，逐字可粘贴）

```ts
/**
 * 预设场景数据层：4 组生活画像 + 消费构成明细。
 * 数值口径：以国家统计局居民消费支出分类及公开报告整理的一线城市参考锚点，
 * 全部可被用户自由修改；note 为简中数据口径注释（数据口径不入 i18n，见
 * src/i18n/locales/zh-CN.ts 头注释），页面上以只读提示展示。
 * 界面名称与消费构成标签文案在 i18n presets.* 键空间（见 docs/p0-spec.md §5）。
 */
import type { BaselineInput } from "../wasm/bridge";

/** 画像预设标识（"custom" 仅为 UI 状态值，不是预设，不出现在本文件） */
export type PresetId = "single_renter" | "couple_no_kids" | "family_one_kid" | "zen_frugal";

/** 消费构成固定键集（元/月；每组合计必须等于画像的 monthlyExpense） */
export interface PresetBreakdown {
  /** 吃（餐饮食品） */
  food: number;
  /** 住（房租/房贷居住类） */
  housing: number;
  /** 行（交通） */
  transport: number;
  /** 通讯 */
  communication: number;
  /** 其他（衣着、教育文娱、医疗等） */
  other: number;
}

/** 画像预设（一键填入基础参数卡的 5 个基础字段；回报率/通胀不在预设范围） */
export interface PresetProfile {
  id: PresetId;
  baseline: Pick<
    BaselineInput,
    "monthlyExpense" | "childCount" | "costPerChild" | "healthReserve" | "majorInvestment"
  >;
  breakdown: PresetBreakdown;
  /** 简中口径注释（只读展示） */
  note: string;
}

export const PRESET_PROFILES: PresetProfile[] = [
  {
    id: "single_renter",
    // 一线含房租单人口径：4500/月 = 吃 1500 + 住 2000 + 行 400 + 通讯 100 + 其他 500
    baseline: { monthlyExpense: 4500, childCount: 0, costPerChild: 580000, healthReserve: 150000, majorInvestment: 0 },
    breakdown: { food: 1500, housing: 2000, transport: 400, communication: 100, other: 500 },
    note: "以一线城市口径整理：含房租约 2,000 元/月；健康预留按单人 15 万整理。可自由修改。",
  },
  {
    id: "couple_no_kids",
    // 一线含房租双人合计口径：8000/月 = 吃 2800 + 住 3500 + 行 700 + 通讯 200 + 其他 800
    baseline: { monthlyExpense: 8000, childCount: 0, costPerChild: 580000, healthReserve: 200000, majorInvestment: 0 },
    breakdown: { food: 2800, housing: 3500, transport: 700, communication: 200, other: 800 },
    note: "以一线城市口径整理：双人合计，含房租约 3,500 元/月；健康预留 20 万沿用默认双人口径。可自由修改。",
  },
  {
    id: "family_one_kid",
    // 一线含房租三口口径：11000/月 = 吃 4000 + 住 4500 + 行 800 + 通讯 250 + 其他 1450
    baseline: { monthlyExpense: 11000, childCount: 1, costPerChild: 580000, healthReserve: 200000, majorInvestment: 0 },
    breakdown: { food: 4000, housing: 4500, transport: 800, communication: 250, other: 1450 },
    note: "以一线城市口径整理：三口之家，含房租约 4,500 元/月；1 孩抚养成本按 58 万整理。可自由修改。",
  },
  {
    id: "zen_frugal",
    // 低线小城低欲望口径：2000/月 = 吃 900 + 住 600 + 行 150 + 通讯 50 + 其他 300
    baseline: { monthlyExpense: 2000, childCount: 0, costPerChild: 580000, healthReserve: 150000, majorInvestment: 0 },
    breakdown: { food: 900, housing: 600, transport: 150, communication: 50, other: 300 },
    note: "以低线小城低欲望口径整理：含房租约 600 元/月；健康预留按 15 万整理。可自由修改。",
  },
];
```

口径说明（规范级决策，施工时不得偏离）：
- 每组 `breakdown` 合计恒等于该画像 `monthlyExpense`（4500 / 8000 / 11000 / 2000），数据层须以注释自证；若数据研究员调整数值，合计约束不变。
- 预设只覆盖 5 个基础字段；`nominalReturnPct` / `inflationPct` **保持用户当前值不变**（核心参数属于「核心参数」折叠区，不属于画像口径）。
- `costPerChild` 统一 58 万（与 `defaults.ts:27` 既有默认口径一致），即使 `childCount = 0` 也一并填入，保证「一键填入全套基础参数」。
- 健康预留锚点：单人 15 万 / 双人及家庭 20 万（默认口径）；其中仅佛系低欲望 15 万为任务书显式给定，其余为本规范的整理建议值，`note` 已注明「可自由修改」。

### 2.2 store 增量（`src/store/useCalculatorStore.ts`）

```ts
import { PRESET_PROFILES } from "../data/presets";
import type { PresetId } from "../data/presets";
import { PROGRESS_DEFAULTS } from "../data/defaults";
```

`CalculatorState` 接口追加：

```ts
  /** 当前生效的画像预设；"custom" = 用户手动修改过任一基础字段 */
  activePresetId: PresetId | "custom";
  /** 自由刻度输入（currentAssets = 0 视为未填写，进度环隐藏） */
  progressInputs: ProgressInputs;
  setProgressInputs: (patch: Partial<ProgressInputs>) => void;
  /** 应用画像预设：以 presets.ts 的 5 个基础字段整体覆盖 baselineInputs 对应键 */
  applyPreset: (id: PresetId) => void;
```

实现（`ProgressInputs` 类型见 §3.1 defaults.ts 增量）：

```ts
  activePresetId: "custom",
  progressInputs: { ...PROGRESS_DEFAULTS },

  setProgressInputs: (patch) =>
    set((state) => ({ progressInputs: { ...state.progressInputs, ...patch } })),

  applyPreset: (id) =>
    set((state) => {
      const profile = PRESET_PROFILES.find((p) => p.id === id);
      if (!profile) return {};
      return {
        baselineInputs: { ...state.baselineInputs, ...profile.baseline },
        activePresetId: id,
      };
    }),
```

**自定义切换语义（关键）**：现有 `setBaselineInputs`（`useCalculatorStore.ts:96-97`）改为同时落自定义态——

```ts
  setBaselineInputs: (patch) =>
    set((state) => ({
      baselineInputs: { ...state.baselineInputs, ...patch },
      activePresetId: "custom",
    })),
```

即：任何经字段 `onChange` 的写入都切回「自定义」；只有 `applyPreset` 整体写入才标记对应画像（`applyPreset` 直接 `set`，不经过 `setBaselineInputs`，天然不被覆盖）。`resetAll`（`useCalculatorStore.ts:122-132`）追加 `activePresetId: "custom"`、`progressInputs: { ...PROGRESS_DEFAULTS }`（第 3 步后另追加 `accumulationInputs` / `accumulationTargetSynced`，见 §4.5）。

### 2.3 UI：`BasicCalculator.tsx` 增量

落点：输入卡（`<Card title={t("basic.inputTitle")}>`，`BasicCalculator.tsx:140`）内部、`<FieldRow>` 之前。

**结构（本文件内新增两个局部组件，不新建文件）**：

```tsx
/** 画像预设 id → i18n 名称键的静态映射（禁用模板串拼键） */
const PRESET_NAME_KEY: Record<PresetId, string> = {
  single_renter: "presets.names.singleRenter",
  couple_no_kids: "presets.names.coupleNoKids",
  family_one_kid: "presets.names.familyOneKid",
  zen_frugal: "presets.names.zenFrugal",
};
```

1. **画像按钮排**（`wf-preset-bar`）：横向一排 4 个 `Button`（`size="small"`，类名 `wf-preset-btn`）+ 1 个「自定义」态徽标（`Tag`，类名 `wf-preset-custom`）。
   - 数据源 `PRESET_PROFILES`；按钮文案 `t(PRESET_NAME_KEY[profile.id])`。
   - 高亮态：`activePresetId === profile.id` 时 `type="primary"`，否则默认态；每个按钮带 `aria-pressed={activePresetId === profile.id}`。
   - 点击：`applyPreset(profile.id)`，随后 `Message.success(t("presets.appliedHint", { name: t(PRESET_NAME_KEY[profile.id]) }))`（从 `@arco-design/web-react` 导入 `Message`）。
   - 「自定义」徽标不是按钮（不可点击）：`activePresetId === "custom"` 时高亮（`color="arcoblind"` 换为主色 `color="arcoblue"`），否则灰色（`color="gray"`）；文案 `t("presets.custom")`。
2. **消费构成 Tag 行**（`wf-preset-tags`）：仅当 `activePresetId !== "custom"` 时渲染。首行说明文字 `t("presets.tagTitle", { total: formatMoney(profile.baseline.monthlyExpense, symbol) })`；其下 5 个只读 `Tag`：`{t("presets.breakdown." + KEY)} {formatMoney(v, symbol)}`（KEY ∈ food/housing/transport/communication/other，与 §2.1 固定键集一一对应；标签值不可编辑，不加点击态）。Tag 行下方小字注释（`wf-preset-note`，`Text type="secondary"`）：两行合并展示 `profile.note`（数据口径，简中原样）与 `t("presets.note")`。
3. **联动行为自检**：`applyPreset` → 5 字段落 `baselineInputs` → 既有 `useFinanceCall`（`BasicCalculator.tsx:41`）自动防抖重算；随后用户改任一字段 → `setBaselineInputs` → `activePresetId` 自动变 `"custom"`，Tag 行隐藏、「自定义」徽标高亮。

### 2.4 ① 验收清单

- [ ] 4 个画像按钮 + 自定义徽标渲染于基础参数卡顶部；点击任一画像后 5 个基础字段（月开销/孩子数/单孩成本/健康预留/重大投入）整体变化，核心参数（回报/通胀）不变。
- [ ] 应用画像后按钮下方出现该画像消费构成 Tag（5 枚，合计 = 该画像月开销）与口径注释。
- [ ] 手动修改任一基础输入（含开关「计划要孩子」触发的 childCount 写入）后：对应画像按钮取消高亮、「自定义」徽标高亮、Tag 行隐藏。
- [ ] `resetAll` 后回到「自定义」态，输入恢复默认值。
- [ ] `presets.ts` 每组 breakdown 合计逐组等于 monthlyExpense（可用 `node -e` 断言或目检注释）。

---

## 3. ② 自由刻度（进度环）

### 3.1 store 与 defaults 增量

`src/data/defaults.ts` 追加（不新增依赖）：

```ts
/** 自由刻度输入类型与默认值（currentAssets = 0 视为未填写 → 进度环隐藏） */
export interface ProgressInputs {
  currentAssets: number;
}

export const PROGRESS_DEFAULTS: ProgressInputs = { currentAssets: 0 };
```

store 切片见 §2.2（`progressInputs` + `setProgressInputs`）。

### 3.2 UI：`BasicCalculator.tsx` 增量

1. **选填字段**：输入卡 `FieldRow` 内新增 `AmountField`（限额沿用 `LIMITS.amount`）：

```tsx
<AmountField
  label={t("progress.assetsLabel")}
  tooltip={t("progress.assetsTooltip")}
  value={progressInputs.currentAssets}
  onChange={(v) => setProgressInputs({ currentAssets: v })}
  prefix={symbol}
  suffix={t("units.yuan")}
/>
```

2. **SVG 进度环**（局部组件 `FreedomGauge`，逐字规格）：

```tsx
const RING_RADIUS = 30;
const RING_C = 2 * Math.PI * RING_RADIUS; // ≈ 188.496

interface FreedomGaugeProps {
  /** 资产 ÷ 临界值（> 0） */
  ratio: number;
  /** 展示百分比（真实值，不封顶），如 12.3 */
  pct: number;
  /** 主题解析值（resolveThemeTokens 输出） */
  tokens: ThemeTokens;
  /** 无障碍标签 */
  ariaLabel: string;
}

function FreedomGauge({ ratio, pct, tokens, ariaLabel }: FreedomGaugeProps) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return (
    <svg
      className="wf-progress-ring"
      width={72}
      height={72}
      viewBox="0 0 72 72"
      role="img"
      aria-label={ariaLabel}
    >
      <circle cx={36} cy={36} r={RING_RADIUS} fill="none" stroke={tokens.chartGrid} strokeWidth={8} />
      <circle
        cx={36}
        cy={36}
        r={RING_RADIUS}
        fill="none"
        stroke={tokens.primary}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - clamped)}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset var(--wf-dur-base) var(--wf-ease-standard)" }}
      />
      <text
        x={36}
        y={36}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight="bold"
        fill={tokens.primary}
      >
        {formatNumber(pct, 1)}%
      </text>
    </svg>
  );
}
```

3. **落点与显示规则**：
   - 大字号（`Title`，`BasicCalculator.tsx:87-93`）外包一层 `div.wf-output-hero`（flex、`align-items: center`、`gap: 16`），`Title` 与 `<FreedomGauge>` 并排；环在右、大字号在左，布局不因环出现而跳动（环隐藏时 hero 退化为单元素）。
   - **显示条件（全满足才渲染环 + 说明句）**：`progressInputs.currentAssets > 0` 且 `data` 非空（防抖结果就绪）且 `!localInvalid`。任一不满足 → 环与说明句都不渲染（不占位）。
   - 口径：`ratio = progressInputs.currentAssets / data.criticalValue`；`pct = ratio × 100`（真实值，不封顶——超过 100% 时环面封满、文本显示真实百分比）。
   - 说明句：环下方或摘要行之后新增一行 `div.wf-progress-caption`（`Text type="secondary"`）：`t("progress.caption", { pct: formatNumber(pct, 1) })`，与环同条件渲染。
   - 无障碍：`role="img"` + `aria-label` 用 `progress.ariaLabel`（与 caption 同值不同键，供读屏完整语境）；环面文字属装饰重复，读屏以 aria-label 为准。
   - 主题与色盲友好：取色一律经 `resolveThemeTokens`（`defaults.ts:252-255`）解析值（组件已持有 `themeTokens`），不传 CSS 变量字符串——与蒙特卡洛面板取色口径一致（`MonteCarloPanel.tsx:63-66`）。
   - 减弱动效：环的唯一动效是 CSS `transition`，全局「减弱动效」CSS 兜底已全停过渡（设计体系既有机制），无需 JS 分支。

### 3.3 ② 验收清单

- [ ] 不填「已有资产」（默认 0）时页面与现状完全一致（环、说明句均不渲染）。
- [ ] 填入资产后环出现，百分比 = 资产 ÷ 临界值 × 100（例：默认临界值 1,635,200，资产 500,000 → 30.6%），说明句文案为「已有资产约为参考线的 30.6%」。
- [ ] 资产 > 临界值时环面封满、文本显示真实值（如 128.3%）。
- [ ] 切深色主题 / 色盲友好开关，环与文本颜色随 `resolveThemeTokens` 联动。
- [ ] 无新增 npm 依赖（`package.json` 无 diff）。

---

## 4. ③ 打工模拟（新高级面板⑥）

### 4.1 契约：`bridge.ts` 增量（核心方第一次写入，逐字可粘贴）

`FinanceWasmModule` 接口（`bridge.ts:31-40`）内、`run_monte_carlo: WasmFn;` 之后追加一行：

```ts
  simulate_accumulation: WasmFn;
```

文件末尾追加以下完整段落：

```ts
// ---------------------------------------------------------------------------
// g. simulate_accumulation —— 打工积累模拟
// ---------------------------------------------------------------------------

/** 打工积累模拟输入 */
export interface AccumulationInput {
  /** 当前资产（元） */
  currentAssets: number;
  /** 税后月收入（元/月） */
  monthlyIncome: number;
  /** 月支出（元/月，基期名义值） */
  monthlyExpense: number;
  /** 财富自由目标值（元，基期名义值；判定时按通胀逐年上调） */
  targetValue: number;
  /** 名义回报率均值（百分点） */
  nominalReturnMeanPct: number;
  /** 名义回报率标准差（百分点，须 > 0） */
  nominalReturnStdPct: number;
  /** 通胀率均值（百分点） */
  inflationMeanPct: number;
  /** 通胀率标准差（百分点，须 > 0） */
  inflationStdPct: number;
  /** 模拟年数（1–200） */
  years: number;
  /** 模拟路径数（1–100000） */
  paths: number;
  /** 随机种子（同 seed 同输入 → 输出完全可复现） */
  seed: number;
}

/** 期末资产分位数（元，全部路径，type-7 线性插值） */
export interface AccumulationFinalPercentiles {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

/** 打工积累模拟输出 */
export interface AccumulationOutput {
  /** 达成财富自由的路径占比（0–1，6 位小数） */
  fiProbability: number;
  /** 首达年限第 5 百分位（年，仅在达成样本内取；无达成样本 = -1） */
  yearsP5: number;
  /** 首达年限第 25 百分位（年；无达成样本 = -1） */
  yearsP25: number;
  /** 首达年限中位数（年；无达成样本 = -1） */
  yearsMedian: number;
  /** 首达年限第 75 百分位（年；无达成样本 = -1） */
  yearsP75: number;
  /** 首达年限第 95 百分位（年；无达成样本 = -1） */
  yearsP95: number;
  /** 未达成路径占比（0–1，6 位小数；与 fiProbability 独立重算） */
  neverReachedShare: number;
  /** 期末资产分位数（元，全部路径） */
  finalAssetPercentiles: AccumulationFinalPercentiles;
  /** 50 条代表性路径的逐年年末资产；每条长度 = years（第 1..years 年末） */
  samplePaths: number[][];
  /** "" 表示成功 */
  error: string;
}

// simulate_accumulation 语义（Rust 侧实现遵循）：
// - 月储蓄 = monthlyIncome − monthlyExpense（可为负）；
// - 年储蓄_t = 月储蓄 × 12 × ∏(1 + 通胀样本)，自第 1 年起随通胀上行
//   （与 run_monte_carlo 的支出上行同口径）；
// - 资产递推（名义口径，与 run_monte_carlo 一致）：
//     assets_t = assets_{t−1} × (1 + 名义回报样本) + 年储蓄_t，资产下限钳 0；
// - 财富自由判定：assets_t ≥ targetValue × ∏(1 + 通胀样本)（目标随通胀水涨）；
//   初始（t = 0）即判定：currentAssets ≥ targetValue 记首达年限 0；
//   首达即记录年限（整数年），之后继续模拟至 years 结束（路径图需要全程曲线）；
// - fiProbability = 达成路径占比（6 位小数）；
// - 年限分位（type-7 线性插值、两位小数）只在达成样本内取；无达成样本五个分位均为 -1；
// - σ ≤ 0 或 years ≤ 0 返回 error；
// - 抽样顺序与种子确定性与 run_monte_carlo 完全一致：路径外层、年份内层，
//   每年先抽名义回报样本、再抽通胀样本，同 seed 同输入输出逐字节一致。
```

Rust 签名（`lib.rs`，逐字可粘贴；`pub mod accumulation;` 加入模块声明区，`lib.rs:24-30`）：

```rust
/// 打工积累模拟：JSON（AccumulationInput）→ JSON（AccumulationOutput）
#[wasm_bindgen]
pub fn simulate_accumulation(input: &str) -> String {
    run_safe(|| accumulation::handle(input), accumulation::error_output)
}
```

### 4.2 Rust 口径：`src/wasm/src/accumulation.rs`（新模块）

#### 4.2.0 前置重构：分位数函数提升到 common（核心方内部，行为不变）

`montecarlo.rs:257-269` 的私有 `fn quantile` 整体迁至 `common.rs` 并改名为 `pub fn quantile_f64`（实现逐行不变，仅可见性与命名变化，命名与 `round2_f64`/`round6_f64` 同族）：

```rust
/// 分位数：升序序列上的线性插值（type-7 线性插值法，与 run_monte_carlo 既有口径一致）。
/// pos = q × (n − 1)，在 floor(pos) 与 ceil(pos) 两邻位之间按小数部分线性插值。
/// 空序列返回 0.0；单元素返回该元素。仅用于蒙特卡洛类 f64 统计输出。
pub fn quantile_f64(sorted: &[f64], q: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    if sorted.len() == 1 {
        return sorted[0];
    }
    let pos = q * (sorted.len() - 1) as f64;
    let lo = pos.floor() as usize;
    let hi = pos.ceil() as usize;
    let frac = pos - lo as f64;
    sorted[lo] + (sorted[hi] - sorted[lo]) * frac
}
```

`montecarlo.rs` 删除私有 `quantile`，调用点改为 `quantile_f64(...)`（经 `use crate::common::*` 已在作用域）。守护：`cargo test --manifest-path src/wasm/Cargo.toml` 现有全部用例必须原样通过（含 `monte_carlo_nominal_recurrence_known_value` 闭式解锁定）。

#### 4.2.1 模块结构（与 montecarlo.rs 同构）

- 常量（模块内私有，与 montecarlo.rs 同值；刻意不跨模块共享，避免改动既有模块）：
  `const MAX_YEARS: u32 = 200;`、`const MAX_PATHS: u32 = 100_000;`、`const SAMPLE_COUNT: usize = 50;`
- 输入/输出 struct：`#[derive(Deserialize)] #[serde(rename_all = "camelCase")] pub struct AccumulationInput`，全部金额/百分比/整数/种子字段均为 `Decimal` + `#[serde(with = "rust_decimal::serde::arbitrary_precision")]`（与 `montecarlo.rs:49-79` 逐字段同法，字段名即 §4.1 的 11 个 camelCase 键）；输出 struct `#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct AccumulationOutput`，数值字段全部 `f64`（统计抽样惯例同 montecarlo.rs:31-33），末尾 `error: String`。
- `pub fn handle(input: &str) -> String`（Ok→serde_json 序列化 / Err→error_output）与 `pub fn error_output(msg: &str) -> String`，模式同 `montecarlo.rs:102-125`。**错误安全形状**：全部数值 0.0、`years_p5`…`years_p95` = **-1.0**（与「无达成样本」约定一致）、`final_asset_percentiles` 五字段 0.0、`sample_paths: Vec::new()`。

#### 4.2.2 计算口径（逐条，实现顺序即校验顺序）

1. **解析与校验**（顺序固定，错误信息可读中文，模式同 montecarlo.rs:127-147）：
   `currentAssets` → `check_nonneg_money("当前资产", …)`；`monthlyIncome` → `check_nonneg_money("税后月收入", …)`；`monthlyExpense` → `check_nonneg_money("月支出", …)`；`targetValue` → `check_nonneg_money("财富自由目标值", …)`；`nominalReturnMeanPct` / `inflationMeanPct` → `check_pct_signed`；`nominalReturnStdPct` / `inflationStdPct` → 先 `ensure(v > 0, "…标准差须大于 0（σ ≤ 0 视为异常参数）")` 再 `check_pct_signed`；`years` → `to_u32_int("模拟年数", v, 1, MAX_YEARS)`（min=1 天然实现「years ≤ 0 返回 error」）；`paths` → `to_u32_int("模拟路径数", v, 1, MAX_PATHS)`；`seed` → `to_u64_int`。**月储蓄不校验符号**（负储蓄是合法输入）。
2. **分布构造**：与 montecarlo.rs:150-159 完全一致——`Normal::new(mean/100, std/100)`（rand_distr，f64）。
3. **抽样索引**：与 montecarlo.rs:165-171 完全一致——`idx_k = round(k × (paths−1) / 49), k = 0..49`；paths < 50 时按公式重复抽取至恒 50 条。
4. **随机流**：`let mut rng = StdRng::seed_from_u64(seed);`（rand 0.8），路径外层、年份内层；**每年先抽名义回报样本、再抽通胀样本**（决定可复现性的固定顺序，与 montecarlo.rs:184-193 逐字一致）。
5. **逐年递推**（第 t 年 = 1..=years，全程不提前终止）：
   ```text
   r_t    = 名义回报样本（< −0.99 钳为 −0.99，同 montecarlo.rs:186-189 防御）
   infl_t = 通胀样本（< −0.99 钳为 −0.99，价格不能为负）
   cum_infl *= 1 + infl_t                       // ∏(1+通胀样本)，含当年
   assets    = assets × (1 + r_t) + 月储蓄 × 12 × cum_infl   // 名义口径
   若 assets 非有限或 ≤ 0 → assets = 0          // 资产下限钳 0（与耗尽语义不同：钳后继续）
   否则若 assets 正溢出 → assets = f64::MAX     // 防御（正常参数不触发）
   target_t = targetValue × cum_infl            // 目标随通胀水涨
   若未首达 且 assets ≥ target_t → 记录首达年限 = t（整数年），此后不再改写
   ```
6. **初始判定**：进入年份循环前，若 `currentAssets ≥ targetValue` → 该路径首达年限 = 0。
7. **统计**（全部路径模拟结束后）：
   - `fiProbability = round6_f64(达成路径数 ÷ paths)`；
   - `neverReachedShare = round6_f64((paths − 达成路径数) ÷ paths)`（独立重算，非 1−fi 的二次舍入）；
   - 年限分位：达成样本的年限收集为 `Vec<f64>` 升序排序 → `quantile_f64` 于 0.05/0.25/0.50/0.75/0.95 → `round2_f64`；**达成样本为空时五个分位一律 -1.0**；
   - 期末资产分位：全部路径的期末 assets 升序排序 → `quantile_f64` → `round2_f64`（下限钳 0 保证非负）；
   - `samplePaths`：抽样路径逐年年末值 `round2_f64` 后收集，组装方式与 montecarlo.rs:238-241 一致。
8. **精度声明**（模块头注释照抄惯例）：金额入参按 arbitrary_precision 精确解析后转 f64；模拟与统计按 rand/rand_distr 惯例使用 f64；输出统一舍入（金额 2 位、概率 6 位、年限分位 2 位）。

#### 4.2.3 确定性声明

抽样顺序（路径外层 / 年份内层 / 先回报后通胀）+ `StdRng::seed_from_u64` + 每路径固定消费 `2 × years` 个样本（无提前 break）⇒ 同 seed 同输入输出逐字节一致；该性质由 §4.7 测试 1 锁定。

### 4.3 service：`src/services/finance.ts` 增量（逐字可粘贴）

import 区（`finance.ts:11-35`）：模块导入追加 `simulate_accumulation as wasmSimulateAccumulation`；类型导入追加 `AccumulationInput`、`AccumulationOutput`。文件末尾追加：

```ts
function parseAccumulation(obj: Record<string, unknown>): FinanceResult<AccumulationOutput> {
  const err = businessError(obj);
  const finalRaw = obj["finalAssetPercentiles"];
  if (typeof finalRaw !== "object" || finalRaw === null || Array.isArray(finalRaw)) {
    throw new Error("simulate_accumulation 返回的 finalAssetPercentiles 字段异常");
  }
  const finalRec = finalRaw as Record<string, unknown>;
  const data: AccumulationOutput = {
    fiProbability: num(obj, "fiProbability", "simulate_accumulation"),
    yearsP5: num(obj, "yearsP5", "simulate_accumulation"),
    yearsP25: num(obj, "yearsP25", "simulate_accumulation"),
    yearsMedian: num(obj, "yearsMedian", "simulate_accumulation"),
    yearsP75: num(obj, "yearsP75", "simulate_accumulation"),
    yearsP95: num(obj, "yearsP95", "simulate_accumulation"),
    neverReachedShare: num(obj, "neverReachedShare", "simulate_accumulation"),
    finalAssetPercentiles: {
      p5: num(finalRec, "p5", "simulate_accumulation.finalAssetPercentiles"),
      p25: num(finalRec, "p25", "simulate_accumulation.finalAssetPercentiles"),
      p50: num(finalRec, "p50", "simulate_accumulation.finalAssetPercentiles"),
      p75: num(finalRec, "p75", "simulate_accumulation.finalAssetPercentiles"),
      p95: num(finalRec, "p95", "simulate_accumulation.finalAssetPercentiles"),
    },
    samplePaths: numMatrix(obj, "samplePaths", "simulate_accumulation"),
    error: err ?? "",
  };
  if (err) return { ok: false, error: err, notReady: false };
  return { ok: true, data };
}

/** 打工积累模拟（契约 simulate_accumulation） */
export function calcAccumulation(
  input: AccumulationInput,
): Promise<FinanceResult<AccumulationOutput>> {
  return invoke("simulate_accumulation", wasmSimulateAccumulation, input, parseAccumulation);
}
```

（业务错误走 `parseBaseline` 同款模式：`error` 非空 → `ok: false`，UI 显示 Alert。）

### 4.4 pkg 产物同步

核心方在 Rust 测试全绿后执行：

```bash
wasm-pack build src/wasm --target web --out-dir pkg --release
```

产物（`finance_core.js` / `.d.ts` / `.wasm`）入库；`.d.ts` 将自动新增 `export function simulate_accumulation(input: string): string;` 与 `InitOutput.simulate_accumulation` 声明。`finance.ts` 的懒加载无需改动（`ensureInit` 机制不变）。

### 4.5 store 与 defaults 增量（第 3 步）

`src/data/defaults.ts` 追加：

```ts
/** 打工积累模拟面板默认输入（目标值基期默认 = 基础模式默认临界值 1,635,200；
 * 默认与基础模式临界值实时联动，手动修改后解除联动，见 store accumulationTargetSynced） */
export const ACCUMULATION_DEFAULTS: AccumulationInput = {
  currentAssets: 500000,
  monthlyIncome: 8000,
  monthlyExpense: 2990,
  targetValue: 1_635_200,
  nominalReturnMeanPct: 4.5,
  nominalReturnStdPct: 12,
  inflationMeanPct: 2,
  inflationStdPct: 1,
  years: 40,
  paths: 5000,
  seed: 42,
};
```

（`AccumulationInput` 从 `../wasm/bridge` 导入；`monthlyExpense: 2990` 与基础模式默认月开销同源口径。）

`useCalculatorStore.ts` 追加切片：

```ts
  /** 打工积累模拟面板输入 */
  accumulationInputs: AccumulationInput;
  setAccumulationInputs: (patch: Partial<AccumulationInput>) => void;
  /** 目标值是否与基础模式临界值实时联动（手动修改目标值即置 false） */
  accumulationTargetSynced: boolean;
  setAccumulationTargetSynced: (v: boolean) => void;
```

```ts
  accumulationInputs: { ...ACCUMULATION_DEFAULTS },
  accumulationTargetSynced: true,

  setAccumulationInputs: (patch) =>
    set((state) => ({ accumulationInputs: { ...state.accumulationInputs, ...patch } })),
  setAccumulationTargetSynced: (v) => set({ accumulationTargetSynced: v }),
```

`resetAll` 同步追加 `accumulationInputs: { ...ACCUMULATION_DEFAULTS }`、`accumulationTargetSynced: true`。

### 4.6 UI：`AccumulationPanel.tsx`（新文件）与 AdvancedPanel 挂载

#### 4.6.1 面板结构（对照 `MonteCarloPanel.tsx` 同构：手动运行 → loading → 结果 + 图）

- store 接线：`accumulationInputs` / `setAccumulationInputs` / `accumulationTargetSynced` / `setAccumulationTargetSynced` / `baselineInputs` / `currency.display` / `colorBlindFriendly` / `theme`。
- **目标值联动**（模式同 `ReversePanel.tsx:30-39` 的同步按钮 + 实时联动扩展）：
  - 面板内自持一次轻量基线预览：`const baselinePreview = useFinanceCall(() => calcBaseline(baseline), [baseline], { debounceMs: 300 });`
  - `const effectiveTarget = synced && baselinePreview.result?.ok ? baselinePreview.result.data.criticalValue : inputs.targetValue;`
  - 目标值 `AmountField`：`value={effectiveTarget}`；`onChange={(v) => { setInputs({ targetValue: v }); setAccumulationTargetSynced(false); }}`（手动修改即解除联动）；`hint`：联动中显示 `t("accumulation.syncedHint")`，未联动不显示。
  - 同步按钮：`<Button size="small" className="wf-pressable" onClick={() => setAccumulationTargetSynced(true)}>{t("accumulation.syncButton")}</Button>`（置于 FieldRow 与运行区之间，与 ReversePanel 按钮同款式样）。
  - `run()` 提交输入：`calcAccumulation({ ...inputs, targetValue: effectiveTarget })`（运行时取当刻联动值，不回写 store）。
- **字段清单**（FieldRow 内，md 断点两列；标签/tooltip 除注明外全部用 `accumulation.*` 新键）：

| 字段 | 组件 | 值 / 限额 | 键 |
| --- | --- | --- | --- |
| 当前资产 | AmountField | `inputs.currentAssets`，LIMITS.amount | `accumulation.currentAssets(+Tooltip)` |
| 税后月收入 | AmountField | `inputs.monthlyIncome` | `accumulation.monthlyIncome(+Tooltip)` |
| 月支出 | AmountField | `inputs.monthlyExpense` | `accumulation.monthlyExpense(+Tooltip)` |
| 目标值（基期） | AmountField | effectiveTarget（见上） | `accumulation.targetValue(+Tooltip)` |
| 名义回报率均值/标准差 | PercentField ×2 | `nominalReturnMeanPct` / `nominalReturnStdPct` | 复用 `mc.returnMean(+Tooltip)` / `mc.returnStd(+Tooltip)` |
| 通胀率均值/标准差 | PercentField ×2 | `inflationMeanPct` / `inflationStdPct` | 复用 `mc.inflationMean(+Tooltip)` / `mc.inflationStd(+Tooltip)` |
| 模拟年限（默认 40） | IntField | `inputs.years`，min/max = `LIMITS.simYears`，suffix `units.yearUnit`，hint `mc.yearsHint` | 复用 `mc.years` / `mc.yearsTooltip` |
| 模拟路径数（5000） | PathsField | `inputs.paths`，hint `mc.pathsHint` | 复用 `mc.paths` / `mc.pathsTooltip` |
| 随机种子（42） | IntField | `inputs.seed`，suffix `#` | 复用 `mc.seed` / `mc.seedTooltip` |

- **月储蓄口径行**（字段区与运行区之间，`Text`）：`t("accumulation.savingLine", { income: formatMoney(inputs.monthlyIncome, symbol), expense: formatMoney(inputs.monthlyExpense, symbol), saving: formatMoney(inputs.monthlyIncome - inputs.monthlyExpense, symbol) })`；储蓄为负时数值以 `themeTokens.fall` 着色，否则 `themeTokens.rise`。
- **运行区**（`div.wf-acc-actions`）：`Button type="primary"` 文案复用 `mc.run`，`loading`/`disabled` 接 `running` state（本地面 state + `calcAccumulation(...).then/setResult`，模式同 `MonteCarloPanel.tsx:77-86`）；运行中显示 `Spin` + `mc.running`（`div.wf-acc-running`）。
- **结果区**（`data` 就绪时渲染）：
  1. 达成概率（`div.wf-acc-progress`）：标签 `t("accumulation.fiLabel")` + `Progress percent={fiProbability × 100}`，`formatText={(p) => \`${formatNumber(p, 1)}%\`}`，`color={themeTokens.rise}`，`maxWidth: 420`；下方 `Text type="secondary"` 显示 `t("accumulation.fiHint")`。
  2. **年限分位表**（`Descriptions border size="small" column={{ xs: 1, md: 2 }}`，窄屏 `layout="vertical"` 经 `useIsNarrowViewport`，标题行用 `t("accumulation.yearsTitle")`）：五行 yearsP5 / yearsP25 / yearsMedian / yearsP75 / yearsP95；**值 < 0 显示 "—"**，否则 `` `${formatNumber(v, 1)} ${t("units.yearUnit")}` ``。
  3. **期末资产分布**（同款式 Descriptions，标题 `t("accumulation.finalTitle")`）：p5/p25/p50/p75/p95 金额 `formatMoney(v, symbol)`；p50 标签复用 `mc.medianTerminal`，其余复用 `mc.p5` / `mc.p25` / `mc.p75` / `mc.p95`。
  4. **路径数标注**：复用 `t("mc.pathsYears", { paths: formatNumber(inputs.paths, 0), years: inputs.years })`。
- **折线图**（`div.wf-acc-chart`，数据行构造与 `MonteCarloPanel.tsx:89-107` 同构）：
  - 行结构 `{ year, p0..p49, median, target }`：`median` 为该年 50 条抽样路径的中位数（复用同款 `median()` 局部函数）；`target` 为**展示口径目标线** = `effectiveTarget × (1 + inputs.inflationMeanPct / 100) ** year`（输出契约不含各路径目标序列；各路径的真实判定使用其自身通胀样本，图表说明文字注明）。
  - `Line` 系列：50 条路径 `stroke={themeTokens.primary}`、`strokeWidth={1}`、`strokeOpacity={0.12}`、`dot={false}`；中位线 `stroke={themeTokens.rise}`、`strokeWidth={2.5}`；目标线 `stroke={themeTokens.textSecondary}`、`strokeWidth={1.5}`、`strokeDasharray="6 4"`、`dot={false}`。
  - 网格/刻度/入场动画：照抄 `MonteCarloPanel.tsx:240-272`（`chartGrid`/`chartTick` 主题解析值；`lineAnimationProps` 同款——`MOTION_DURATIONS.slow` + 减弱动效停用）。
  - 图下注释 `Text type="secondary" className="wf-panel-note"`：`t("accumulation.chartNote", { count })`。
- **空态与错误**：未运行时 `Alert type="info"` 显示 `t("accumulation.placeholder")`；`result` 不 ok 时 `Alert type="error"`。

#### 4.6.2 面板头注释（文件顶部，规范口径提示照抄）

```tsx
/**
 * ⑥ 打工积累模拟：给定税后月收入与月支出，按名义回报 + 通胀双随机模拟攒钱路径，
 * 输出财富自由达成概率、首达年限分位、期末资产分布与 50 条路径图。
 * 口径（契约 simulate_accumulation，见 src/wasm/bridge.ts）：月储蓄 = 月收入 − 月支出
 * （可为负）；年储蓄自第 1 年起随通胀上行；目标随通胀水涨；首达即记录整数年，
 * 模拟继续至年限结束；同一种子 + 相同输入 → 结果完全可复现。
 * 文案经 react-i18next 三语化。
 */
```

#### 4.6.3 AdvancedPanel 挂载（`AdvancedPanel.tsx`）

- import：`import AccumulationPanel from "./advanced/AccumulationPanel";`
- `<Collapse>` 内**追加在 tax 项之后**（保持 ①–⑤ 现有编号稳定，新面板为⑥）：

```tsx
<CollapseItem name="accumulation" header={t("advanced.accumulationHeader")}>
  <AccumulationPanel />
</CollapseItem>
```

### 4.7 Rust 测试清单（`src/wasm/tests/integration.rs` 新增第 10 节）

前置于 `use` 区：`simulate_accumulation` 加入 `finance_core` 导入列表（`integration.rs:12-15`）。测试辅助（追加在 §7 蒙特卡洛辅助之后）：

```rust
fn acc_input(
    current_assets: f64,
    income: f64,
    expense: f64,
    target: f64,
    mean_r: f64,
    std_r: f64,
    mean_i: f64,
    std_i: f64,
    years: f64,
    paths: f64,
    seed: u64,
) -> String {
    format!(
        r#"{{"currentAssets":{},"monthlyIncome":{},"monthlyExpense":{},"targetValue":{},"nominalReturnMeanPct":{},"nominalReturnStdPct":{},"inflationMeanPct":{},"inflationStdPct":{},"years":{},"paths":{},"seed":{}}}"#,
        current_assets, income, expense, target, mean_r, std_r, mean_i, std_i, years, paths, seed
    )
}
```

**闭式解公式（规范正文，测试与评审共用）**——零波动（σ→1e-9，样本≈均值）下记 `g = 1 + r`、`q = 1 + i`、`S = 月储蓄 × 12`、实际项 `B_t = A_t ÷ q^t`（目标随通胀上行后在实际项下化为常数）：

```text
g ≠ q：A_t = A₀·g^t + S·q·(g^t − q^t)/(g − q)
       B_t = A₀·ρ^t + S·(ρ^t − 1)/(ρ − 1)，ρ = g/q
g = q：B_t = A₀ + S·t
首达年份 t* = min{ t : B_t ≥ 目标值 }（B_t 关于 t 单调当且仅当 ρ ≥ 1 或储蓄为正）
```

以下锚点数值已用 Node.js 按上式验算（本规范撰写时执行，非手算）：

| 用例 | 锚点 |
| --- | --- |
| A（§测试 2） | ρ = 1.029411764706；B₁₇ = 1,597,970.22 < 1,635,200 ≤ B₁₈ = 1,680,969.34 → t* = 18；A₁₈ = 2,400,838.15；A₄₀ = 9,434,299.99 |
| B（§测试 5） | 目标上行 t* = 11；固定目标稻草人 t = 8 |
| C（§测试 5b） | 实际项上界 B∞ = S ÷ (1 − ρ) = 36,000 ÷ (1 − 0.99/1.05) = 630,000 < 1,000,000 → 永不达标 |

```rust
// ---------------------------------------------------------------------------
// 10. simulate_accumulation
// ---------------------------------------------------------------------------

#[test]
fn accumulation_same_seed_is_deterministic() {
    let inp = acc_input(500000.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 200.0, 42);
    let a = simulate_accumulation(&inp);
    let b = simulate_accumulation(&inp);
    assert_eq!(a, b, "同 seed 同输入必须逐字节一致");

    let c = simulate_accumulation(&acc_input(
        500000.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 200.0, 43,
    ));
    assert_ne!(a, c, "不同 seed 输出应不同");

    let v = jv(&a);
    assert_eq!(txt(&v, "error"), "");
    let fi = num(&v, "fiProbability");
    assert!((0.0..=1.0).contains(&fi), "达成概率须在 [0,1]：{fi}");
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50, "固定抽取 50 条");
    for path in paths {
        assert_eq!(path.as_array().unwrap().len(), 40, "每条长度 = years");
    }
}

#[test]
fn accumulation_zero_volatility_closed_form_known_value() {
    // 闭式解与锚点见 docs/p0-spec.md §4.7：
    // A0 = 500,000、月收入 6,000、月支出 3,000（月储蓄 3,000 → S = 36,000）、
    // r = 5%、i = 2%、目标 1,635,200：B_17 = 1,597,970.22 < 目标 ≤ B_18 = 1,680,969.34
    // → 全部路径首达年限 = 18；A_40 = 9,434,299.99（期末分位锚点）。
    // 容差 5 元覆盖 σ=1e-9 抽样抖动的复利影响（相对约 5e-7）。
    let out = simulate_accumulation(&acc_input(
        500000.0, 6000.0, 3000.0, 1635200.0, 5.0, 1e-9, 2.0, 1e-9, 40.0, 40.0, 7,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 1.0, 1e-9, "全部路径达成");
    for k in ["yearsP5", "yearsP25", "yearsMedian", "yearsP75", "yearsP95"] {
        assert_close(num(&v, k), 18.0, 1e-9, "零波动下首达年限全为 18");
    }
    assert_close(num(&v, "neverReachedShare"), 0.0, 1e-9, "无未达成路径");

    let fp = v.get("finalAssetPercentiles").unwrap();
    for k in ["p5", "p25", "p50", "p75", "p95"] {
        let x = num(fp, k);
        assert!(
            (x - 9_434_299.99).abs() <= 5.0,
            "{k} 应为闭式解 A_40 ≈ 9,434,299.99（实际 {x}）"
        );
    }

    // paths = 40 < 50：按索引公式重复抽取至 50 条（契约口径）
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50);
    let p0 = paths[0].as_array().unwrap();
    let a17 = p0[16].as_f64().unwrap();
    let a18 = p0[17].as_f64().unwrap();
    assert!(
        a17 / 1.02f64.powi(17) < 1_635_200.0,
        "第 17 年末实际项未达标：{}",
        a17 / 1.02f64.powi(17)
    );
    assert!(
        a18 / 1.02f64.powi(18) >= 1_635_200.0,
        "第 18 年末实际项达标"
    );
    assert!(
        (a18 - 2_400_838.15).abs() <= 5.0,
        "第 18 年末名义资产 ≈ 2,400,838.15（实际 {a18}）"
    );
}

#[test]
fn accumulation_negative_saving_never_reaches() {
    // 月收入 3,000 < 月支出 6,000：月储蓄 −3,000，起点 0 → 每年下限钳 0，永不达标
    let out = simulate_accumulation(&acc_input(
        0.0, 3000.0, 6000.0, 1635200.0, 5.0, 1e-9, 2.0, 1e-9, 30.0, 10.0, 1,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 0.0, 1e-12, "负储蓄永不达标");
    for k in ["yearsP5", "yearsP25", "yearsMedian", "yearsP75", "yearsP95"] {
        assert_eq!(num(&v, k), -1.0, "{k} 无达成样本应为 -1");
    }
    assert_close(num(&v, "neverReachedShare"), 1.0, 1e-12, "未达成占比 1");
    let fp = v.get("finalAssetPercentiles").unwrap();
    for k in ["p5", "p25", "p50", "p75", "p95"] {
        assert_eq!(num(fp, k), 0.0, "资产下限钳 0：期末 {k} = 0");
    }
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    for row in paths {
        for x in row.as_array().unwrap() {
            assert_eq!(x.as_f64().unwrap(), 0.0, "钳 0 后逐年年末值均为 0");
        }
    }
}

#[test]
fn accumulation_reaches_at_year_zero() {
    // 初始资产 2,000,000 ≥ 目标 1,635,200 → 首达年限 0（t = 0 即判定）
    let out = simulate_accumulation(&acc_input(
        2000000.0, 0.0, 0.0, 1635200.0, 5.0, 1e-9, 2.0, 1e-9, 10.0, 5.0, 3,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 1.0, 1e-12, "初始即达标");
    for k in ["yearsP5", "yearsP25", "yearsMedian", "yearsP75", "yearsP95"] {
        assert_close(num(&v, k), 0.0, 1e-12, &format!("{k} = 0（初始即达标）"));
    }
    assert_close(num(&v, "neverReachedShare"), 0.0, 1e-12, "无未达成路径");
}

#[test]
fn accumulation_target_inflates_with_inflation() {
    // 口径断言：判定目标随通胀上行（t 年目标 = 目标值 × ∏(1+通胀样本)）。
    // r = 0%、i = 2%、A0 = 500,000、月储蓄 5,000（S = 60,000）、目标 1,000,000：
    // B_t = 3,060,000 − 2,560,000·1.02^−t ≥ 1,000,000 ⇔ 1.02^t ≥ 1.2427 → t* = 11；
    // 若误用「固定目标」口径则 t* = 8 —— 断言 11 锁定上行口径。
    let out = simulate_accumulation(&acc_input(
        500000.0, 5000.0, 0.0, 1000000.0, 0.0, 1e-9, 2.0, 1e-9, 30.0, 20.0, 7,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "yearsMedian"), 11.0, 1e-9, "目标随通胀上行时首达中位 11 年");
    assert!(num(&v, "yearsMedian") > 8.0, "不得退化为固定目标口径（= 8 年）");
    assert_close(num(&v, "fiProbability"), 1.0, 1e-9, "30 年内全部达成");
}

#[test]
fn accumulation_negative_real_growth_never_reaches_inflating_target() {
    // r = −1%、i = 5%、A0 = 500,000、月储蓄 3,000（S = 36,000）、目标 1,000,000：
    // 实际项上界 B∞ = 36,000 ÷ (1 − 0.99/1.05) = 630,000 < 1,000,000 → 永不达标；
    // 名义资产终将累积超过固定目标，故本断言同时从反面锁定「目标上行」口径。
    let out = simulate_accumulation(&acc_input(
        500000.0, 3000.0, 0.0, 1000000.0, -1.0, 1e-9, 5.0, 1e-9, 60.0, 20.0, 5,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 0.0, 1e-12, "负实际增长 + 目标上行 → 永不达标");
    assert_eq!(num(&v, "yearsMedian"), -1.0);
}

#[test]
fn accumulation_validation_errors() {
    for (input, keyword) in [
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 0.0, 2.0, 1.0, 40.0, 10.0, 1), "标准差"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, -1.0, 2.0, 1.0, 40.0, 10.0, 1), "标准差"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 0.0, 40.0, 10.0, 1), "标准差"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 0.0, 10.0, 1), "模拟年数"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 0.5, 10.0, 1), "整数"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 0.0, 1), "模拟路径数"),
        (acc_input(-1.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 10.0, 1), "当前资产"),
        (acc_input(0.0, -100.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 10.0, 1), "月收入"),
    ] {
        let v = jv(&simulate_accumulation(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert_eq!(num(&v, "yearsMedian"), -1.0, "错误安全值：年限分位 = -1");
        assert!(v.get("samplePaths").unwrap().as_array().unwrap().is_empty());
    }
}
```

### 4.8 ③ 验收清单

- [ ] `cargo test --manifest-path src/wasm/Cargo.toml` 全绿（含 §4.7 全部新用例 + 既有回归原样通过）。
- [ ] 面板⑥默认收起，标题「⑥ 打工模拟 —— …」；展开后目标值默认与基础模式临界值实时联动（改基础月开销 → 目标值随防抖结果更新）。
- [ ] 手动改目标值 → 联动解除（hint 消失）；点「与基础模式同步临界值」→ 联动恢复。
- [ ] 默认输入（500,000 / 8,000 / 2,990 / 163.52 万 / 4.5±12% / 2±1% / 40 年 / 5000 条 / 种子 42）运行出结果；改种子重跑数值变化、回填原种子数值逐位复原。
- [ ] 年限分位表在无达成样本时五格全为「—」；负储蓄输入（月支出 > 月收入）验证之。
- [ ] 折线图 50 条浅色细线 + 中位粗线 + 目标虚线；切深浅主题与色盲友好开关颜色联动；减弱动效下图表免动画成图。

---


> **P7 增补（2026-11-21 实施）**：本节锚点全部保持现状零漂移（pass1 与 sustainYears 无条件解耦）。新增存续口径与随机流拓扑裁定以 docs/p7-spec.md §2.2 为唯一登记口径——**两段式独立派生流**：pass1 纯积累（原流序逐字节不变）+ pass2 仅达标路径派生流 `seed ^ ((p+1)×0x9E37_79B9_7F4A_7C15)` 续接支取（耗尽即提前终止、未达标路径零抽样）；可复现性三不变 (a)(b)(c) 与锁定测试 `accumulation_sustained_invariant_same_seed`（真实量级 σ）见 p7-spec §2.2/§3.8。

## 5. 新增文案键清单（37 键，简中基准；zh-Hant 逐词字形转换、en 翻译）

落点文件：`src/i18n/locales/zh-CN.ts` / `zh-Hant.ts` / `en.ts`；插值占位符名三份必须一致。

### 5.1 `presets.*`（14 键）

| 键 | 简中文案 |
| --- | --- |
| `presets.label` | `快速画像` |
| `presets.custom` | `自定义` |
| `presets.tagTitle` | `消费构成（合计 {{total}} 元/月）` |
| `presets.note` | `以一线城市口径整理，可自由修改` |
| `presets.appliedHint` | `已应用「{{name}}」画像参数` |
| `presets.names.singleRenter` | `单身租房` |
| `presets.names.coupleNoKids` | `无孩夫妻` |
| `presets.names.familyOneKid` | `一孩家庭` |
| `presets.names.zenFrugal` | `佛系低欲望` |
| `presets.breakdown.food` | `吃` |
| `presets.breakdown.housing` | `住` |
| `presets.breakdown.transport` | `行` |
| `presets.breakdown.communication` | `通讯` |
| `presets.breakdown.other` | `其他` |

### 5.2 `progress.*`（5 键）

| 键 | 简中文案 |
| --- | --- |
| `progress.assetsLabel` | `已有资产（选填）` |
| `progress.assetsTooltip` | `你目前已经攒下的可投资资产；填写后在大字号旁展示相对参考线的进度环。` |
| `progress.ringTitle` | `自由刻度` |
| `progress.caption` | `已有资产约为参考线的 {{pct}}%` |
| `progress.ariaLabel` | `自由刻度进度环：已有资产约为参考线的 {{pct}}%` |

### 5.3 `advanced.accumulationHeader`（1 键）

| 键 | 简中文案 |
| --- | --- |
| `advanced.accumulationHeader` | `⑥ 打工模拟 —— 靠工资储蓄攒到目标需要多少年` |

### 5.4 `accumulation.*`（17 键）

| 键 | 简中文案 |
| --- | --- |
| `accumulation.currentAssets` | `当前资产` |
| `accumulation.currentAssetsTooltip` | `模拟起点：你现在拥有的投资资产总额。` |
| `accumulation.monthlyIncome` | `税后月收入` |
| `accumulation.monthlyIncomeTooltip` | `到手月收入（税后口径）；月储蓄 = 月收入 − 月支出，可为负。` |
| `accumulation.monthlyExpense` | `月支出` |
| `accumulation.monthlyExpenseTooltip` | `当前生活方式下平均每月总支出；自第 1 年起随通胀上行。` |
| `accumulation.targetValue` | `财富自由目标值（基期）` |
| `accumulation.targetValueTooltip` | `判定「达成」的资产门槛；判定时按通胀逐年上调（第 t 年目标 = 该值 × 累计通胀因子）。` |
| `accumulation.syncButton` | `与基础模式同步临界值` |
| `accumulation.syncedHint` | `目标值当前与基础模式临界值实时联动；手动修改目标值即解除联动。` |
| `accumulation.savingLine` | `当前口径：月储蓄 = {{income}} − {{expense}} = {{saving}} 元/月` |
| `accumulation.fiLabel` | `财富自由达成概率` |
| `accumulation.fiHint` | `任一年末资产 ≥ 当年目标（目标随通胀上行）的路径占比` |
| `accumulation.yearsTitle` | `首达年限分布（整数年，仅统计达成路径；「—」表示无达成路径）` |
| `accumulation.finalTitle` | `期末资产分布（全部路径）` |
| `accumulation.chartNote` | `横轴为年份、纵轴单位为「万」；浅色细线为 {{count}} 条代表性抽样路径，粗线为逐年中位数，虚线为按通胀均值绘制的逐年目标（各路径的实际判定使用其自身通胀样本）。同一种子 + 相同输入 → 结果完全可复现（契约保证）。` |
| `accumulation.placeholder` | `点击「运行模拟」后，将按正态随机行情逐年模拟「收入 − 支出」的积累路径，给出财富自由达成概率、首达年限分位与期末财富分布。同一种子 + 相同输入 → 结果完全可复现。` |

### 5.5 复用的既有键（不新增，AccumulationPanel 直接引用）

`mc.returnMean` / `mc.returnMeanTooltip` / `mc.returnStd` / `mc.returnStdTooltip` / `mc.inflationMean` / `mc.inflationMeanTooltip` / `mc.inflationStd` / `mc.inflationStdTooltip` / `mc.years` / `mc.yearsTooltip` / `mc.yearsHint` / `mc.paths` / `mc.pathsTooltip` / `mc.pathsHint` / `mc.seed` / `mc.seedTooltip` / `mc.run` / `mc.running` / `mc.pathsYears` / `mc.medianTerminal` / `mc.p5` / `mc.p25` / `mc.p75` / `mc.p95`、`common.computing`、`units.yuan` / `units.yearUnit` / `units.wan`。

---

## 6. README 双语增补点

### 6.1 功能特性表 +3 行

- **`README.md`**：插入位置 = 功能特性表「蒙特卡洛模拟」行之后（`README.md:119`）。行文本：

```markdown
| 预设场景 | ✅ 已实现 | 基础参数卡内置 4 组生活画像（单身租房 / 无孩夫妻 / 一孩家庭 / 佛系低欲望），一键填入全套基础参数并以只读 Tag 展示消费构成；手动修改任一输入自动切回「自定义」 |
| 自由刻度 | ✅ 已实现 | 填写「已有资产」后，参考线大字号旁展示 SVG 进度环（资产 ÷ 临界值，百分比居中），并标注「已有资产约为参考线的 X%」 |
| 打工模拟 | ✅ 已实现 | 给定税后月收入与月支出，按名义回报 + 通胀双随机模拟攒钱路径：财富自由达成概率、首达年限分位（P5–P95）、期末资产分布与 50 条路径图；目标随通胀水涨，同种子可复现 |
```

- **`README.en.md`**：插入位置 = 「Monte Carlo simulation」行之后（功能表 §`## ✨ Features`）。行文本：

```markdown
| Preset profiles | ✅ Done | Four lifestyle presets (single renter / couple without kids / family with one child / frugal minimal) fill all base inputs in one click and show the spending mix as read-only tags; editing any input switches back to "Custom" |
| Freedom gauge | ✅ Done | With "current assets" filled in, an SVG progress ring (assets ÷ critical value, percentage centered) appears beside the big number, labelled "your assets are about X% of the reference line" |
| Work-years simulation | ✅ Done | Given after-tax monthly income and expense, simulates saving paths under nominal-return and inflation randomness: probability of reaching the goal, first-hit-year percentiles (P5–P95), terminal asset distribution and a 50-path chart; the target rises with inflation and same-seed runs are reproducible |
```

### 6.2 效果演示区 +2 组

- **`README.md`**：插入位置 = 「色盲友好配色 · 一键切换」块之后、gifs 容器 `</div>` 之前（`README.md:67` 与 `README.md:69` 之间）。块文本：

```markdown
### 预设场景 · 一键填入生活画像

![预设场景演示](docs/assets/demo-presets.gif)

*点击「一孩家庭」：月开销 11,000、1 孩 58 万、健康预留 20 万一次填入，按钮下方以只读 Tag 展示消费构成（吃/住/行/通讯/其他）；随后手动修改「每月开销」，高亮自动切回「自定义」*

### 打工模拟 · 靠工资储蓄攒到目标要几年

![打工模拟演示](docs/assets/demo-accumulation.gif)

*税后月收入 8,000、月支出 2,990、目标 163.52 万：5,000 条路径 × 40 年模拟给出达成概率、首达年限分位（P5–P95）与期末资产分布；折线图为 50 条抽样路径 + 中位数粗线 + 按通胀均值上行的目标虚线（种子 42，同输入可复现）*
```

- **`README.en.md`**：插入位置 = 「Color-blind-friendly palette · One-click switch」块之后、gifs 容器 `</div>` 之前。块文本：

```markdown
### Preset profiles · Fill a lifestyle in one click

![Preset profiles demo](docs/assets/en/demo-presets.gif)

*Clicking "Family with one child" fills monthly expense 11,000, one child at 580k and a 200k health reserve at once, with read-only tags showing the spending mix (food / housing / transport / comms / other); editing any field afterwards switches the highlight back to "Custom"*

### Work-years simulation · How long until your savings reach the goal

![Work-years demo](docs/assets/en/demo-accumulation.gif)

*With 8,000 monthly after-tax income, 2,990 monthly expense and a 1,635,200 target, 5,000 paths × 40 years yield the probability of reaching the goal, first-hit-year percentiles (P5–P95) and the terminal asset distribution; the chart draws 50 sampled paths, a median line and a dashed target line rising with mean inflation (seed 42, fully reproducible)*
```

### 6.3 演示素材清单（同步方录制，入 `docs/assets/`）

| 文件 | 界面语言 | 内容 |
| --- | --- | --- |
| `docs/assets/demo-presets.gif` | 简中 | 应用画像 → Tag 展示 → 手改字段切回「自定义」 |
| `docs/assets/demo-accumulation.gif` | 简中 | 打工模拟默认输入运行 → 结果与折线图 → 换种子重跑对比 |
| `docs/assets/en/demo-presets.gif` | English | 同上（英文界面） |
| `docs/assets/en/demo-accumulation.gif` | English | 同上（英文界面） |

素材口径与既有演示一致：**真实运行画面**（构建产物截图/录屏，非设计稿）；`README.md:106-107` 的素材清单 NOTE 顺带补入两个新文件名。

---

## 7. 样式增量（`src/styles/global.css`，界面方）

新增类（全部走既有令牌，禁止裸写字面量时长/曲线/颜色）：

```css
/* ===== P0 三件套：预设场景 / 自由刻度 / 打工积累模拟 ===== */
.wf-preset-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.wf-preset-btn { /* 高亮态由 Button type="primary" 承载，此处仅保证触控目标 */ min-height: 32px; }
.wf-preset-custom { /* 「自定义」态徽标：高亮由 Tag color 承载 */ margin-inline-start: auto; }
.wf-preset-tags { margin-bottom: 8px; }
.wf-preset-note { margin-bottom: 12px; }
.wf-output-hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.wf-progress-ring { flex: none; }
.wf-progress-caption { margin-top: 4px; }
.wf-acc-actions { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
.wf-acc-running { display: inline-flex; align-items: center; gap: 6px; }
.wf-acc-progress { margin-top: 12px; }
.wf-acc-chart { margin-top: 12px; }
```

（对照既有 `wf-mc-actions` / `wf-mc-running` / `wf-mc-progress` / `wf-mc-chart` 的命名与布局模式；如 global.css 中这些类已有等价规则，可复用合并，但新面板不得反向依赖 `wf-mc-*` 类名。）

---

## 8. 总验收与回归命令

```bash
cargo test --manifest-path src/wasm/Cargo.toml                      # §4.7 测试 + 既有回归
wasm-pack build src/wasm --target web --out-dir pkg --release       # 产物再生成（核心方）
npm run build                                                        # tsc --noEmit + vite build（strict 通过）
npm run check:size                                                   # 尺寸门禁（wasm 增量后仍须 ≤ 800KB）
```

手动验收：§2.4 / §3.3 / §4.8 三张清单逐项勾验；三语切换下新增界面无键缺失（i18next 控制台无 missing key 警告）。

---

## 9. 决策记录（与任务书的差异与理由）

1. **所有权外延两点**：`src/data/defaults.ts`（store 切片默认值的既有唯一落点，`useCalculatorStore.ts:3` 惯例）与 `src/styles/global.css`（组件样式集中地）划入界面方——任务书清单未列，但不触碰即无法施工。
2. **预设填充范围**：任务书列举的 5 个基础字段全部由预设填入；名义回报率/通胀率保持用户当前值（属「核心参数」折叠区，非画像口径）。
3. **健康预留锚点**：任务书仅给出佛系低欲望 15 万；其余三组按「单人 15 万 / 双人与家庭 20 万（默认口径）」整理，`note` 注明可自由修改，待数据研究员复核。
4. **图表目标虚线口径**：输出契约不含各路径目标序列，折线图目标线按通胀均值绘制（`effectiveTarget × (1 + 通胀均值)^t`），面板注释明确「各路径实际判定使用其自身通胀样本」。
5. **结果区附加行**：任务书列举「概率 + 年限分位表 + 折线图」三要素；契约同时输出 `finalAssetPercentiles`，规范将其呈现为第二张 Descriptions（不加新计算，纯展示既有契约字段）。
6. **quantile 提升为公共函数**：`montecarlo.rs` 私有 `quantile` 迁至 `common.rs::quantile_f64` 供新模块复用（实现逐行不变，现有一字未改的 MC 回归测试守护行为等价），避免同 crate 两份分位数实现漂移。
7. **测试锚点数值来源**：§4.7 全部锚点（t* = 18 / A₄₀ = 9,434,299.99 / 11 vs 8 / 630,000）为撰写本规范时以 Node.js 按闭式解公式验算的执行结果；测试代码内同时内联公式复算与锚点断言，不依赖手算。
8. **现状勘误**：`bridge.ts:19-21` 头注释仍描述「占位 stub」，而 `src/wasm/pkg/` 已是真实 wasm-pack 产物（`pkg/finance_core.d.ts` 含 6 个导出声明）——规范按真实产物处理，核心方再生成产物时可顺带修正该注释。
