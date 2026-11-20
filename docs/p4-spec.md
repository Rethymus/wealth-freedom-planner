# P4 实现规范：普惠拓展 + 交互修正（docs/p4-spec.md）

> 版本：v1.1（2026-11-20 起草；同日评审修订：§3.8 断言 3 期望值、§6.3 模块形态、§3.3/§3.7 loading 三态、§1 计数实测校正、§6.5 字节回写与通路降级、§13 MIME 断言与走查备忘、§14 增补 13–16）
> 实现者：单实现者（全栈）。施工顺序：**④⑤⑥⑦ 用户反馈修正项先行，随后 ①PWA → ②无障碍 → ③导出 PNG → 收口**。
> 输入材料：docs/research-a11y.md、docs/research-pwa.md、docs/research-advanced-nav.md（三份研究，2026-11-20）+ 本仓现状全部关键文件（本规范起草会话已逐文件通读）。
> 中性纪律：沿 docs/design-spec.md 文首约定——来源以「研究文档 §」标注；npm 包名 / 属性名 / 文件路径等实现层标识符属豁免口径。审计忽略清单已扩展覆盖 manifest / sw 产物文件名（sw.js、manifest.webmanifest、registerSW.js、public/icons/）。
> 硬边界：**本轮零 wasm 改动**（src/wasm/** 不动、bridge.ts 不动、cargo 不跑、分享链接版本号 SHARE_LINK_VERSION = 3 不变、场景库载荷形状不变）。币种换算全部在 TS 展示层完成。

---

## 0. 结论摘要

1. **四个用户反馈修正项全部可落地，改动面小**：④ 预设取消 = store 一个新 action + 按钮点击分支（§2）；⑤ 币种真实换算 = 一个纯函数模块 + 一个 hook + fields 一处改造 + 9 个组件的金额调用点替换（§3）；⑥ 手风琴互斥 = 一个属性（§4）；⑦ 高级区导航 = 研究裁定「互斥 Collapse + 两行标题」，与 ⑥ 同一属性承载，迁移清单 6 项（§5）。
2. **研究对 ask 提示的三处改写（均以研究结论为准）**：⑦ 不采 Tabs（键盘实证缺口），互斥 Collapse 为准（§5.1）；① 更新提示不采 prompt 弹窗，autoUpdate 静默换版，**无需更新提示 UI 与三语文案**（§6.4）；「图表视觉隐藏读屏数据表」现状六图已有可见数据表且读屏可达，**不新增隐藏表**，登记口径即可（§7.6）。
3. **尺寸预算结论（本会话实跑核实，必读）**：当前 dist 干净口径 **1,980,439 字节，门禁余量 19,561 字节 ≈ 19.1KB**——ask 所述「约 115KB」与本会话实测不符（research-pwa §6.4 早已登记同一偏差）。PWA 最小组合 ≈15.8KB + 其余 P4 改动估算 ≈10.2KB → **全口径 ≈26KB，超出余量 ≈6.5KB（0.33%）**。裁定与账本见 §11：首选沿 p2-spec §10.3 先例特批 2,000,000 → 2,010,000（回滚条件随附）；红线语义不变，超标仍 fail。
4. **门禁测量缺陷必修**：`scripts/check-size.mjs` 的 `walk()` 不跳过 `.git`，部署后复跑必假阴性（本会话复现：`DIST_TOTAL_KB=2590`、exit 1；剔除 `.git` 后真实合计 1,980,439 字节）。B0 批次修复（§11.1）。
5. **验收命令级清单**见 §13；新增文案键 **31 键净增 22 键**（§10），低于 ask 预估的 45–65（原因：更新提示键取消 + 复用既有键），逐键列出。

---

## 1. 现状基线（本会话实证）

| 项 | 证据 |
| --- | --- |
| 预设无取消路径 | `src/components/BasicCalculator.tsx:583-603` 预设按钮 onClick 仅 `applyPreset`；`src/store/useCalculatorStore.ts:187-195` applyPreset 整体覆盖 5 字段并置 activePresetId |
| 币种只换符号 | 全部金额经 `src/services/format.ts:25-40` `formatMoney/formatMoneyFixed(value, symbol)` 直取 wasm 输出（CNY 规范值）；store 金额恒 CNY（`useCalculatorStore.ts:169` DEFAULT_CURRENCY）；`App.tsx:307-309` 切币种仅弹提示 |
| 汇率服务 | `src/services/rates.ts:193` `getRates()`（CNY 基准，1 CNY = rates[target] target；8s 超时；失败回退 `FX_RATE_SNAPSHOT`（当前占位仅 CNY:1，`defaults.ts:201-208`）；模块级缓存去重）；现仅 `CurrencySection.tsx:39` 一处消费 |
| 高级区可全开 | `src/components/AdvancedPanel.tsx:26` Collapse 未传 `accordion`，九项可同开 |
| 金额输入字段 | `AmountField` + `prefix={symbol}` 共 **24 处**：基础卡 5、反向 4、贷款 1、收租 4、蒙特卡洛 3（`MonteCarloPanel.tsx:464,472,628`）、打工 4、养老金 2、税务 1（`TaxPanel.tsx:132`）（本会话 `grep -rn "<AmountField" src/components/` 实测） |
| 金额展示点 | formatMoney/formatMoneyFixed 调用 **64 行**（`grep -rnE "formatMoney\(|formatMoneyFixed\(" src/components/ --include="*.tsx" \| grep -v import` 实测；输出卡 / 六面板 / 情景对比 6 项金额指标）；图表轴「万」口径 **5 处 `tickFormatter`**（`BasicCalculator:202`、`AccumulationPanel:522`、`MonteCarloPanel:676,843`、`RentalPanel:619`，另加输出卡摘要「万」行）；aria 汇总句内嵌金额 3 处（mc.chartAria 中位终值、打工 aria 月储蓄、龙卷风标签） |
| 尺寸门禁 | `scripts/check-size.mjs:25-26` 总量 2,000,000 / wasm 单项 800,000；本会话 `npm run build && node scripts/check-size.mjs`：exit 1、`DIST_TOTAL_KB=2590`（含 dist/.git 671,305 字节污染）；剔除 `.git` 实测 **1,980,439 字节**，余量 19,561 字节 |
| dist gzip 口径（记录用） | 本会话实测 gzip 合计 547,460 字节——门禁为**原始字节**口径，gzip 仅作加载体积参考 |

---

## 2. ④ 预设画像可取消（缺陷修复，最高优先）

### 2.1 交互定夺

**采纳「再次点击已激活画像即取消」**，不增设显式「清除」按钮。理由：
1. 改动面最小（零新增界面元素、零新增布局）——当前 `wf-preset-bar` 已是按钮排，toggle 语义与组件库折叠头「点击已展开项收起」（research-advanced-nav §2）同构，用户心智一致；
2. 「自定义」Tag（`BasicCalculator.tsx:600-602`）已天然充当取消后的状态回显，无需新指示器；
3. 显式清除按钮在三语收纳档（顶栏与输入卡均已高度拥挤）会加剧布局压力，且与「手动修改任一字段即切自定义」的既有隐式退出路径形成双入口歧义。

### 2.2 store 行为（契约，可直接粘贴）

`src/store/useCalculatorStore.ts`：

```ts
/** 取消画像：5 个画像覆盖字段整体回落 BASELINE_DEFAULTS，activePresetId 回 "custom"。
 *  nominalReturnPct / inflationPct 不在画像覆盖范围，保持当前值不动；progressInputs
 *  等其他切片不动。与 applyPreset 同为整体写入语义：预设写入是覆盖，取消就是回退。 */
clearPreset: () =>
  set((state) => ({
    baselineInputs: {
      ...state.baselineInputs,
      monthlyExpense: BASELINE_DEFAULTS.monthlyExpense,
      childCount: BASELINE_DEFAULTS.childCount,
      costPerChild: BASELINE_DEFAULTS.costPerChild,
      healthReserve: BASELINE_DEFAULTS.healthReserve,
      majorInvestment: BASELINE_DEFAULTS.majorInvestment,
    },
    activePresetId: "custom" as const,
  })),
```

接口 `CalculatorState` 增 `clearPreset: () => void;`（置于 `applyPreset` 声明之后）。

**回落默认值（而非保留当前值）的理由**：
1. **状态标签诚实**：取消后若保留画像值，界面显示「自定义」但数值仍是画像值——标签撒谎；回落默认后「自定义」Tag 与数值真实一致；
2. **终态可预期**：与 `resetAll` 的基础字段终态、与「新访客默认态」三者同值，消除「取消后到底留下了什么」的心智负担；
3. **语义对称**：画像写入 = 5 字段整体覆盖 → 取消 = 5 字段整体回退；部分保留反而引入第三种语义。

### 2.3 组件改动（BasicCalculator.tsx:584-598）

- 预设按钮 onClick 分支：

```tsx
onClick={() => {
  if (activePresetId === profile.id) {
    clearPreset();
    Message.success(t("presets.cancelled", { name: t(PRESET_NAME_KEY[profile.id]) }));
  } else {
    applyPreset(profile.id);
    Message.success(t("presets.appliedHint", { name: t(PRESET_NAME_KEY[profile.id]) }));
  }
}}
```

- 激活态按钮补取消提示：`title={activePresetId === profile.id ? t("presets.cancelHint") : undefined}`（`aria-pressed` 既有，无需改）。
- 取消后消费构成 Tag 行（`activeProfile` 为 null）自动隐藏——现状逻辑零改动。
- **不 bump resetEpoch**：与 applyPreset 同机制（受控值直接更新）。若验收时发现「用户编辑过字段后点取消，InputNumber 显示不刷新」（Q3-2 同类问题），备案修正：clearPreset 内 `resetEpoch: state.resetEpoch + 1`（一行），登记 deviations。

---

## 3. ⑤ 币种真实换算（缺陷级改进）

### 3.1 口径总纲

- **store 金额恒为 CNY 规范值**（现状不变）；分享链接、场景库载荷、wasm 输入输出全部保持 CNY——零协议改动。
- 汇率源：复用 `rates.ts` `getRates()`（CNY 基准）；展示币种 CNY 时不发请求、恒等换算（rate = 1）。
- 展示换算：**所有金额展示点**（输出卡大数字 / 摘要与构成 / 预设 Tag / 敏感性数值与龙卷风标签 / 六面板输出与表格 / 图表轴 / aria 汇总句内嵌金额 / 情景对比 8 项指标）统一经换算；换算失败（汇率缺失 / 获取失败）回退**符号-only 模式**并提示（数值保持 CNY 口径）。
- 输入双向换算：24 处 `AmountField`（§1 表）展示币种值 ⇄ CNY 规范值；用户编辑即按换算回写 CNY 规范值入库。
- 汇率时点：接口载荷 `ratesUpdatedAt` + 本地 `fetchedAt`，在 App 级换算提示（§3.6）与既有「税务估算与多币种校验」面板 sourceLine（`CurrencySection.tsx:134-144`）两处如实展示。

### 3.2 新增纯函数模块 `src/services/currency.ts`（契约，可直接粘贴）

```ts
/**
 * 币种展示换算（纯函数，无 React 依赖、无副作用）：
 * store 金额恒为 CNY 规范值；展示层按 rate（1 CNY = rate 单位展示币种）换算。
 * rate 缺失（接口未含该币种 / 获取失败 / 非有限正数）时调用方回退符号-only 模式。
 */
/** CNY 规范值 → 展示币种值（浮点乘法，保留符号与精度；展示格式化交给 format 层） */
export function cnyToDisplay(cny: number, rate: number): number {
  return cny * rate;
}
/** 展示币种输入值 → CNY 规范值：四舍五入到整数（规范口径为整数元，LIMITS.amount
 *  precision 0；取整把往返漂移限制在 ≤0.5 CNY）。负数按 Math.round 语义（向 +∞ 取整），
 *  输入字段金额域为非负，实际不触发。 */
export function displayToCny(displayValue: number, rate: number): number {
  return Math.round(displayValue / rate);
}
/** 从汇率表取指定币种汇率：CNY 恒 1；缺失 / 非有限 / ≤0 → null（符号-only 模式信号） */
export function pickRate(rates: Record<string, number>, code: string): number | null {
  if (code === "CNY") return 1;
  const r = rates[code];
  return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : null;
}
```

### 3.3 新增 hook `useDisplayRate`（落点 `src/components/hooks.ts`）

```ts
export interface DisplayRate {
  code: string;            // 当前展示币种
  rate: number | null;     // null = 换算不可用（符号-only 模式）
  /** true = getRates Promise 未决（请求进行中，超时上限 8s）；true 期间调用方
   *  不得渲染「汇率暂不可用」类断言文案（数据未定，横幅会先撒谎后翻转） */
  loading: boolean;
  offline: boolean;        // 汇率数据是否来自离线快照
  updatedAt: string;       // ratesUpdatedAt（可能为空串）
  source: string;
}
```

行为：
1. `display === "CNY"`：恒返回 `{ code: "CNY", rate: 1, loading: false, offline: false, updatedAt: "", source: "canonical" }`，**不发起请求**；
2. 其他币种：调用 `getRates()`（模块级缓存与 CurrencySection 既有调用自动去重）→ `pickRate(result.rates, display)`；**Promise 未决期 `loading: true` 且 rate 返回 null**（字段按符号-only 渲染，就绪后整帧切换为换算值）；`getRates` 永不 reject（内部已兜底快照），快照缺币种时 pickRate 得 null → 符号-only。
3. 展示币种变化时重跑（deps：displayCode）。已知限制：CurrencySection 强刷（`getRates(true)` 覆写模块级 cached，`rates.ts:186-212`）后，已挂载面板的 hook 持有旧 resolved 值，换算金额至切币种 / 重挂载前保持旧 rate——不引入跨组件事件同步（§14 登记）。

### 3.4 金额展示替换：`useMoney`（落点 `src/components/hooks.ts`）

```ts
/** 组件级金额展示绑定：rate 可用时换算后格式化，否则按 CNY 值直出（符号-only）。 */
export function useMoney(): {
  symbol: string;
  money: (cnyValue: number) => string;
  moneyFixed: (cnyValue: number) => string;
}
```

- 实现：`useDisplayRate()` + `currencySymbol(code)`；`money = (v) => formatMoney(rate !== null ? cnyToDisplay(v, rate) : v, symbol)`（moneyFixed 同构）。
- **替换范围（9 个文件）**：BasicCalculator（大数字 / 摘要万行 / 构成明细 / 预设 Tag / 敏感性数值行与龙卷风标签 / 基准参考线标签 / sensDelta）、ReversePanel、LoanPanel（Descriptions 3 值 + 摊销表 4 列）、RentalPanel（输出 + 瀑布图 `row.labelText`）、MonteCarloPanel（统计行 + `mc.chartAria` 中位终值 + 序列 aria）、AccumulationPanel（savingText + 分位数 + aria 月储蓄）、PensionPanel、TaxPanel、ScenarioPanel（8 项指标中 6 项金额）。
- 动画大数字：`animatedCritical` 仍滚动 **CNY 规范值**，换算在格式化处逐帧做（`money(animatedCritical)`）——rAF 中间帧不落 store 的既有口径不变，aria-live 只绑落定值（§7.5）。
- InsightsPanel 的 480 推导、消费锚点、育儿成本等 **CNY 数据口径锚点不换算**（保持来源数值原貌，现面板文案已含「元」单位）；CurrencySection 月开销偏离检测改用 **CNY 规范值**参与（删除其 `displayCode !== "CNY"` 提前返回分支，`CurrencySection.tsx:53`）——规范值恒在，检测与展示币种解耦（行为微变，登记 §14）。

### 3.5 图表轴「万」口径替换

「万」是 CNY 量词，换算后失义。`src/services/format.ts` 新增：

```ts
/** 图表轴紧凑数值：按 UI 语言走 Intl compact（zh → 万进制「16万」；en → 「160K」），
 *  与币种无关，替换既有 5 处 `${Math.round(v / 10000)}${t("units.wan")}` 写法。 */
export function formatCompactAxis(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(uiLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
```

替换 5 处：`BasicCalculator.tsx:202`（龙卷风 XAxis）、`AccumulationPanel.tsx:522`、`MonteCarloPanel.tsx:676,843`、`RentalPanel.tsx:619`。zh 下 CNY 显示与现状等值（Intl zh compact 与「万」后缀同形），en/其他币种得 K/M 缩写。输出卡摘要「万」换算行（`BasicCalculator.tsx:494-503`）：非 CNY 展示币种下走 `formatCompactAxis(rate !== null ? cnyToDisplay(animatedCritical, rate) : animatedCritical)`——与 §3.4 的 money 同源换算但取**数值路径**（`money()` 返回已格式化字符串，不可作 compact 入参）；en 已有百万读法分支删除，统一 compact 口径。

### 3.6 输入字段双向换算（`src/components/fields.tsx`）

NumberField 新增可选 prop：

```ts
/** 展示换算率（1 CNY = rate 展示币种）；省略或 null = 不换算（现状行为）。
 *  传入时：显示值 = cnyToDisplay(value, rate)；用户编辑经 displayToCny 回写 onChange；
 *  越界校验按回写后的 CNY 规范值对 limit 判定（displayToCny(v) < min || > max）；
 *  换算模式下 InputNumber 精度固定 2、step 1（局部覆写 limit 的 0/100，减少往返漂移）。 */
convertRate?: number | null;
```

- `handleChange`：`convertRate != null` 时先 `displayToCny(v, convertRate)` 再走既有越界校验与落库路径（越界时 `pendingInvalid` 仍存**展示值**供回显）。
- 越界错误文案口径：`field.errorRange` 的 min/max 插值维持 limit 原值（CNY 域，`fields.tsx:103-107` 现状）——换算模式下报错边界与展示币种错位，本轮按现状简化不扩大（§14 登记），可读性由换算横幅「自动回写为人民币口径」表述兜底。
- 24 处调用点：传 `convertRate={rate}`；「元 / 元/月 / 元/孩」类 suffix **仅在 CNY 展示下渲染**（`suffix={displayCode === "CNY" ? t("units.yuanPerMonth") : undefined}`，验收 T2-5 修正，§14 #18）——「元」字后缀在非 CNY 展示下失义（换算与回退态均省略），单位语义由 prefix 符号与字段提示 / currencyFallback 横幅承载。IntField / PercentField / PathsField 不受影响（非金额）。
- 汇率未就绪（rate null）时字段按 CNY 值渲染（与符号-only 模式一致），就绪后受控刷新。

### 3.7 App 级提示（`App.tsx:307-309` 改写）

- App 内调 `useDisplayRate()`；`displayCode !== "CNY"` 时 Alert **分三态**（loading 态存在前，回退横幅会在请求窗口内先撒谎后翻转——getRates 超时上限 8s，`rates.ts:15`）：
  - `loading === true`：**不渲染横幅**（静默过渡；字段已按符号-only 渲染，横幅闪变比误报更伤）；
  - 落定后 rate 可用：`t("app.currencyNotice")`（**值改写**，含 `{{rate}}` 与 `{{time}}` 占位——「金额已按 1 人民币 = {{rate}} {{code}} 换算展示（汇率时点：{{time}}）；输入以展示币种填写、自动回写为人民币口径；所有公式与币种无关。」）；
  - 落定后 rate null（离线 / 缺币种）：`t("app.currencyFallback")`（新键，§10）——「汇率暂不可用：仅切换货币符号，数值保持人民币口径；可稍后在『税务估算与多币种校验』面板重试获取。」沿用离线快照思路，不阻断使用。

### 3.8 样本断言（测试口径；仓库无前端测试框架，脚本化断言）

新增 `scripts/check-currency.mjs`（零第三方依赖；经 `npx esbuild` 把 `src/services/currency.ts` 转译后在 Node 内 `node:assert` 断言，`package.json` 挂 `"check:currency": "node scripts/check-currency.mjs"`——esbuild 随 vite 在依赖树内，i18n 键集检查已有同流程先例）：

| # | 断言 | 口径 |
| --- | --- | --- |
| 1 | `cnyToDisplay(1_635_200, 0.14)` ≈ 228,928（ε = 1e-6） | ask 指定样本：CNY 1,635,200 → USD ≈ rate×1,635,200（mock rate 0.14；0.14 二进制近似使浮点积 ≈ 228928.00000000003，用 ε 比较，不用严格相等） |
| 2 | `displayToCny(228_928, 0.14)` === 1,635,200 | 逆向精确回写 |
| 3 | `cnyToDisplay(-34_710.24, 0.14)` ≈ −4,859.4336（ε = 1e-9） | 负值（收租净现金流）符号保真。期望值为精确算术值：本会话 `node -e` 实测 −34710.24 × 0.14 = **−4859.4336**（该乘积无浮点误差项；旧版规范写 −4,859.43 + ε 1e-4 时 diff = 0.0036 会使断言自身失败，评审修正） |
| 4 | `pickRate({ USD: 0.14 }, "USD")` === 0.14；`pickRate({}, "USD")` === null；`pickRate({ USD: -1 }, "USD")` === null | 缺币种 / 非法值 → 符号-only 信号 |
| 5 | 对 v ∈ {0, 1, 2990, 1_635_200, 1e9}、rate ∈ {0.14, 20.9}：`|displayToCny(cnyToDisplay(v, r), r) − v| ≤ 1` | 往返漂移 ≤ 1 CNY |

---

## 4. ⑥ 手风琴互斥（与 ⑦ 的关系）

- 研究裁定主方案为**互斥 Collapse（`accordion` 属性）**，非 Tabs——⑥ 与 ⑦ 由**同一个属性**承载，无独立实现体。
- 互斥语义按研究 §6.2 裁定 **A「至多一项展开」**（组件库源码 `onItemClick`：已展开项再点即收起，允许全部收起），非严格「恒有一项」。依据：与现状「默认全部收起」衔接；业界手风琴模式明文支持该实现；非受控一行属性改动面最小。「恒有一项」受控变体已存档于研究 §6.2，本轮不做。
- 「有且仅能开启一项」的用户表述按上述口径解释为「有且仅有**至多一项**」，登记 §14（与研究裁定一致，非偏差）。

## 5. ⑦ 高级区导航重构（按 research-advanced-nav 推荐方案）

### 5.1 形态裁定

**互斥 Collapse + 标题两行文案（短标签主行 + 描述副行）**。ask 提示的「桌面竖排左置 Tabs、移动横滚」以研究结论为准**不采纳**：本仓锁定版本组件库 Tabs 无方向键导航、九页签 = 九个 Tab 停留点（research-advanced-nav §3.1 源码实证），偏离业界选项卡模式两条款，且窄屏须双形态实现；互斥 Collapse 键盘语义零变化（§7.2 比对表）且五维评分 32/35 居首。桌面亦为竖排堆叠（不引入左右分栏——研究 §6.5 存档为未来增强，三条硬门不满足前不做）。

### 5.2 迁移清单（文件级，可直接施工）

| # | 文件 | 改动 | 锚点 |
| --- | --- | --- | --- |
| F1 | `src/components/AdvancedPanel.tsx` | `<Collapse … accordion>`（新增属性）；新增文件内 `PanelHeader({ title, desc })` 组件：`<div className="wf-collapse-head"><div className="wf-collapse-head-title">{title}</div><div className="wf-collapse-head-desc">{desc}</div></div>`；九处 `header={t("advanced.*Header")}` 改为 `header={<PanelHeader title={t("advanced.*Title")} desc={t("advanced.*Desc")} />}`；文件头注释同步互斥语义。**header 内严禁再放可交互元素**（渲染进 role="button" 头节点内部） | :26-54 |
| F2 | `src/i18n/locales/zh-CN.ts` | `advanced.cardTitle` 值改「高级估算与公式原理（同一时间至多展开一项）」；9 个 `*Header` 键移除，新增 9 对 `*Title`/`*Desc` 键（§10 表） | :103-112 |
| F3 | `src/i18n/locales/en.ts` | 同规则（研究 §6.4 三语改写表） | :120-136 |
| F4 | `src/i18n/locales/zh-Hant.ts` | 同规则 | :96-105 |
| F5 | `src/styles/global.css` | 新增三选择器：`.wf-collapse-head`（flex column gap 2px）`.wf-collapse-head-title`（继承字阶）`.wf-collapse-head-desc`（`font-size: var(--wf-text-xs)`、`color: var(--wf-text-secondary)`、基态 `display:none`）+ `@media (min-width: 640px) { .wf-collapse-head-desc { display: block } }`（全仓唯一新增媒体查询，min-width 移动优先书写） | 折叠样式邻域（:391-397 后） |
| F6 | `docs/design-spec.md`（登记） | 互斥语义（至多一项）、副行规范（≤6 汉字 / ≤18 汉字 12px 次要色）、「恒开一项」决策存档、圈号 ①–⑨ 移除裁定 | 新条目 |

**序号移除**：三语标题前圈号 ①–⑨ 全部移除（序号暗示流程顺序，与九面板平级工具语义不符；en 圈号属异形噪声）。备选（不采纳）：`extra` 槽放弱化序号。

### 5.3 键盘与 aria 语义（逐项比对结论，验收抽查用）

头部 `role="button"` + `aria-expanded` + Enter 触发、Tab 序、`lazyload`（首展挂载 / 收起不卸载，表单与已运行结果不丢——R3）、44px 触控档（`global.css:884-889`）、按压反馈（:391-397）、减弱动效清单（:507-535）、内容盒 `overflow: clip` sticky 修正（:980-998，限 <768）——**全部零变化**（类名不随互斥改造变化）。region 地标同开数由 ≤9 收敛到 ≤1，业界「>6 同开不用 region」警告自动消解。`aria-controls` / heading 包装 / region 名称三项为组件库锁定版本存量缺口，不新增不消除（研究 §8.3 上游观察项）。

### 5.4 断点衔接与行为要点

- 五档 375/640/768/1024/1440 零新增断点（唯一新增规则为 640 副行放行）；<640 副行隐藏、≥640 显示；展开不滚屏（浏览器锚定 + 高度过渡现状），验收加查。
- 头部两行化后行高 ≈52-56px（44px 为 min-height 非 max，合规）；快速连点三头无布局跳动；R7：基础模式「核心参数」折叠（`BasicCalculator.tsx:704-745`）**不纳入**互斥范围。
- R2：跨面板称谓文案（zh-CN.ts:156「对应蒙特卡洛面板…」）互斥下无需改。

---

## 6. ① PWA 离线安装（按 research-pwa 采纳清单 A1–A11）

### 6.1 依赖与配置

- `npm i -D vite-plugin-pwa@^2.0.0`（peer `workbox-build` / `workbox-window` 随装；+59MB devDeps，**不进 dist、不影响门禁**；`@vite-pwa/assets-generator` 不装）。运行时唯一新增依赖即此 devDependency——「任何新增依赖评估 gzip 后体积」结论：新增产物（sw.js / manifest / registerSW / 图标）gzip 后合计 ≈13KB，对 gzip 总量 547KB 的影响 ≈+2.4%，结论可接受（§11 账本）。
- **「零新依赖」口径定稿**：口径 = 运行时依赖零新增、devDependency 允许（唯一新增即 vite-plugin-pwa；Canvas 导出零依赖成立——原生 Canvas 2D + toBlob + a.download；check 脚本的 esbuild 已在 vite 依赖树内，本会话 `npx esbuild` 可用；图标走本机无头浏览器截图零 npm 依赖）。该口径施工前经 run owner 显式确认一次，确认记录补录 §14（若取字面绝对口径——package.json 一行不许加——则 B4 批次前提被推翻，须重新裁定）。
- `vite.config.ts` 增（`base` 维持 `"./"` 不变——research-pwa §1.4 沙箱实测相对 base 下四类产物全部正确）：

```ts
import { VitePWA } from "vite-plugin-pwa";
// plugins: [react(), arcoLayoutSiderStub, VitePWA({
  strategies: "injectManifest",
  srcDir: "src",
  filename: "sw.ts",
  registerType: "autoUpdate",
  injectRegister: "script",          // 纯注册脚本，不引 5.7KB workbox-window 运行时
  manifest: { /* §6.2 字段 */ },
  injectManifest: {
    injectionPoint: "self.__WP_MANIFEST",
    globPatterns: ["**/*.{js,css,html,wasm,png,webmanifest}"],  // wasm 必显式，默认 glob 不含
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,             // 防御性放大，消除未来 wasm 增长构建阻断点
  },
// })],
```

### 6.2 manifest 字段（定稿值）

| 字段 | 值 | 说明 |
| --- | --- | --- |
| id | `"/wealth-freedom-planner/"` | 显式安装身份，不受 start_url 形态漂移影响 |
| name | `"财富自由规划工具"` | 与 index.html `<title>` 一致 |
| short_name | `"财自规划"` | 定稿（研究留白的措辞，取 4 字主屏标签友好型） |
| lang | `"zh-CN"` | 清单单语（`*_localized` 实验态不采纳）；三语由应用内 i18next 承载 |
| description | 复用 index.html meta description 文案 | |
| start_url / scope | 插件生成 `"./"` | 实测正确，不手写 |
| display | `"standalone"` | |
| theme_color | `"#4A6FA5"` | 与 `index.html:6`、`--wf-primary` 同值 |
| background_color | `"#F7F8FA"` | 浅色页底（启动闪屏专用语义） |
| orientation / dir | 不配置 | |
| icons | `[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any maskable"},{"src":"icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}]` | 单设计双用途声明（分置两份则图标字节翻倍，超预算，不采纳） |

### 6.3 Service Worker 源 `src/sw.ts`（骨架全文，实测产物 1.0–2KB）

```ts
/// <reference lib="webworker" />
// 手写 SW：autoUpdate 语义（skipWaiting + clients.claim，静默换版不强刷打开中的页面）；
// 不 import 任何 workbox 运行时。预缓存清单由构建期注入 self.__WP_MANIFEST。
interface PrecacheEntryLike { url: string; revision: string | null }
declare const self: ServiceWorkerGlobalScope & { __WP_MANIFEST: PrecacheEntryLike[] };

const PRECACHE = "precache-" + hash8(JSON.stringify(self.__WP_MANIFEST)); // 缓存名内嵌清单指纹
const FX_HOST = "open.er-api.com";
const FX_CACHE = "fx-cache-v1";

// install：cache:"reload" 绕过 HTTP 缓存直取源文件（部署响应 max-age=600）→ 全量回填 → skipWaiting
// activate：清除全部旧指纹缓存 → clients.claim
// fetch 三分：① 导航请求 → 命中预缓存 index.html；② 同源 GET → 预缓存命中否则放行网络；
//   ③ 跨域 → 仅当 https: 且主机精确等值 FX_HOST 走 NetworkFirst（成功回包 clone 写入 FX_CACHE，
//   失败回落缓存命中，再失败放行失败 → 页面层既有 offlineSnapshot 兜底）；其余跨域一律放行不缓存。

// 模块形态强制（勿删）：文件无 import/export 时 TS 按全局脚本处理，上方 declare self 与
// lib.dom 全局 self 冲突并级联报错。本会话实测（仓内 TypeScript 5.9.3 + 等价旗标
// --strict --lib ES2020,DOM,DOM.Iterable --skipLibCheck --isolatedModules）：脚本形态
// TS2451 + 6 处 TS2339/TS2769，exit=2；文件尾加 export {} 转模块形态后 exit=0。
// 另：该形态依赖 tsconfig 的 skipLibCheck:true（lib.webworker 与 lib.dom 共存前提；
// 去掉后同文件 32 处 lib 冲突）——B4 批次勿单独移除该旗标。
export {};
```

安全口径（强约束）：汇率路由协议显式限定 `https:` + 主机**精确等值匹配**单一公网域——本地 / 环回 / 私有 / 保留地址按构造即不可能命中，严于页面侧 `isPublicHttpUrl`（`rates.ts:76-99`）。不使用任何推送类能力（无推送 / 通知 / 后台同步 / 周期同步）。`rates.ts` **零改动**（四层退化链：网络 → SW 汇率缓存 → 页面模块缓存 → 构建快照，研究 §3.3）。

### 6.4 更新 UX 裁定

`autoUpdate` 语义（静默换版、新 SW 只影响后续请求，已加载页面自然运行到下次打开）+ `injectRegister: "script"`。**不采 prompt 弹窗**：需引 5.7KB 运行时 + 三语弹窗 UI，而本应用全部输入已持久化、无表单丢失风险（研究 §4.2）。**因此无「更新提示」文案键与 UI**（ask 的条件分支「若选 prompt」未触发，登记 §14）。不做「新版本可用」提示条；不监听 `beforeinstallprompt` 自绘安装按钮（可选增强，留待后续）。

### 6.5 图标（零新增运行时依赖；产物入 `public/icons/`）

1. 手写 SVG 源随仓维护（约 10 行）：512 视窗满幅 `rect` 填 `#4A6FA5` 圆角 `rx=96` + 白色闪电多边形（研究 §5.1 原文路径，按 0.62 缩放居中，内容最远点 ≈119px 处于 204.8px maskable 安全区半径内）。
2. 三尺寸经同一 viewBox 输出 PNG（192 / 512；主屏图标专用链接复用 192 文件不单出 180）：无头浏览器内核截图通路，命令模板与踩坑记录按研究 §5.2 逐条执行（显式像素尺寸 + `--force-device-scale-factor=1` + `--default-background-color=00000000`，高 DPI 错位坑必读）。
3. 产物：`public/icons/icon-192.png`（≈3,307B）+ `public/icons/icon-512.png`（≈9,757B），写入临时目录生成后移入，勿把临时 HTML / 脚本留在仓内。
4. 产物核验（Node 读 PNG IHDR，零依赖）：

```bash
node -e "const f=require('fs').readFileSync('public/icons/icon-192.png');console.log('icon-192', f.readUInt32BE(16)+'x'+f.readUInt32BE(20))"
```

5. **字节回写义务**：产物字节若偏离研究实测值（3,307 / 9,757）**±30% 以上**（图标设计变更 / 截图通路差异所致），须回写 §11.2 账本并复跑门禁后再继续 B4。
6. **通路降级**：无 msedge / 无头内核环境（换机 / CI）时，任一能输出固定像素 PNG 的途径替代（设计工具手工导出等），产物一律经第 4 步 IHDR 命令核验尺寸后入库；通路变更同样触发第 5 步字节回写。

### 6.6 index.html

交付物源文件零手写：该系统主屏图标不读清单 icons、读专用链接标签，缺失回落页面截图；其 rel 值为该系统机制标识符且含来源品牌词，命中命名门禁禁词表（无豁免子串），故不写入 index.html 源文件，改由 `vite.config.ts` 构建期注入（`transformIndexHtml` 输出 `href="./icons/icon-192.png"`，复用 192 文件不单出 180）——机制标识符仅以代码形式存在于构建配置（design-spec 豁免条款「属性值属实现层必需标识符」）。清单链接与 `registerSW.js` 注入由插件自动完成，零手写。

---

## 7. ② 无障碍专项（按 research-a11y 采纳清单 A1–A10 落地；A11 文档、A12 观察项）

| # | 改动 | 落点（文件级） | 验证 |
| --- | --- | --- | --- |
| A1 | 地标 + 跳过链接：Header 传 `role="banner"`、Content 传 `role="main"` + `id="wf-main"` + `tabIndex={-1}`、Footer 传 `role="contentinfo"`（组件库 Layout 的 rest 直透 section，研究已实证）；**跳过链接置 Layout 首个子元素（Header 之前）**——`<a class="wf-skip-link" href="#wf-main">{t("a11y.skipToContent")}</a>`（研究 A1 原文写「Content 内首个元素前」，跳链必须先于重复块成为首 Tab 停留点方有效，规范细化为根首元素，登记 §14） | `src/App.tsx:217-321`、`global.css`、三份 locale | Tab 首键 skip link 可见且获焦；Enter 后焦点落主内容；读屏地标三件 |
| A2 | NumberField 程序关联三件套：`useId()` 生成 label/hint/error 三 id；标签 `<Text id={labelId}>`；InputNumber 传 `aria-labelledby={labelId}` + `aria-describedby={invalid ? errorId : hintId}`（**仅当错误或提示文本存在时传入**——两者皆空不传，条件展开避免读屏指向空容器）+ `aria-invalid={invalid \|\| undefined}`；提示容器恒渲染并挂对应 id（错误与提示互斥渲染，describedby 指向当前可见者）。可访问名称不含 suffix 单位（labelledby 名称=label 文本，单位由 hint 文案承载，研究 §3.3 原建议取轻，§14 登记） | `src/components/fields.tsx:43-113` | 无障碍树：spinbutton 名称非空、越界时 invalid=true 且描述=错误文本 |
| A3 | 两处开关补可访问名称：「计划要孩子」复用 `basic.planChildren`、「阈值冻结」复用 `mc.thresholdFreeze` 作 aria-label | `BasicCalculator.tsx:643-648`、`MonteCarloPanel.tsx:418-421` | 两 switch 名称非空 |
| A4 | 场景名称输入补 aria-label（新键 `scenario.nameLabel`；占位符保留作视觉提示） | `ScenarioPanel.tsx:170-177`、三份 locale | textbox 名称非空 |
| A5 | 字段提示图标键盘可达：`fields.tsx` 新增导出 `FieldTip({ text })` 组件——`<span className="wf-field-tip" tabIndex={0} aria-label={text}>`（提示文本即可访问名称，读屏直读；不挂 role="button" 以免暗示点击动作）+ Tooltip `trigger={["hover","focus"]}`；替换全部内联用法（`fields.tsx:85` 1 处 + `MonteCarloPanel.tsx:313,329,413,801` 4 处，共 5 处，grep 实测） | `fields.tsx`、`MonteCarloPanel.tsx` | Tab 可聚焦并弹 Tooltip；Esc 收起；1.4.13 三条件 |
| A6 | 折叠头焦点环令牌化：`.arco-collapse-item-header:focus-visible { box-shadow: var(--wf-focus-ring); outline: none; }`（环成立时才去默认 outline；顶栏内无折叠头，不需 -dark 变体） | `global.css`（:391-397 邻域） | Tab 过 2+9 个折叠头环可见，环色对相邻底 ≥3:1（§6.4 实测值） |
| A7 | 六处 Radio.Group 补 name：`loan-method` / `acc-mode` / `mc-return-mode` / `mc-strategy` / `seq-mode` / `seq-direction` | `LoanPanel:117`、`AccumulationPanel:216`、`MonteCarloPanel:317,346,568,577` | 方向键组内循环不越组；同组 input name 一致 |
| A8 | 实时区域：① `global.css` 增 `.wf-sr-only`（clip-path 视觉隐藏口径，与既有收纳档隐藏写法同构）；② 基础输出卡增常驻节点 `<span className="wf-sr-only" aria-live="polite" aria-atomic="true">`，内容绑**落定值**：data 就绪时 `t("a11y.resultAnnouncement", { value: money(data.criticalValue) })`，gaugeVisible 时拼接 `t("a11y.resultAnnouncementAssets", { pct: gaugePctText })`，未就绪内容为空串（换算值随 ⑤ 的 money，展示币种口径）；③ 蒙特卡洛 / 序列完成播报节点（`mc.doneAria` / `seq.doneAria`，绑 result 落定帧）；④ 防噪三规则（只播落定值 / polite + atomic / 节点常驻内容替换）写入代码注释。**不引入 aria-busy**：live 内容仅在落定帧变化，无中间值可播（研究 §4.2） | `global.css`、`BasicCalculator.tsx`、`MonteCarloPanel.tsx`、三份 locale | 连续键入零逐键播报；停手 300ms 后 polite 一次；rAF 完成帧与播报值一致 |
| A9 | 2.4.11 焦点遮挡：`global.css` 增全局 `scroll-margin` 规则（可聚焦元素 `scroll-margin-top: calc(var(--wf-topbar-h) + 12px); scroll-margin-bottom: 72px;`——对应顶栏派生值与底部 dock 高度）；两主题 × 两档视口（375 / 1440）Tab 全页走查，发现整遮处按走查结果补修正 | `global.css` | 走查录屏：任何聚焦控件至少部分可见 |
| A10 | 对比度审计脚本 `scripts/check-a11y-contrast.mjs`：静态档=令牌对按研究 §6.2 公式（相对亮度 + rgba 逐通道合成）两两核查，浅色语义色豁免白名单显式内置；`package.json` 挂 `"check:a11y": "node scripts/check-a11y-contrast.mjs"`；**进验收、不进构建门禁**；浏览器 computed-style 走查口径附脚本注释（研究 §6.3 原文） | `scripts/check-a11y-contrast.mjs`（新增） | 跑两主题令牌组：0 处白名单外违规；14 组研究 §6.4 实测对逐一复现 |
| A11 | 图表替代口径成文：摘要句三要素 + 可见数据表 + 图注；逐路径数据不进替代文本（现状六图已达标，research-a11y §5.2）——写入 design-spec §5.4 | `docs/design-spec.md` | 评审确认 |
| A12 | 观察项（不执行）：Message 3s 自动消失读屏回溯性，登记 design-spec 偏差区 | —— | —— |

**「视觉隐藏读屏数据表」裁定**：ask 要求「图表读屏数据表（视觉隐藏，摘要统计而非全路径）」——研究实证六图中五张**已有可见**数据表（Descriptions / 数值行），可见表对读屏同样可达且不重复播报；唯一无表的「自由刻度进度环」为单值图形，摘要句即全部信息。**不新增视觉隐藏表**，按 A11 登记口径（登记 §14）。

**触控 / 运动遗漏核对**：研究 §7 实证 44px 档与双通道减弱动效无遗漏控件；「Canvas 导出按钮」「PWA 更新提示」在研究时点不存在，本轮分别由 ③ 与 ① 新增——两者的 a11y 义务并入各自章节（③ 按钮 44px 触控档 + aria-label；① 无更新 UI 故无义务）。

---

## 8. ③ 场景对比导出 PNG（零新依赖）

### 8.1 功能与入口

`ScenarioPanel` 对比表区新增「导出图片」按钮（`t("scenario.export")`，`size="small"` + `wf-pressable`，44px 触控档随既有全局规则命中）；**valid 列数为 0 时禁用**。点击 → Canvas 2D 手绘对比表 → `canvas.toBlob("image/png")` → `<a download>` 触发保存 → `Message.success(t("scenario.exportDone"))`；toBlob 为 null / 失败 → `Message.error(t("scenario.exportFailed"))`。文件名 `wealth-scenarios-YYYYMMDD-HHmm.png`（本地时间）。

### 8.2 新增 `src/services/exportScenarios.ts`（契约）

```ts
export interface ExportColumn { name: string; failed: boolean; values: string[] }  // 复用 ScenarioPanel 的 CompareCol 形状
/** 手绘对比表位图（原生 Canvas 2D，无新依赖）：
 *  - 数据：已保存情景经既有解码 + wasm 复算的 values（ScenarioPanel.computeColumn 产物，
 *    字符串已含 ⑤ 换算后的符号与千分位——导出与屏显逐字符一致）；
 *  - 配色：入参 tokens = resolveThemeTokens(theme, colorBlindFriendly) 当前生效令牌——
 *    页底 tokens.bgPage、正文 tokens.textPrimary、次要 tokens.textSecondary、失败列头
 *    tokens.fall、发丝线 tokens.hairlineCard；表头带按主题取实底近似（浅 #FFFFFF /
 *    深 #232324，位图无 backdrop-filter，注释注明实底近似口径）；
 *  - 版式：DPR = min(2, devicePixelRatio || 1) 整图缩放；页边距 24、指标列宽 150、
 *    情景列宽 130（列名超宽省略号截断，measureText 逐列收窄）、行高 36、表头行高 52、
 *    总宽下限 560（不足由页边距均摊补足）、总高 = 52 + 8×36 + 16 + 页脚 56 + 页边距；
 *  - 页脚：发丝线分隔 + 两行——工具名（app.title，加粗）与 t("scenario.exportNote")
 *    （「本地计算 · 不构成投资建议」，次要色）；
 *  - 字体：12/13px system-ui 栈；ctx.scale(dpr, dpr) 后一律按 CSS 像素绘制。 */
export function buildScenarioTableBitmap(params: {
  title: string; metricLabels: string[]; columns: ExportColumn[];
  footerLines: [string, string]; tokens: ThemeTokens; theme: "light" | "dark";
}): HTMLCanvasElement
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): Promise<boolean>
```

### 8.3 约束与登记

- 深浅主题取**当前生效令牌**（含色盲友好档语义色）；三语文案随界面语言；零新依赖；无 wasm 改动。
- 导出为静态快照（不含滚动、不含 sticky 首列效果），面板内注明无需——按钮旁不加说明文字（footerLines 已含免责）。

---

## 9. 文件所有权与施工顺序（单实现者；每批次完成线：`tsc --noEmit` 零错误 + i18n 三份同批改 + 门禁复跑）

| 批次 | 内容 | 落点 |
| --- | --- | --- |
| **B0 卫生** | `check-size.mjs` `walk()` 跳过 `.git`（一行，§11.1）；记录干净基线 1,980,439 | `scripts/check-size.mjs:29-40` |
| **B1 ④ 预设取消** | store `clearPreset` + BasicCalculator 按钮分支 + 2 键 | §2 |
| **B2 ⑤ 币种换算** | `services/currency.ts` + hooks（useDisplayRate / useMoney）+ fields convertRate + 9 组件替换 + format.ts compact 轴 + App 提示改写 + `scripts/check-currency.mjs` + 3 键（1 新 2 改写） | §3 |
| **B3 ⑥⑦ 高级区导航** | AdvancedPanel accordion + PanelHeader + 三语 18/−9 + global.css 副行组 + design-spec 登记 | §4–§5 |
| **B4 ① PWA** | devDep + vite.config + sw.ts + 图标（临时目录生成→public/icons/）+ index.html + 门禁复跑（超线则按 §11.3 特批行） | §6 |
| **B5 ② 无障碍** | A1–A10 文件级改动 + `scripts/check-a11y-contrast.mjs` + design-spec 登记（A11/A12） | §7 |
| **B6 ③ 导出 PNG** | `services/exportScenarios.ts` + ScenarioPanel 按钮 + 4 键 | §8 |
| **B7 收口** | i18n 三份键集全等比对（design-spec §7 流程）→ README 双语增补（PWA / 取消 / 换算 / 导出 / 已知局限汇率占位条目更新）→ `npm run build` + 全部 check → §13 验收走查 | §13 |

同文件多批次落点顺序：`BasicCalculator.tsx` 是 B1（预设分支）与 B2（金额替换）与 B5（A3/A8）共同落点——**B1 → B2 → B5 串行**，不得并行持有；`MonteCarloPanel.tsx` 同理（B2 → B3 无、B5 A3/A7/A8）。

---

## 10. 新增文案键清单（31 键新增 / 9 键移除 / 净 +22；三份语言资源键集全等，{{xxx}} 占位符名三份一致）

> 低于 ask 预估 45–65 的原因：PWA 更新提示键取消（autoUpdate，§6.4）+ 复用既有键（A3 两个开关名、A4 曾考虑的复用方案、导出页脚复用 app.title）。逐键如下（zh-CN 基准；zh-Hant / en 同步翻译）：

| key | 简中文案 | 所属 |
| --- | --- | --- |
| `a11y.skipToContent` | 跳转到主内容 | A1 |
| `a11y.resultAnnouncement` | 参考线已更新：{{value}} | A8 |
| `a11y.resultAnnouncementAssets` | 已有资产约为参考线的 {{pct}}% | A8 |
| `presets.cancelHint` | 再次点击取消该画像，基础参数将回落默认值 | ④ |
| `presets.cancelled` | 已取消「{{name}}」画像，基础参数回落默认值 | ④ |
| `app.currencyFallback` | 汇率暂不可用：仅切换货币符号，数值保持人民币口径；可稍后在「税务估算与多币种校验」面板重试获取。 | ⑤ |
| `advanced.reverseTitle` / `reverseDesc` | 反向估算 ／ 已有资产能支撑每月花多少 | ⑦ |
| `advanced.loanTitle` / `loanDesc` | 贷款计算 ／ 月供、总利息与摊销表 | ⑦ |
| `advanced.rentalTitle` / `rentalDesc` | 买房收租 ／ 年度净现金流与回本年限 | ⑦ |
| `advanced.mcTitle` / `mcDesc` | 蒙特卡洛模拟 ／ 耗尽概率与财富分布 | ⑦ |
| `advanced.taxTitle` / `taxDesc` | 税务估算 ／ 多币种口径校验 | ⑦ |
| `advanced.accumulationTitle` / `accumulationDesc` | 打工模拟 ／ 靠工资攒到目标需要多少年 | ⑦ |
| `advanced.pensionTitle` / `pensionDesc` | 社保养老金 ／ 退休后每月能领多少 | ⑦ |
| `advanced.scenarioTitle` / `scenarioDesc` | 多情景对比 ／ 命名保存参数并排对比 | ⑦ |
| `advanced.insightsTitle` / `insightsDesc` | 公式原理 ／ 480 从哪里来：推导、假设与出处 | ⑦ |
| `mc.doneAria` | 模拟完成：资产耗尽概率 {{prob}}，中位终值 {{median}} | A8 |
| `seq.doneAria` | 序列对照完成：最好 {{best}}，中位 {{median}}，最差 {{worst}} | A8 |
| `scenario.nameLabel` | 情景名称 | A4 |
| `scenario.export` | 导出图片 | ③ |
| `scenario.exportNote` | 本地计算 · 不构成投资建议 | ③ |
| `scenario.exportDone` | 对比图片已导出 | ③ |
| `scenario.exportFailed` | 导出图片失败 | ③ |

**移除（9 键）**：`advanced.reverseHeader` / `loanHeader` / `rentalHeader` / `mcHeader` / `taxHeader` / `accumulationHeader` / `pensionHeader` / `scenarioHeader` / `insightsHeader`。
**值改写（2 键，不新增）**：`advanced.cardTitle` →「高级估算与公式原理（同一时间至多展开一项）」；`app.currencyNotice` → §3.7 改写文案（含 {{rate}} {{time}} {{code}} 占位）。
**不动**：`units.*` 全部保留（yuan 系后缀仅在 CNY 模式使用；`units.wan` 由 compact 轴替换后仅存档）。

---

## 11. 尺寸预算账本（红线显式核算；门禁 = dist 原始字节总和 ≤ 限额，wasm 单项 ≤ 800,000）

### 11.1 B0 门禁测量修复（必做，非调限）

```js
// scripts/check-size.mjs walk() 内：
if (entry.isDirectory()) {
  if (entry.name === ".git") continue; // 部署快照仓内部对象不属交付产物（p4-spec §11.1）
  out.push(...walk(p));
}
```

依据：本会话复现污染（`DIST_TOTAL_KB=2590` exit 1，剔除 `.git` 后 1,980,439 字节）；research-pwa §6.2 同一结论（属测量口径缺陷，**不属于限值调整**）。修复后门禁口径 = 真实交付字节。

### 11.2 基线与增量账本

**基线（本会话实测）**：`npm run build && node scripts/check-size.mjs` → 剔除 dist/.git 后合计 **1,980,439 字节**；限额 2,000,000；**余量 19,561 字节**。ask 前提「约 115KB」不成立（偏差登记 §14；research-pwa §6.4 已先行登记同结论）。

| 增量来源 | 字节（原始） | 依据 |
| --- | --- | --- |
| PWA：sw.js（手写 + 内联清单 ≈13 条目） | ≈2,000 | 研究沙箱实测单价 |
| PWA：registerSW.js | 136 | 研究实测 |
| PWA：manifest.webmanifest | ≈500 | 研究实测 339–383B + id/description |
| PWA：icon-192 + icon-512 | 13,064 | 研究实测 3,307 + 9,757 |
| **PWA 小计** | **≈15,700–15,900** | |
| i18n：31 新 − 9 移除 × 3 语 + t() 调用点 | ≈+3,500 | 本会话 minified 序列化逐键估算（§10 键表代入） |
| TS 代码：导出服务 ≈2.5–3.5k、币种模块 + hook + fields ≈2k、a11y 接线 ≈1.4k、预设取消 ≈0.3k、PanelHeader ≈0.3k | ≈+6,000–7,500 | 按模块行数 minified 估算 |
| CSS：skip link + sr-only + collapse-head + scroll-margin | ≈+500 | |
| **全口径合计** | **≈+25,700–27,400** | |
| ** projected 总量** | **≈2,006,100–2,007,800** | **超出 19,561 余量 ≈6,100–7,800 字节（0.31–0.39%）** |

**结论：不采取对策必然小幅超标。** 裁定如下（两路均显式、可审计）：

### 11.3 裁定：门禁例外特批（首选，沿 p2-spec §10.3 先例格式）

若 B4 / B7 任一次复跑确认 project 超 2,000,000：`scripts/check-size.mjs` 的 `TOTAL_LIMIT_BYTES` 由 `2_000_000` 调整为 **`2_010_000`**（一行 + 注释「P4 特批：全口径账本见 docs/p4-spec.md §11.2；回滚条件：图标调色板量化或 vendor 瘦身落地后回调 2_000_000」）。提交说明附 §11.2 账本全文。红线语义不变——2,010,000 仍是显式硬限，超标即 exit 1；wasm 单项 800,000 不动（当前 364KB，余量充足）。先例：p2 曾特批 2,000,000 → 2,300,000（p2-spec §10.3），P3 后回调至 2,000,000，先例闭环存在。

### 11.4 备选裁剪预案（红线 2,000,000 不可动时，按序执行；每项回写 deviations）

1. **③ 导出 PNG 缓行**（≈−4,000：服务模块 + 4 键；ask 交付项，需 run owner 同意）；
2. **图标调色板量化**（≈−6,000：192/512 转 8bit 调色板 PNG；通路本会话未验证——须先在临时目录验证量化工具可用性与视觉质量，验证不过不得采用）；
3. ~~i18n 懒加载~~（无效：动态 import 不减少 dist 总量，排除）。
   1 + 2 合计 ≈−10KB，可回线内。

### 11.5 gzip 口径结论（ask 要求）

门禁为原始字节；本会话实测当前 dist gzip 合计 547,460 字节。本轮唯一新增依赖 `vite-plugin-pwa` 为 devDependency（不进 dist）；运行时新增产物 gzip 后 ≈13KB（文本产物高压缩比、PNG 近不可压），对加载体积影响 ≈+2.4%。**结论：可接受。**

---

## 12. 中性命名纪律与新增标识符自查

沿 design-spec 文首约定；审计忽略清单已扩展覆盖 manifest / sw 产物文件名（ask 前提，已核对 .gitignore / 审计配置口径）。新增标识符全表（已自查，均为机制特征 / 功能描述命名）：

| 标识符 | 中性依据 |
| --- | --- |
| `clearPreset` / `convertRate` / `cnyToDisplay` / `displayToCny` / `pickRate` / `useDisplayRate` / `useMoney` / `formatCompactAxis` | 行为与语义描述 |
| `src/services/currency.ts` / `src/services/exportScenarios.ts` / `buildScenarioTableBitmap` / `downloadCanvasPng` | 功能描述 |
| `src/sw.ts` / `sw.js` / `manifest.webmanifest` / `registerSW.js` / `precache-*` / `fx-cache-v1` | 既有机制标准名（豁免口径）；FX_HOST 精确域名值属配置常量 |
| `wf-skip-link` / `wf-sr-only` / `wf-collapse-head(-title/-desc)` | 既有 `wf-` 前缀风格延续 |
| `scripts/check-currency.mjs` / `scripts/check-a11y-contrast.mjs` / `check:currency` / `check:a11y` | 既有 scripts 命名风格延续 |
| 文案键 `a11y.*` / `advanced.*Title|Desc` / `mc.doneAria` / `seq.doneAria` / `scenario.export*` / `presets.cancel*` / `app.currencyFallback` | 既有命名空间风格延续 |

禁查项复查：无品牌名、无人名、无机制俗称入码入键；icon SVG 内无文字。

---

## 13. 验收清单（命令级；全部须在本轮实现中执行并留痕）

**通用门禁**

| # | 命令 / 动作 | 通过标准 |
| --- | --- | --- |
| 1 | `npm run build` | `tsc --noEmit` 零错误 + 构建成功 |
| 2 | `npm run check:size`（B0 修复后） | `DIST_TOTAL_KB ≤ 2000`（或 §11.3 特批后 ≤ 2010）且 `WASM_MAX_KB ≤ 800`；dist 内无 `.git` 污染项计入 |
| 3 | `git status --porcelain src/wasm` | 空——零 wasm 改动 |
| 4 | i18n 三份资源 esbuild 转译展平键集比对（design-spec §7 流程） | 三份键集全等：基准键数 = 现有 + 31 − 9 |
| 5 | `npm run check:currency` | §3.8 五组断言全绿 |
| 6 | `npm run check:a11y` | 0 处白名单外违规；研究 §6.4 十四组对逐一复现 |
| 7 | `npx vite preview` 手工走查 | §13 手工组全过 |

**④ 预设点击-取消-回落断言（手工）**：点「单身租房」→ 月开销 4,500 / aria-pressed=true；再点同一按钮 → Message「已取消…」、月开销回 2,990、健康预留回 200,000、Tag 回「自定义」高亮、消费构成行隐藏、`activePresetId === "custom"`（DevTools store 断言）；点画像后手动改回报率 → 点取消 → 回报率保持改后值（画像外字段不动）。

**⑤ 币种换算数值断言（mock 汇率）**：脚本断言（#5）+ 手工——切 USD：默认参数大数字 ≈ `$228,928`（按当时实时 rate × 1,635,200，与 App 提示的 rate 互算一致）；输入卡月开销字段显示换算值、改输入后 store 值为整数 CNY（DevTools 核对）；切回 CNY 数值逐位还原；断网（或接口不可达）时提示 `app.currencyFallback`、数值保持 CNY 口径、符号已换。

**⑥⑦ 互斥 / 导航形态断言（手工 + 键盘）**：点第二头 → 第一头收起（aria-expanded 翻转）；点激活头 → 全部收起（至多一项）；九头 <640 仅主行、≥640 双行；三语标题无圈号；切走切回蒙特卡洛面板输入与已运行结果保留（lazyload）；快速连点三头无滚动漂移；`prefers-reduced-motion` 下切换瞬时；基础模式「核心参数」折叠不受影响。

**键盘 Tab 走查路径（两主题 × 375/1440）**：skip link（首 Tab，Enter 落 `#wf-main`）→ 顶栏 5 控件 → 输出卡敏感性开关 → 预设 4 按钮 → 基础字段（含两个开关有名称）→ 核心参数折叠 → 分享按钮 → 高级区 9 折叠头（焦点环可见）→ 展开面板内字段；聚焦元素无整遮（A9）；提示图标 Tab 可达弹 Tooltip（A5）；六处 Radio 方向键组内循环（A7）。

**SR / aria 断言**：DevTools 无障碍树——spinbutton 名称与 describedby（A2）、两开关名称（A3）、场景名称 textbox（A4）、三地标 banner/main/contentinfo（A1）；连续键入无逐键播报、停手后 polite 一句（A8）；蒙特卡洛完成播报一次（A8）；五图可见数据表存在 + aria 摘要句（A11 现状核对）。

**PWA 断言**：`npm run build` 后——`dist/manifest.webmanifest` 存在且字段合 §6.2（`node -e "console.log(JSON.parse(require('fs').readFileSync('dist/manifest.webmanifest','utf8')))"`：id/name/icons 192+512）；`dist/sw.js` 存在且预缓存清单含 `core.wasm` 与两个 icon 条目（grep）；`dist/registerSW.js` 内容为 `./sw.js` + `scope: './'`；`dist/icons/` 两 PNG 尺寸核验（§6.5 IHDR 命令）；`npx vite preview` + DevTools Application：SW 注册成功、离线重载整页可用、断网下汇率走 SW 缓存或快照链不白屏；SW 源码核对汇率路由白名单：仅 `https:` + 主机精确等值 `open.er-api.com`（其他跨域请求不缓存）；部署后（`bash scripts/deploy.sh`）线上 `curl -sI` manifest **200 且 Content-Type 为 `application/manifest+json`（或至少 `application/json`；若为 octet-stream 再评估）——manifest MIME 是四类产物中唯一未经研究实测的一项，低成本保险**、SW 注册状态复验。

**③ 导出 PNG 断言（手工 + 公式）**：保存 2 情景 → 导出 → PNG 尺寸 = 公式值（宽 = max(560, 24+150+2×130+24)、高 = 52+8×36+16+56+48 ± 页边距实现差，DevTools 读 canvas 尺寸或图片属性）；图内第一行指标值与屏显对比表逐字符一致（含换算符号）；深色主题导出深色版；三语页脚两行齐全；0 情景时按钮禁用。

**对比度探针口径**：`npm run check:a11y`（#6）+ 浏览器档：dev 页控制台执行研究 §6.3 脚本，正文级违规 0 处。

**走查备忘（防验收误报）**：① dev 模式不受 PWA 影响——本方案未配置 devOptions，插件仅 build / preview 生效（`registerSW.js` 不进 dev server）；`npx vite preview`（127.0.0.1）为安全上下文，SW 注册可行；② 导出 PNG 的 `toBlob` 触发链在用户手势内完成（Safari 下载手势约束满足）；③ <640 档折叠头描述副行 `display:none`，折叠头可访问名称随断点变为「仅主行」——与视觉一致，非缺陷，勿误报。

---

## 14. 偏差与未尽事项登记

1. **ask 前提「余量约 115KB」不成立**：本会话实测（命令与输出见 §11.2）干净口径余量 **19,561 字节**；research-pwa §6.4 同结论。全口径账本据此核算并触发 §11.3 特批路径。
2. **⑦ 形态与 ask 提示不同**：ask 提示「大概率 Tabs（桌面左置 / 移动横滚）」；研究实证 Tabs 键盘缺口后裁定互斥 Collapse（ask 明示「具体以研究结论为准」）。
3. **PWA 更新提示 UI 与三语文案不需要**：研究裁定 autoUpdate 静默换版，ask 的「若选 prompt」条件分支未触发；§10 键表因此不含更新提示键。
4. **「视觉隐藏图表读屏数据表」不新增**：六图现状已有可见数据表且读屏可达（research-a11y §5.2），按 A11 登记口径替代（避免双重播报）。
5. **键数 31 增 / 9 删（净 +22）低于 ask 预估 45–65**：更新提示键取消 + 复用既有键（§10 头注）。
6. **互斥语义为「至多一项」**：用户表述「有且仅能开启一项」按研究 §6.2 裁定 A 实现（允许全部收起）；受控恒开变体存档不采纳。
7. **A1 跳过链接落位细化**：研究 A1 写「Content 内首个元素前」，规范改为 Layout 根首元素（Header 之前）——跳链须为首 Tab 停留点方有效，意图一致。
8. **CurrencySection 偏离检测解耦展示币种**：现状仅在 display=CNY 时检测（`CurrencySection.tsx:53` 提前返回）；⑤ 后 CNY 规范值恒在，检测改为始终执行（行为微变：非 CNY 展示下也会出现偏离提示）。
9. **税务面板既有币种简化不扩大**：非中国税档的本币口径歧义为现状简化（README 已登记），⑤ 统一换算不修复不恶化；面板「本币口径」note 保持。
10. **clearPreset 不 bump resetEpoch**：与 applyPreset 同机制；若验收复现 Q3-2 类显示不刷新，备案一行修正（§2.3）。
11. **图标量化 / check 脚本 esbuild 依赖**：量化通路未在本会话验证（§11.4 采用前须验证）；check 脚本经 `npx esbuild` 转译 TS——esbuild 在 vite 依赖树内，非新增依赖，i18n 检查已有同流程先例。
12. **真实读屏 / 真机 PWA 行为未在本会话执行**：§13 各走查属实现批次验证项；本会话已执行的是——三研究 + 现状全量通读、`npm run build && node scripts/check-size.mjs` 实跑（门禁污染复现 + 干净基线）、i18n 增量字节估算、gzip 合计实测；评审修订轮（v1.1）另执行：断言 3 期望值 `node -e` 复测（−4859.4336，确认旧值必挂）、sw.ts 两形态 tsc 实测（仓内 TypeScript，脚本形态 exit 2 / `export {}` 模块形态 exit 0 / 去 skipLibCheck 32 处冲突）、AmountField 与 wf-field-tip 分拆 grep 复核。
13. **换算模式越界错误文案 CNY 限额错位**：`field.errorRange` 的 min/max 插值维持 CNY 域 limit 原值（`fields.tsx:103-107` 现状），换算模式下报错边界与展示币种错位；本轮按现状简化不扩大（§3.6），由换算横幅「自动回写为人民币口径」表述兜底。
14. **A2 可访问名称不含 suffix 单位**：采 `aria-labelledby`（名称 = label 文本），单位由字段 hint 文案承载，与研究 §3.3 的「aria-label 吸收前后缀单位」原建议取轻；`aria-describedby` 仅在错误 / 提示文本存在时传入（条件展开，避免指向空容器节点）。
15. **汇率强刷不跨组件感知（已知限制）**：CurrencySection 强刷（`getRates(true)` 覆写模块级 cached，`rates.ts:186-212`）后，已挂载面板的 `useDisplayRate` 持有旧 resolved 值，换算金额至切币种 / 重挂载前保持旧 rate——旧 rate 仍是有效历史值，非错误；本轮不引入跨组件事件同步（window 事件方案已评估、成本更高），README 已知局限需补一句「汇率刷新后需切换币种或刷新页面以更新全站换算」。
16. **「零新依赖」口径定稿待确认**：口径 = 运行时依赖零新增、devDependency 允许（唯一新增 vite-plugin-pwa，§6.1）；施工前经 run owner 显式确认一次，**确认记录补录本条**。若 run owner 取字面绝对口径（package.json 一行不许加），B4 批次前提被推翻、须重新裁定（纯手写 SW 不经插件亦需构建接线，不可行；或砍 PWA）——两案均超本轮规范授权，届时升级裁决。
17. **Q3-2 备案落实（验收复现触发，§14.10 条件满足）**：用户编辑过的金额字段在 store 驱动外部变更后显示冻结于末次键入值（组件库 InputNumber 受控回写缺陷）。双层落实：① 备案原案——`clearPreset` / `applyPreset` 内 bump `resetEpoch` 一行（重挂载基础五字段）；② 组件层补充——`NumberField` 内记录「我方写入口径」（handleChange 落库前先行同步），effect 仅对非用户写入的 value/convertRate 变更递增 key 重挂 InputNumber，覆盖**币种切回路径**（备案未覆盖，P4 新增 convertRate 命中）与高级面板全部字段。重挂仅发生在键入以外场景（切币种 / 预设 / 分享导入），焦点不在字段内，无输入中断。
18. **金额字段后缀口径修正（验收 T2-5）**：§3.6 原式「`convertRate != null ? undefined : suffix`」的字面行为是 rate 为 null（回退态）时渲染「元」系后缀，与符号前缀 `$` 自相矛盾且与自身理由相悖。修正为「`displayCode === "CNY" ? suffix : undefined`」——后缀仅在 CNY 展示下渲染；非 CNY（换算与回退）一律省略，单位语义由 prefix 符号与 currencyFallback 横幅承载。CNY 模式由此恢复后缀显示（原式下 rate=1 恒非空、后缀恒省略，与 24 处调用点实测一致）。
19. **SW activate 保留上一代预缓存（验收 T2-7）**：换版窗口内进行中的加载（旧 SW 控制期落在旧预缓存 index.html 上的导航）在 activate 清空全部旧 `precache-*` 后对旧 hash 资源 404 → wasm 初始化失败 → 首屏空白（验收环境实测复现）。修正：activate 经换代游标缓存（`sw-cursor-v1`，键为 invalid 顶级域绝对 URL、任何页面请求不可命中）记录上一代名，仅删除「上上代及更早」，上一代保留一个版本周期；导航分支的 index.html 命中相应改为 `cacheName` 限定当前代（否则保留的旧缓存含过期壳、新导航可能命中旧应用）。换取的代价：缓存存储多驻留一代预缓存（约 2MB，一个版本周期后由下一轮 activate 回收）。
