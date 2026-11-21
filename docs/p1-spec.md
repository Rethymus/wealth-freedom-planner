# P1 冲刺实现规范：社保养老金⑦ · 历史自助抽样 · 欲望敏感性 · 场景分享链接 + 设计研究采纳落地

> 状态：**待施工**（本文档为可直接施工的实现规范，代码块均可复制粘贴；契约类代码块为逐字规格）。
> 读者：核心方（Rust/WASM 与 service）、界面方（组件/store/数据层/样式）、同步方（i18n/README）。
> 现状依据：本文所有「现状」引用均以本仓库当前代码为准（`src/wasm/bridge.ts`、`src/wasm/src/**`、`src/services/finance.ts`、`src/components/**`、`src/store/useCalculatorStore.ts`、`src/data/defaults.ts`、`src/styles/global.css`、`docs/design-research.md`、`README.md` / `README.en.md`）。P0 三件套（预设场景 / 自由刻度 / 打工模拟）已实现并入库，本文在此基础上增量。
> 全局约定（沿用 P0，不重复展开）：WASM 导出统一 `(input: string) => string` JSON 进 JSON 出；金额单位元、百分比单位百分点（税率/指数类除外，随契约注明小数形式）；`error` 空串成功、非空中文错误；Rust 侧任何路径不得 panic；输出金额统一两位小数、概率 6 位小数；文案键三份语言资源同步（`src/i18n/locales/zh-CN.ts` 为基准）。

---

## 0. 总览

| # | 特性 | 涉及层 | 核心新产物 |
| --- | --- | --- | --- |
| ① | 社保养老金面板⑦（中国口径，大胆简化 + 诚实标注） | 三方协作 | `src/data/pensionParams.ts`（新）+ Rust 导出 `estimate_pension` + 契约类型 + service + `PensionPanel.tsx`（新文件） |
| ② | 蒙特卡洛历史自助抽样 | 三方协作 | `src/data/indexSeries.ts`（新）+ Rust 导出 `run_monte_carlo_bootstrap` + 契约类型 + service + `MonteCarloPanel.tsx` 增量 |
| ③ | 欲望敏感性（月开销敏感性小节） | 仅界面方 | `BasicCalculator.tsx` 增量（复用 `calcBaseline` 逐档调用，不新增依赖） |
| ④ | 场景分享链接 | 仅界面方 | `src/services/share.ts`（新，纯函数）+ store 增量 + `App.tsx` 增量 + 复制按钮 |
| ⑤ | 设计研究采纳项落地（A1–A5 + 维持项） | 仅界面方 | `src/data/defaults.ts` / `src/styles/global.css` / `src/services/format.ts` / `docs/design-spec.md` 回填 |

依赖关系：⑤ 独立于①–④，可立即开工；③④ 不依赖核心方，可立即开工；①② 的 UI 依赖核心方第 1 步**全部**合入（`bridge.ts` 契约类型 **且** `finance.ts` 的 `calcPension` / `calcMonteCarloBootstrap` 导出）后才可施工，详见 §1.2。

数据查证记录（本会话实际执行，非转引）：

| 数据 | 查证方式 | 结果 |
| --- | --- | --- |
| 标普500 年度总回报 2005–2025 | 抓取 Slickcharts「S&P 500 Total Returns by Year」页（2026-11-18 读取，2026 年为年内 YTD 不录入） | 全表逐值录入 `indexSeries.ts`（含股息再投资口径） |
| 沪深300 年度涨跌幅 2005–2024 | 经行情历史数据接口拉取 zs_000300 全部日线，按年末收盘价**独立复算**年度涨跌幅（2026-11-18 拉取）；与公开整理帖（雪球 2025-03-22）逐值交叉一致 | 20 个年度全部吻合（价格指数口径，不含股息）；2005 年以官方基日 2004-12-31 = 1000 点推得（923.45 ÷ 1000 − 1 = −7.66%） |
| 2024 年城镇单位就业人员年平均工资 | 央视网搜索多稿转引国家统计局发布（2025-05-16）：非私营 124,110 元、私营 69,476 元 | 录入 `pensionParams.ts` 锚点（124,110 ÷ 12 ≈ 10,342.5 → 取整 10,343 元/月，注释注明精确值） |
| 个人账户养老金计发月数 60 岁 = 139 | 央视网 2015-03-08 引现行计发标准原文「个人账户养老金月标准为个人账户储存额除以计发月数，如退休年龄为 60 岁，计发月数为 139 个月」；2012-06-15 稿印证 40 岁 = 233 | 60 岁档已独立印证；50 岁 195 / 55 岁 170 为通行表值（本会话未取得法规原文，标注待复核） |
| 基础养老金公式文本 | 通行制度口径（国发〔2005〕38号），本会话以人社部公开解读类报道交叉印证机制；法规原文链接未直接取得 | 公式按通行口径整理，`pensionParams.ts` 注明「原文链接待数据研究员补录」 |
| 渐进式延迟法定退休年龄 | 通行报道口径（2024-09 决定、2025-01-01 施行；男职工逐步延至 63 岁），本会话未逐字核对文件 | 仅作面板备注文案（`pension.retireAgeDelayNote`），不参与计算 |

---

## 1. 文件所有权分界与施工顺序

### 1.1 文件所有权分界

| 方 | 文件（本次允许写入的范围） | 说明 |
| --- | --- | --- |
| **核心方** | `src/wasm/bridge.ts`、`src/wasm/src/lib.rs`、`src/wasm/src/pension.rs`（新）、`src/wasm/src/bootstrap.rs`（新）、`src/wasm/tests/integration.rs`、`src/wasm/pkg/**`（wasm-pack 产物再生成）、`src/services/finance.ts` | **`bridge.ts` 的契约类型是核心方的第一次写入**（§3.2、§4.2），其余各方以其为准 |
| **界面方** | `src/data/pensionParams.ts`（新）、`src/data/indexSeries.ts`（新）、`src/data/defaults.ts`（追加 `PENSION_DEFAULTS` / `LIMITS.contribIndex`、A1 改值）、`src/data/types.ts`（`InputLimits` 增 `contribIndex`）、`src/store/**`、`src/components/**`、`src/services/share.ts`（新）、`src/services/format.ts`（A2/A3）、`src/styles/global.css`（A4 + 新类）、`docs/design-spec.md`（A1/A5 回填） | 与 P0 同惯例：defaults.ts（store 默认值唯一落点）、global.css（组件样式集中地）划入界面方 |
| **同步方** | `src/i18n/locales/zh-CN.ts`（基准）、`zh-Hant.ts`（逐词字形转换）、`en.ts`（翻译）、`README.md`、`README.en.md`、`docs/assets/`（新增演示素材） | 键结构三份一致；插值占位符名三份一致；数据层口径注释不入 i18n |

### 1.2 施工顺序

```
第 1 步（核心方，先行——契约冻结后其余各方才可开工）：
  1a. bridge.ts 追加 §3.2 estimate_pension 契约与 §4.2 run_monte_carlo_bootstrap 契约
      （FinanceWasmModule 两行 + 两段类型/语义注释；此后契约冻结）
  1b. 新建 pension.rs（§3.3）、bootstrap.rs（§4.3）；lib.rs 挂载（§3.2/§4.2 Rust 签名）
  1c. tests/integration.rs 追加 §7 测试清单（第 11/12 节）；cargo test 全绿（含既有回归原样通过）
  1d. wasm-pack build src/wasm --target web --out-dir pkg --release（产物入库）
  1e. finance.ts 追加 calcPension / calcMonteCarloBootstrap（§3.4、§4.4）

第 2 步（界面方，与第 1 步并行，不碰 bridge 契约）：
  2a. 设计研究采纳项落地（§2：A1 改值前先回填 docs/design-spec.md，再改 defaults.ts/global.css；
      A4 追加 CSS；A2/A3 改 format.ts）
  2b. 新建 src/data/indexSeries.ts（§4.1）、src/data/pensionParams.ts（§3.1）
  2c. src/services/share.ts（§6.1，纯函数，可先行 + node 往返自检）

第 3 步（界面方，等第 1 步**全部**合入后开工——3b 依赖 1e 的 calcPension、3c 依赖 1e 的
      calcMonteCarloBootstrap；仅合入 1a 契约类型时 tsc --noEmit 即因 service 无导出而失败）：
  3a. defaults.ts 追加 PENSION_DEFAULTS / LIMITS.contribIndex；types.ts 增 contribIndex；
      store 追加 pensionInputs / pensionMonthsSynced / monteCarloReturnMode / monteCarloSeriesId /
      applyShareState（§3.5、§4.5、§6.2）
  3b. 新建 src/components/advanced/PensionPanel.tsx（§3.6）；AdvancedPanel.tsx 追加⑦号子面板
  3c. MonteCarloPanel.tsx 增量：收益模式 Radio + 序列 Select（§4.6）
  3d. BasicCalculator.tsx 增量：月开销敏感性小节（§5.1）+ 复制分享链接按钮（§6.3）
  3e. App.tsx 增量：加载时解析分享 hash（§6.2）；global.css 追加新类（§10）

第 4 步（同步方，3b/3c/3d 的键清单确定后）：
  4a. 三份语言资源按 §8 键清单同步（64 键）
  4b. README 双语增补（§9）；录制并提交演示素材（4 组 ×2 语言）
```

**合并编排约定**：第 1–4 步在同一集成分支按序合入，**主分支仅接受第 4 步（4a 键清单落库）之后的特性合并**。第 2/3 步的界面改动引用 §8 新键（2a 的 `currency.noTimestamp`、3b–3d 的 `pension.* / mc.* 增量 / sensitivity.* / share.*`），若先于 4a 独立合入主分支，相关界面将渲染键名本身（i18next missing key 行为）；三份 locale 文件的所有权在同步方（§1.1），界面方不得在先行 PR 里零散补键。

### 1.3 中性命名纪律（审计门禁强制）

- 新增 CSS 类一律 `wf-` 前缀：`wf-mc-mode`、`wf-sens-toggle`、`wf-sens-block`、`wf-sens-group`、`wf-sens-rows`、`wf-sens-row`、`wf-sens-note`、`wf-share-row`（§10 给出样式增量；无新增 CSS 变量）。
- 标识符中性：新类型/函数/字段名只用描述性英文（`pension`、`bootstrap`、`sensitivity`、`share`、`indexSeries`），不得引入任何外部品牌词、机制俗称或项目外专有名词；文案键空间为 `pension.* / mc.*（增量）/ sensitivity.* / share.* / currency.noTimestamp / advanced.pensionHeader`。指数标识 `csi300 / sp500` 为数据层中性代码（与既有 `countryCode` 同性质），界面显示名走 i18n。
- 自查命令（合入前各方可自行执行，均应零命中新增违规）：
  `grep -rn "wf-" src/styles/global.css | grep -v -- "--wf"`（列类名，逐个目检前缀）、
  `grep -rniE "俗称词表（由审计门禁维护）" src/ docs/p1-spec.md`（按门禁词表全文检索确认零命中；本规范新增标识符 `pension / bootstrap / sensitivity / share / coverageRatio / monthsDivisor / contribIndex` 等均为中性描述词）。

---

## 2. 设计研究采纳项落地（差距 A1–A5，由界面方执行）

> 依据 `docs/design-research.md` §2.2 差距清单与 §2.3 采纳清单。每条采纳项落成具体文件级改动如下；「维持项」不需改动，仅在此登记防止误改。

### 2.1 A1 + A5：浅色次级文字对比度达标（先回填规范，再改值）

`#86909C` 在浅色下对白底实测 3.24:1（`docs/design-research.md` §2.1 复算值），承载 12px 正文级文本不达 4.5:1。采纳改值为 `#646E7A`（白 5.18 / 卡合成 5.10 / 实时区着色底 4.66，全场景 ≥4.5；同冷灰蓝色相）。

施工顺序（浅色值在 v2 规范属冻结范围，按语义色豁免的同一先例「显式登记改值」，不得静默变更）：

1. **先回填 `docs/design-spec.md`**（界面方）：
   - §2.2（色彩令牌）：`textSecondary` 浅色值改为 `#646E7A`，注明改值日期与依据（design-research A1）；
   - §2.10（`:root` 静态默认值全量清单）：`--wf-text-secondary: #646E7A;` 同步；
   - §5.3（对比度）：次级文字行登记「改值前 3.24:1（不达标）→ 改值后白 5.18:1 / 卡合成 5.10:1 / 着色底 4.66:1（达标）」，口径为「常态合成底 + 最不利透底」双口径；深色值 `#A9AEB8`（7.05:1）不动。**登记时注明着色底对比度的合成基**：载值 4.66:1 的合成基为「着色层叠纯白」（`rgba(74,111,165,0.08)` 叠 `#FFFFFF`）；按最不利口径「着色层叠卡合成底」（卡材质 0.72 白叠 `#f7f8fa`）复算 ≈ 4.6:1——两种口径均 ≥ 4.5，消除第三种复算歧义。
2. **再改代码**（旧值 `#86909C` 在仓库恰有 **3 处**字面量，全部同批改值；两处初始值一致防首帧闪变）：
   - `src/data/defaults.ts:170`：`textSecondary: "#86909C"` → `textSecondary: "#646E7A"`，行尾注释改为 `// 次级文字（浅色 5.18:1；改值依据 design-research A1，登记于 design-spec 5.3）`；
   - `src/styles/global.css:46`：`--wf-text-secondary: #86909C;` → `--wf-text-secondary: #646E7A;`（注释同步）；
   - `src/styles/global.css:627`：`.wf-field-tip` 的 fallback `color: var(--wf-text-secondary, #86909c);` → `color: var(--wf-text-secondary, #646e7a);`（运行期 App.tsx 注入令牌后 fallback 不生效，视觉无影响，但属「初始值一致」纪律的第三处副本，必须同批改值——大小写不同的旧值极易被大小写敏感检索漏掉）。
3. 深色组（`defaults.ts` THEME_DARK 的 `textSecondary: "#A9AEB8"` 与 `global.css:274`）**不动**。

验收：`grep -rni "86909c" src/ index.html`（**大小写不敏感**，本规范撰写时实测命中恰 3 处：`defaults.ts:170`、`global.css:46`、`global.css:627`）改值后**零命中**；浅色值全场景 ≥4.5:1（数值口径见上）。

### 2.2 A2：数字/时间格式化跟随 UI 语言（`src/services/format.ts`）

现状：`format.ts:15` `Intl.NumberFormat("zh-CN")`、`format.ts:30` 同、`format.ts:65` `toLocaleString("zh-CN")` 硬编码——英文界面出现中文习惯格式。

改动（调用点零改动；直接读 `i18next.language`，不经过 `../i18n` 模块避免成环）：

```ts
import i18next from "i18next";

/** UI 语言 → Intl locale（zh 双语种共用 zh-CN 数字习惯；en → en；未知回落 zh-CN） */
function uiLocale(): string {
  return i18next.language === "en" ? "en" : "zh-CN";
}
```

- `formatNumber`：`new Intl.NumberFormat("zh-CN", …)` → `new Intl.NumberFormat(uiLocale(), …)`；
- `formatMoneyFixed`：同上替换；
- `formatTimestamp`：`toLocaleString("zh-CN", { hour12: false })` → `toLocaleString(uiLocale(), { hour12: false })`。

验收：切 English 后摊销表金额、实时区数值、汇率时间戳格式跟随 en locale；切回简中不变。

### 2.3 A3：空值兜底文案走 i18n（`format.ts:62` + `CurrencySection.tsx`）

- `format.ts` 的 `formatTimestamp` 签名改为 `formatTimestamp(iso: string, emptyText: string): string`（去掉内置中文兜底；`emptyText` 由调用点传入 `t()` 文案）；
- 唯一调用点 `src/components/advanced/CurrencySection.tsx:140` 改传 `t("currency.noTimestamp")`；
- 新增键 `currency.noTimestamp`（简中「数据不可用」，三份语言资源同步——见 §8）。

### 2.4 A4：表格数值列挂等宽数字（`src/styles/global.css`）

```css
.wf-amortize-table,
.wf-realtime {
  font-variant-numeric: tabular-nums;
}
```

（对不支持该特性的字体无害；`slashed-zero` 等叠加特性按 design-research N10 不采纳。）

### 2.5 维持项（登记，不改动）

以下各项经 `docs/design-research.md` §2.3/§2.4 审计确认合规，本次**不改**：深色层级三组材质值；动效三档时长 + 三族曲线；触控目标 44px + 命中区扩展；图表蓝/橙色盲安全对与线型冗余编码；空态/加载态既有模式；对比度双口径验收表继续作为唯一口径。新面板（⑦/敏感性/分享按钮）取色一律经 `resolveThemeTokens` 解析值，动效只复用既有令牌与既有模式（Collapse 过渡 / 按压反馈），不新增动效族。

---

## 3. ① 社保养老金面板⑦

### 3.0 口径声明（规范级决策，施工时不得偏离）

- **落 wasm**（导出 `estimate_pension`）：基础养老金/个人账户/调整后参考线全部是金额精确运算（无随机抽样），按项目「金额计算在核心」原则走 `rust_decimal` 精确链路；与 `calculate_baseline` 的乘数舍入口径一致性由 §7 一致性测试锁定。纯 TS 方案否决理由：折减链路涉及乘数两位小数舍入与 clamp 顺序，两处实现必然漂移。
- **两层简化公式**（国发〔2005〕38号通行口径的极简版）：
  - 基础养老金 ≈（社平工资 + 社平工资 × 缴费基数指数）÷ 2 × 缴费年限 × 1%；
  - 个人账户养老金 = 个人账户余额估计 ÷ 计发月数；
  - 预计月养老金 = 基础 + 个人账户。
- **大胆简化（诚实标注，面板内固定免责文案）**：社平工资与缴费指数不做逐年增长假设（按用户填入值直接代入）；账户余额按当前估计值直接除以计发月数（不做未来增值假设）；不考虑过渡性养老金、视同缴费年限折算、省级计发基数差异与每年待遇上调；面板固定展示「简化估算，不构成社保咨询」。
- **调整后参考线**：`调整后月开销 = max(0, 月开销 − 预计月养老金)`；`调整后参考线 = 调整后月开销 × 乘数 + 育儿 + 健康 + 重大投入`（乘数与 `calculate_baseline` 同口径：`round2(12 ÷ 实际回报率小数)`，先舍入后相乘）。语义：月开销中被养老金覆盖的部分不再需要本金支撑，临界值相应下降。
- 输入 `PensionInput extends BaselineInput`：调整后参考线直接复用**基础参数卡当前值**（单一事实来源），面板不复制基础字段；面板自身只提供 7 个养老金专属字段。

### 3.1 数据层：`src/data/pensionParams.ts`（新文件，逐字可粘贴）

```ts
/**
 * 社保养老金参数数据层（中国城镇职工基本养老保险口径，简化估算）。
 * 数值口径与来源以注释为准；查证记录见 docs/p1-spec.md §0。
 * 界面文案在 i18n pension.* 键空间；本文件注释为数据口径（不入 i18n）。
 */

/** 计发月数对照表（键 = 退休年龄整数，值 = 月数）。
 * 国发〔2005〕38号附表口径：60 岁 139 / 55 岁 170 / 50 岁 195。
 * 查证状态：60 岁 139 经人社部公开解读报道独立印证（2015-03-08/2012-06-15 稿）；
 * 50/55 岁为通行表值，待数据研究员对照法规原文复核。仅收录面板可选的三档。 */
export const PENSION_MONTHS_TABLE: Record<number, number> = {
  50: 195,
  55: 170,
  60: 139,
};

/** 计发口径社会平均工资锚点（元/月）。
 * 来源：国家统计局 2025-05-16 发布「2024 年全国城镇非私营单位就业人员年平均工资
 * 124,110 元」（名义增长 2.8%）；124,110 ÷ 12 = 10,342.5 → 取整 10,343。
 * 私营单位口径为 69,476 元/年（约 5,790 元/月），显著更低——用户应按所在省市
 * 养老金计发基数自行修改。2026-11-18 查证。 */
export const PENSION_AVG_WAGE_ANCHOR_CNY = 10343;

/** 数据口径说明（简中，页面上以只读提示展示） */
export const PENSION_WAGE_SOURCE_NOTE =
  "国家统计局：2024 年全国城镇非私营单位就业人员年平均工资 124,110 元（2025-05-16 发布）；" +
  "各省市养老金计发基数不同，请按当地人社部门公布值修改。基础养老金公式为通行制度口径" +
  "（法规原文链接待补录）；简化估算，不构成社保咨询。";

/** 社保养老金面板输入（业务切片，分享链接可携带；乘数与附加预留取自基础参数卡当前值） */
export interface PensionInputs {
  /** 当前年龄（16–70，整数） */
  currentAge: number;
  /** 预期退休年龄（40–75，整数；计发月数默认按对照表联动） */
  retireAge: number;
  /** 预期截至退休的累计缴费年限（0–50，整数；含已缴，不含视同缴费折算） */
  contribYears: number;
  /** 平均缴费基数指数（小数形式：0.6 ≈ 按社平工资 60% 缴费，1.0 = 恰好等于社平） */
  contribIndex: number;
  /** 个人账户余额估计（元；可在电子社保卡/当地社保 App 查询） */
  accountBalance: number;
  /** 计发口径社会平均工资（元/月；默认取 PENSION_AVG_WAGE_ANCHOR_CNY） */
  avgMonthlyWage: number;
  /** 计发月数（默认按 PENSION_MONTHS_TABLE 随退休年龄联动，手动修改即解除） */
  monthsDivisor: number;
}
```

### 3.2 契约：`bridge.ts` 增量（核心方第一次写入，逐字可粘贴）

`FinanceWasmModule` 接口（`bridge.ts:32-42`）内追加两行：

```ts
  run_monte_carlo_bootstrap: WasmFn;
  estimate_pension: WasmFn;
```

文件末尾追加以下完整段落：

```ts
// ---------------------------------------------------------------------------
// h. run_monte_carlo_bootstrap —— 蒙特卡洛历史自助抽样
// ---------------------------------------------------------------------------

/** 历史自助抽样蒙特卡洛输入：字段与 MonteCarloInput 完全一致 + 收益序列 */
export type MonteCarloBootstrapInput = MonteCarloInput & {
  /**
   * 历史年度回报序列（百分点，如 14.68 表示 +14.68%；小数形式由核心侧 /100）。
   * 每年从该序列中**有放回均匀重抽** 1 个元素作为当年名义回报样本（i.i.d.，
   * 忽略年份顺序与序列相关性）；至少 1 个元素，每个元素为有限数值且
   * > −100 且 |元素| ≤ 1000（百分点）。
   * nominalReturnMeanPct / nominalReturnStdPct 在本模式下**仅校验、不参与计算**
   * （分布由序列决定）；通胀仍按其均值/标准差的正态分布抽样。
   */
  series: number[];
};

// 输出结构与 MonteCarloOutput 完全一致（复用该类型，无新输出类型）。

// run_monte_carlo_bootstrap 语义（Rust 侧实现遵循）：
// - 随机数 StdRng::seed_from_u64(seed)；抽样顺序固定：路径外层、年份内层，
//   每年先抽「序列元素索引」（均匀有放回）、再抽通胀正态样本；
//   耗尽 break 语义与 run_monte_carlo 相同（任一年末资产 ≤ 0 即终止该路径）；
//   同 seed 同输入 → 输出逐字节一致（§7 测试锁定）。
// - 回报样本 = 所抽元素 ÷ 100，随后沿用既有防御：< −0.99 钳为 −0.99；
// - 通胀样本与递推、耗尽判定、统计（depletionProb 6 位小数、期末分位 type-7
//   两位小数、samplePaths 50 条索引公式）与 run_monte_carlo 完全一致；
// - σ ≤ 0 / years ≤ 0 / 序列为空 / 序列元素越界 → error；
// - 错误安全形状与 run_monte_carlo 相同（数值 0、samplePaths 空数组）。

// ---------------------------------------------------------------------------
// i. estimate_pension —— 社保养老金估算（简化两层公式）
// ---------------------------------------------------------------------------

/** 社保养老金估算输入：BaselineInput 全字段 + 养老金专属字段 */
export interface PensionInput extends BaselineInput {
  /** 当前年龄（16–70，整数） */
  currentAge: number;
  /** 预期退休年龄（40–75，整数，须大于当前年龄） */
  retireAge: number;
  /** 预期截至退休的累计缴费年限（0–50，整数） */
  contribYears: number;
  /** 平均缴费基数指数（小数形式，[0, 10]；1.0 = 按社平工资 100% 缴费） */
  contribIndex: number;
  /** 个人账户余额估计（元） */
  accountBalance: number;
  /** 计发口径社会平均工资（元/月） */
  avgMonthlyWage: number;
  /** 计发月数（1–600，整数） */
  monthsDivisor: number;
}

/** 社保养老金估算输出（全部金额两位小数） */
export interface PensionOutput {
  /** 距退休年限 = retireAge − currentAge（整数） */
  yearsToRetire: number;
  /** 基础养老金（元/月）=（社平工资 + 社平工资 × 缴费基数指数）÷ 2 × 缴费年限 × 1% */
  basicPensionMonthly: number;
  /** 个人账户养老金（元/月）= 个人账户余额估计 ÷ 计发月数 */
  accountPensionMonthly: number;
  /** 预计月养老金（元/月）= 基础 + 个人账户 */
  pensionMonthly: number;
  /** 养老金覆盖率 = pensionMonthly ÷ monthlyExpense（两位小数，可 > 1 不封顶；月开销 0 时为 0） */
  coverageRatio: number;
  /** 调整后月开销（元/月）= max(0, monthlyExpense − pensionMonthly) */
  adjustedMonthlyExpense: number;
  /**
   * 调整后财富自由参考线（元）= adjustedMonthlyExpense × multiplier
   *   + childCount × costPerChild + healthReserve + majorInvestment
   * （乘数与 calculate_baseline 同口径：先 round2 再相乘；实际回报率 ≤ 0 时为 0）
   */
  adjustedCriticalValue: number;
  /** 480 法则乘数（与 calculate_baseline 同口径两位小数回显，便于前端复算） */
  multiplier: number;
  /** "" 表示成功；实际回报率 ≤ 0 时为非空中文错误，此时金额/乘数类字段全部为 0 */
  error: string;
}

// estimate_pension 语义（Rust 侧实现遵循）：
// - 校验顺序固定（见 §3.3）；任一校验失败 → error + 全字段安全值 0；
// - 实际回报率 = nominalReturnPct − inflationPct；≤ 0 → error
//   「通胀率需低于名义回报率」（与 calculate_baseline 同文案同分支形状：
//   multiplier = 0、adjustedCriticalValue = 0、其余金额 0）；
// - multiplier = round2(12 ÷ (实际回报率/100))（checked_div 防御，同 baseline）；
// - basic = round2(((社平 + 社平×指数) ÷ 2) × 缴费年限 ÷ 100)；
// - account = round2(账户余额 ÷ 计发月数)；
// - pensionMonthly = round2(basic + account)；
// - coverageRatio = round2(pensionMonthly ÷ monthlyExpense)，月开销为 0 时 = 0；
// - adjustedMonthlyExpense = round2(max(0, monthlyExpense − pensionMonthly))；
// - adjustedCriticalValue = round2(adjustedMonthlyExpense × multiplier
//     + childCount × costPerChild + healthReserve + majorInvestment)——
//   恒等式 adjustedCriticalValue == calculate_baseline(同附加项,
//   monthlyExpense = adjustedMonthlyExpense).criticalValue 由测试锁定；
// - 本函数为纯金额精确运算（无随机抽样），全程 rust_decimal。
```

Rust 签名（`lib.rs`；`pub mod pension;` 与 `pub mod bootstrap;` 加入模块声明区 `lib.rs:24-31`）：

```rust
/// 蒙特卡洛历史自助抽样：JSON（MonteCarloBootstrapInput）→ JSON（MonteCarloOutput）
#[wasm_bindgen]
pub fn run_monte_carlo_bootstrap(input: &str) -> String {
    run_safe(|| bootstrap::handle(input), bootstrap::error_output)
}

/// 社保养老金估算：JSON（PensionInput）→ JSON（PensionOutput）
#[wasm_bindgen]
pub fn estimate_pension(input: &str) -> String {
    run_safe(|| pension::handle(input), pension::error_output)
}
```

### 3.3 Rust 口径：`src/wasm/src/pension.rs`（新模块）

- **模块头注释**照抄 accumulation.rs 惯例：契约指向、公式口径（§3.0 逐字）、精度声明（纯 Decimal 精确运算、输出金额统一 round2）。
- **输入/输出 struct**：`#[derive(Deserialize)] #[serde(rename_all = "camelCase")] pub struct PensionInput`，全部数值字段（含 7 个养老金字段与 BaselineInput 的 7 个字段）均为 `Decimal` + `#[serde(with = "rust_decimal::serde::arbitrary_precision")]`（字段名即 §3.2 的 14 个 camelCase 键）；`#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct PensionOutput`——`years_to_retire: u32` 为普通字段，其余 7 个数值字段为 `Decimal` + arbitrary_precision，末尾 `error: String`。
- `pub fn handle(input: &str) -> String` 与 `pub fn error_output(msg: &str) -> String` 模式同 `baseline.rs:62-82`。**错误安全形状**：`years_to_retire: 0`、其余数值字段全部 `Decimal::ZERO`、`error` 为消息。
- **校验顺序固定**（实现顺序即校验顺序，错误信息可读中文）：
  1. `check_nonneg_money("月开销", …)`；
  2. 子女数量非负整数（消息与 baseline 逐字一致：「子女数量须为非负整数」）；
  3. `check_nonneg_money("每孩抚养成本")` / `check_nonneg_money("健康预留")` / `check_nonneg_money("重大投入")`；
  4. `check_pct_signed("名义回报率")` / `check_pct_signed("通胀率")`；
  5. `to_u32_int("当前年龄", v, 16, 70)`；
  6. `to_u32_int("退休年龄", v, 40, 75)`；
  7. `ensure(retire_age > current_age, "退休年龄须大于当前年龄")`；
  8. `to_u32_int("停止工作年龄", v, 16, 75)`（P7/P0-1 插入项，`targetRetireAge` 缺省 = None 时不触发、取 retire_age）；
  9. `to_u32_int("缴费年限", v, 0, 50)`；
  10. `ensure(contrib_index >= 0 && contrib_index <= 10, "缴费基数指数须在 [0, 10]（小数形式，1.0 = 按社平工资 100% 缴费）")`；
  11. `check_nonneg_money("个人账户余额估计")`；
  12. `check_nonneg_money("计发口径社会平均工资")`；
  13. `to_u32_int("计发月数", v, 1, 600)`。
- **计算**（校验全过后，全部 checked 运算 + `ok_or` 中文溢出消息，模式同 `baseline.rs:110-128`）：

```rust
// 实际回报率与乘数：与 calculate_baseline 逐字同口径（先 round2 再参与后续乘法）
let real = inp.nominal_return_pct - inp.inflation_pct;
if real <= Decimal::ZERO { /* error 分支：形状见 bridge.ts 注释 */ }
let multiplier = round2(
    Decimal::from(12).checked_div(pct_to_frac(real))
        .ok_or("实际回报率过小，无法计算 480 法则乘数")?,
);
// 基础养老金 =（社平 + 社平×指数）÷ 2 × 年限 ÷ 100
let indexed = inp.avg_monthly_wage.checked_mul(inp.contrib_index)
    .ok_or("数值溢出：请检查社会平均工资与缴费基数指数规模")?;
let basic = round2(
    inp.avg_monthly_wage.checked_add(indexed)
        .ok_or("数值溢出")?
        .checked_div(Decimal::from(2)).ok_or("数值溢出")?
        .checked_mul(Decimal::from(contrib_years)).ok_or("数值溢出")?
        .checked_div(Decimal::from(100)).ok_or("数值溢出")?,
);
// 个人账户养老金 = 余额 ÷ 计发月数；预计月养老金 = 基础 + 个人账户
let account = round2(inp.account_balance.checked_div(Decimal::from(months_divisor))
    .ok_or("计发月数异常")?);
let pension_monthly = round2(basic.checked_add(account).ok_or("数值溢出")?);
// 覆盖率（月开销 0 → 0；不封顶）；调整后月开销（下限钳 0）
let coverage = if inp.monthly_expense > Decimal::ZERO {
    round2(pension_monthly.checked_div(inp.monthly_expense).ok_or("数值溢出")?)
} else { Decimal::ZERO };
let adjusted_expense = if inp.monthly_expense > pension_monthly {
    round2(inp.monthly_expense.checked_sub(pension_monthly).ok_or("数值溢出")?)
} else { Decimal::ZERO };
// 调整后参考线：与 calculate_baseline 逐字同构（舍入后乘数 × 调整后月开销 + 附加项）
let base = adjusted_expense.checked_mul(multiplier).ok_or("数值溢出：请检查月开销与乘数规模")?;
let children = inp.child_count.checked_mul(inp.cost_per_child)
    .ok_or("数值溢出：请检查子女抚养成本规模")?;
let adjusted_critical = round2(base.checked_add(children)
    .ok_or("数值溢出")?.checked_add(inp.health_reserve)
    .ok_or("数值溢出")?.checked_add(inp.major_investment).ok_or("数值溢出")?);
```

- 测试锚点（§7）撰写时已以 Node.js 按上述公式验算（非手算），见 §7 表。

### 3.4 service：`src/services/finance.ts` 增量（逐字可粘贴）

import 区：模块导入追加 `estimate_pension as wasmEstimatePension`；类型导入追加 `PensionInput`、`PensionOutput`。文件末尾追加：

```ts
function parsePension(obj: Record<string, unknown>): FinanceResult<PensionOutput> {
  const err = businessError(obj);
  const data: PensionOutput = {
    yearsToRetire: num(obj, "yearsToRetire", "estimate_pension"),
    basicPensionMonthly: num(obj, "basicPensionMonthly", "estimate_pension"),
    accountPensionMonthly: num(obj, "accountPensionMonthly", "estimate_pension"),
    pensionMonthly: num(obj, "pensionMonthly", "estimate_pension"),
    coverageRatio: num(obj, "coverageRatio", "estimate_pension"),
    adjustedMonthlyExpense: num(obj, "adjustedMonthlyExpense", "estimate_pension"),
    adjustedCriticalValue: num(obj, "adjustedCriticalValue", "estimate_pension"),
    multiplier: num(obj, "multiplier", "estimate_pension"),
    error: err ?? "",
  };
  if (err) return { ok: false, error: err, notReady: false };
  return { ok: true, data };
}

/** 社保养老金估算（契约 estimate_pension） */
export function calcPension(input: PensionInput): Promise<FinanceResult<PensionOutput>> {
  return invoke("estimate_pension", wasmEstimatePension, input, parsePension);
}
```

### 3.5 store 与 defaults 增量

`src/data/defaults.ts` 追加（`PensionInputs` / `PENSION_MONTHS_TABLE` / `PENSION_AVG_WAGE_ANCHOR_CNY` 从 `./pensionParams` 导入）：

```ts
/** 社保养老金面板默认输入（计发月数默认按退休年龄联动对照表，手动修改即解除联动，
 * 见 store pensionMonthsSynced；avgMonthlyWage 默认 = 数据层全国口径锚点） */
export const PENSION_DEFAULTS: PensionInputs = {
  currentAge: 30,
  retireAge: 60,
  contribYears: 30,
  contribIndex: 0.6, // 多数省份缴费基数下限口径（≈ 按社平 60% 缴费）
  accountBalance: 50000,
  avgMonthlyWage: PENSION_AVG_WAGE_ANCHOR_CNY,
  monthsDivisor: PENSION_MONTHS_TABLE[60],
};
```

`src/data/types.ts` 的 `InputLimits` 接口与 `LIMITS` 追加：

```ts
  /** 缴费基数指数（小数形式，0–10） */
  contribIndex: NumberInputLimit;
```

```ts
  /** 缴费基数指数（小数：0.6 ≈ 社平 60% 口径） */
  contribIndex: { min: 0, max: 10, step: 0.05, precision: 2 },
```

`useCalculatorStore.ts` 追加切片：

```ts
  /** 社保养老金面板输入 */
  pensionInputs: PensionInputs;
  setPensionInputs: (patch: Partial<PensionInputs>) => void;
  /** 计发月数是否与退休年龄联动对照表（手动修改即置 false） */
  pensionMonthsSynced: boolean;
  setPensionMonthsSynced: (v: boolean) => void;
```

```ts
  pensionInputs: { ...PENSION_DEFAULTS },
  pensionMonthsSynced: true,

  setPensionInputs: (patch) =>
    set((state) => ({ pensionInputs: { ...state.pensionInputs, ...patch } })),
  setPensionMonthsSynced: (v) => set({ pensionMonthsSynced: v }),
```

`resetAll` 同步追加 `pensionInputs: { ...PENSION_DEFAULTS }`、`pensionMonthsSynced: true`。

### 3.6 UI：`PensionPanel.tsx`（新文件）与 AdvancedPanel 挂载

#### 3.6.1 面板结构（自动联动模式，同 LoanPanel/ReversePanel：无运行按钮）

- store 接线：`pensionInputs` / `setPensionInputs` / `pensionMonthsSynced` / `setPensionMonthsSynced` / `baselineInputs` / `currency.display` / `theme` / `colorBlindFriendly`（`themeTokens = resolveThemeTokens(theme, colorBlindFriendly)`，覆盖率满额行取色用）。
- **计发月数联动**（模式同 `AccumulationPanel.tsx:74-82` 的 epoch 重挂载方案）：

```tsx
const effectiveMonths = effectiveMonthsDivisor(
  pensionInputs.monthsDivisor,
  pensionInputs.retireAge,
  pensionMonthsSynced,
);
```

  （`effectiveMonthsDivisor` 为 pensionParams.ts 数据层唯一口径函数：联动中按退休年龄查对照表、对照表未收录或已解除联动时用手填值；面板显示 / wasm 提交 / 分享链接编码三处共用，禁止各处内联重推——分享编码若直取 store 原始值，发送方看到的联动表值与链接携带值不一致，验收 Q3-3 修正项。）

  计发月数字段 `key={`months-sync-${monthsSyncEpoch}`}`、`value={effectiveMonths}`；`onChange={(v) => { setPensionInputs({ monthsDivisor: v }); setPensionMonthsSynced(false); }}`；`hint`：联动中显示 `t("pension.monthsSyncedHint")`。同步恢复按钮（Text 样式 `Button size="small" className="wf-pressable"`，置于字段区之后）：点击 `setMonthsSyncEpoch((c) => c + 1); setPensionMonthsSynced(true);`，文案 `t("pension.monthsResync")`。

- **组合调用**（调整后参考线跟随基础参数卡当前值，单一事实来源；**计发月数必须传当刻联动值 `effectiveMonths`，不得直传 store 旧值**——先例即 `AccumulationPanel.tsx:101-102` 的「运行时取当刻联动目标值提交（不回写 store）」：`calcAccumulation({ ...inputs, targetValue: effectiveTarget })`）：

```tsx
const { loading, result } = useFinanceCall(
  () => calcPension({ ...baseline, ...pensionInputs, monthsDivisor: effectiveMonths }),
  [baseline, pensionInputs, effectiveMonths],
  { debounceMs: 300 },
);
```

  若漏传 `monthsDivisor: effectiveMonths`：联动状态下改退休年龄（如 60 → 55，store 仍存 139）或点「恢复联动」按钮后，输入框按重挂载回填显示表值 170，而 wasm 实际按 store 旧值 139 计算个人账户养老金——结果区「计发月数 170 个月」与 `accountPensionMonthly` 的真实除数不一致（展示与计算口径漂移）。`effectiveMonths` 必须纳入依赖数组，使联动值变化即触发重算。
- **字段清单**（FieldRow，md 断点两列；除注明外标签/tooltip 全用 `pension.*` 新键）：

| 字段 | 组件 | 值 / 限额 | 键 |
| --- | --- | --- | --- |
| 当前年龄 | IntField | `currentAge`，min 16 / max 70 | `pension.currentAge(+Tooltip)` |
| 退休年龄 | IntField | `retireAge`，min 40 / max 75，hint `pension.retireAgeDelayNote` | `pension.retireAge(+Tooltip)` |
| 缴费年限（截至退休） | IntField | `contribYears`，min 0 / max 50 | `pension.contribYears(+Tooltip)` |
| 缴费基数指数 | NumberField | `contribIndex`，limit=`LIMITS.contribIndex` | `pension.contribIndex(+Tooltip)` |
| 个人账户余额估计 | AmountField | `accountBalance`，LIMITS.amount | `pension.accountBalance(+Tooltip)` |
| 计发口径社会平均工资 | AmountField | `avgMonthlyWage`，LIMITS.amount | `pension.avgWage(+Tooltip)` |
| 计发月数 | IntField | effectiveMonths，min 1 / max 600 | `pension.monthsDivisor(+Tooltip)` |

- **说明行**（字段区之前，`Text type="secondary"`）：`t("pension.formulaNote")`（两层公式 + 简化口径）。
- **来源行**（字段区之后，`Text type="secondary" className="wf-panel-note"`）：`t("pension.wageSourceLine", { source: PENSION_WAGE_SOURCE_NOTE })`（数据口径，简中原样；English / 繁體界面下呈现「本地化模板 + 简中来源」混排——数据口径不入 i18n 为仓库既有纪律（`zh-CN.ts:1-9` 头注释），属已声明取舍，同步方与验收知情即可）。
- **运行区**：无按钮；`loading` 时输出卡头部显示 `Spin size={14}`（模式同 `BasicCalculator.tsx:171`）。
- **结果区**（`result.ok` 时渲染；`!ok` 时 `Alert type="error"`）：
  1. **养老金 Descriptions**（`border size="small" column={{ xs: 1, md: 2 }}`，窄屏 `layout="vertical"` 经 `useIsNarrowViewport`）：`pension.monthlyPension`（值 `formatMoney(data.pensionMonthly, symbol)`，`Text bold`）、`pension.basicPart`、`pension.accountPart`、`pension.yearsToRetire`（值 `` `${data.yearsToRetire} ${t("units.yearUnit")}` ``）、`pension.monthsUsed`（值 `` `${effectiveMonths} ${t("pension.monthsUnit")}` ``）。
  2. **调整后参考线 Descriptions**（title `t("pension.adjustedTitle")`）：`pension.adjustedExpense`（`formatMoney(data.adjustedMonthlyExpense, symbol)`）、`pension.adjustedCritical`（`Text bold` 大金额）、`pension.coverage`（coverageRatio 是倍率不是百分点，值渲染为 `` `${formatNumber(data.coverageRatio * 100, 1)}%` ``）。
  3. **覆盖率满额行**：`data.coverageRatio >= 1` 时追加一行 `Text`（`style={{ color: themeTokens.rise }}`）：`t("pension.coverageFull")`；其下固定 `Text type="secondary"` 显示 `t("pension.coverageHint")`。
  4. **口径注**（`Text type="secondary" className="wf-panel-note"`）：`t("pension.resultNote")`。
- **免责文案（固定，不参与折叠）**：面板底部 `Text type="secondary" className="wf-panel-note"` 渲染 `t("pension.disclaimer")`——「简化估算，不构成社保咨询」句式为该键的一部分，面板任何状态下恒渲染（含结果未就绪时）。
- **结果区附加行**：面板结果不重复展示基础参考线（基础卡已有）；调整后参考线与基础卡临界值的差值语义由 `pension.coverageHint` 承载。

#### 3.6.2 面板头注释（文件顶部）

```tsx
/**
 * ⑦ 社保养老金：简化两层公式（基础养老金 + 个人账户）估算退休后月养老金，
 * 并给出「调整后参考线」——月开销中被养老金覆盖的部分不再需要本金支撑。
 * 口径（契约 estimate_pension，见 src/wasm/bridge.ts）：输入复用基础参数卡当前值
 * 组合调用；社平工资与缴费指数不做增长假设；账户余额不做未来增值假设。
 * 简化估算，不构成社保咨询（面板内固定免责文案）。
 * 文案经 react-i18next 三语化。
 */
```

#### 3.6.3 AdvancedPanel 挂载（`AdvancedPanel.tsx`）

- import：`import PensionPanel from "./advanced/PensionPanel";`
- 文件头注释计数同步：`AdvancedPanel.tsx:2` 的「高级估算面板：6 个子面板」改为「高级估算面板：7 个子面板」。
- `<Collapse>` 内追加在 accumulation 项之后（⑥ 编号稳定，新面板为⑦）：

```tsx
<CollapseItem name="pension" header={t("advanced.pensionHeader")}>
  <PensionPanel />
</CollapseItem>
```

### 3.7 ① 验收清单

- [ ] 面板⑦默认收起，标题「⑦ 社保养老金 —— …」；展开后 7 个字段按默认值渲染，随输入防抖 300ms 自动出结果（无运行按钮）。
- [ ] 默认输入（30 岁 / 60 岁退休 / 30 年 / 指数 0.6 / 余额 5 万 / 社平 10,343 / 139 个月 + 基础卡默认值）出结果：预计月养老金 2,842.03、基础 2,482.32、个人账户 359.71、覆盖率 95%、调整后月开销 147.97、调整后参考线 271,025.60（与 §7 锚点 A 一致）。
- [ ] 改退休年龄 55 → 计发月数自动变 170（联动 hint 显示）；**结果区「计发月数 170 个月」与个人账户养老金一致**：默认余额 50,000 ÷ 170 = 294.12（若实现误把 store 旧值 139 传给 wasm，则显示 359.71——此断言专门捕获「展示与计算口径漂移」）；手动改计发月数 → hint 消失；点恢复按钮 → 联动恢复且输入框回填表值，个人账户养老金同步按表值重算。
- [ ] 名义回报率 ≤ 通胀（如 2.0 / 4.5）→ 面板显示与基础卡同文案的错误 Alert，金额区不显示假数。
- [ ] 覆盖率 > 100%（如指数 1.0 / 40 年 / 余额 20 万 / 月开销 2,000 → 279%）时显示「已覆盖全部月开销」涨色行。
- [ ] 免责文案「简化估算，不构成社保咨询」恒渲染。
- [ ] 面板内金额全部随币种切换换符号（数值不换算，与全站口径一致）。

---

## 4. ② 蒙特卡洛历史自助抽样

### 4.0 口径声明

- 新导出 `run_monte_carlo_bootstrap`：**仅改变收益样本来源**——名义回报不再从正态分布抽样，改为每年从 `series` 中**有放回均匀重抽** 1 个元素（i.i.d.，忽略年份顺序与序列相关性——诚实标注：真实市场存在波动聚集与自相关，自助抽样不覆盖，见 README 局限增补）。
- 通胀机制、递推公式、耗尽判定、统计口径、`samplePaths` 50 条索引公式与输出结构**与 `run_monte_carlo` 完全一致**（契约复用 `MonteCarloOutput`）。
- `nominalReturnMeanPct / nominalReturnStdPct` 在该模式下**仅校验、不参与计算**（契约形状与「其余同现有蒙特卡洛」一致；UI 隐藏这两个字段并注明，见 §4.6）。
- `series` 单位为百分点（与 MC 其余输入同单位）；核心侧 ÷100 后沿用既有 `< −0.99 钳 −0.99` 防御。

### 4.1 数据层：`src/data/indexSeries.ts`（新文件，逐字可粘贴）

数值全部经 §0 查证记录的方式核实后录入，不得改动；扩展新指数时须先查证并补来源。

```ts
/**
 * 指数年度收益序列数据层（蒙特卡洛历史自助抽样的抽样源）。
 * 数值口径与来源以注释为准（数据口径不入 i18n，界面显示名走 i18n mc.index* 键）；
 * 查证记录见 docs/p1-spec.md §0。2026 年为不完整年度，一律不录入。
 */

/** 指数标识（中性代码；界面显示名经 i18n mc.indexCsi300 / mc.indexSp500） */
export type IndexId = "csi300" | "sp500";

/** 蒙特卡洛收益模式（业务口径选择，随分享链接携带） */
export type MonteCarloReturnMode = "normal" | "bootstrap";

/** 指数年度收益序列 */
export interface IndexSeries {
  id: IndexId;
  /** 序列首个年度（annualReturnsPct[0] 对应该年度） */
  firstYear: number;
  /** 年度收益序列（百分点，如 14.68 表示 +14.68%），按年份升序 */
  annualReturnsPct: number[];
  /** 数据来源说明（简中，页面上以只读提示展示） */
  source: string;
  /** 收益口径说明（简中；「价格指数」不含股息、「总回报」含股息再投资） */
  kind: "price" | "total";
  /** 口径备注（简中） */
  note: string;
}

export const INDEX_SERIES: Record<IndexId, IndexSeries> = {
  csi300: {
    id: "csi300",
    firstYear: 2005,
    // 沪深300（000300）年度价格涨跌幅：经行情历史接口按年末收盘价独立复算
    // （2026-11-18 拉取，与公开整理逐值一致）。价格指数口径，不含股息（约 2%/年），
    // 作为抽样源会略低估总回报——见 note。
    annualReturnsPct: [
      -7.66, // 2005（基日 2004-12-31 = 1000 点，年末收盘 923.45 推得）
      121.02, 161.55, -65.95, 96.71, -12.51, -25.01, 7.55, -7.65, 51.66,
      5.58, -11.28, 21.78, -25.31, 36.07, 27.21, -5.20, -21.63, -11.38, 14.68,
    ],
    source: "沪深300（000300）年末收盘价复算（行情历史数据接口，2026-11-18 拉取）",
    kind: "price",
    note: "价格指数口径（不含股息，约 2%/年），抽样结果略低估总回报；20 个年度样本（2005–2024）。",
  },
  sp500: {
    id: "sp500",
    firstYear: 2005,
    // 标普500 年度总回报（含股息再投资）：Slickcharts「S&P 500 Total Returns by
    // Year」全表（2026-11-18 读取）。
    annualReturnsPct: [
      4.91, 15.79, 5.49, -37.00, 26.46, 15.06, 2.11, 16.00, 32.39, 13.69,
      1.38, 11.96, 21.83, -4.38, 31.49, 18.40, 28.71, -18.11, 26.29, 25.02,
      17.88, // 2025
    ],
    source: "标普500 年度总回报表（Slickcharts，2026-11-18 读取）",
    kind: "total",
    note: "总回报口径（含股息再投资）；21 个年度样本（2005–2025）。",
  },
};

/** 下拉展示顺序（与 Record 键序解耦，保证 UI 稳定） */
export const INDEX_ORDER: IndexId[] = ["csi300", "sp500"];
```

### 4.2 契约要点

见 §3.2 中 `h. run_monte_carlo_bootstrap` 段落（逐字规格已给出）：输入 `MonteCarloBootstrapInput`（`MonteCarloInput & { series: number[] }`），输出复用 `MonteCarloOutput`。

`Vec<Decimal>` 解析可行性已实证：本规范撰写时在临时 crate（rust_decimal 1.43 / serde_json arbitrary_precision 同版本）验证——plain `series: Vec<Decimal>` 字段按字面量精确解析（`14.68 → "14.68"`）、非法元素报错；rust_decimal 的 `DecimalVisitor::visit_map`（serde.rs:372）承接 serde_json arbitrary_precision 的数字字面量路径，与既有 per-field `#[serde(with = …)]` 走同一入口。

### 4.3 Rust 口径：`src/wasm/src/bootstrap.rs`（新模块）

- **模块结构**与 `montecarlo.rs` 同构（与 P0 accumulation.rs 同先例：常量 `MAX_YEARS` / `MAX_PATHS` / `SAMPLE_COUNT` 同值、模块内私有、刻意不跨模块共享）：
  - `#[derive(Deserialize)] #[serde(rename_all = "camelCase")] pub struct BootstrapInput`——9 个字段与 `montecarlo.rs:49-79` 逐字段同法（Decimal + arbitrary_precision），另加 `series: Vec<Decimal>`（**plain 字段，不加 serde-with**，解析路径已实证）；
  - `#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct BootstrapOutput`——字段与 `MonteCarloOutput` 逐一同名同型（私有字段重复定义，不改既有模块）；
  - `pub fn handle` / `pub fn error_output` 同 montecarlo.rs:102-125（错误安全形状一致：数值 0、`sample_paths: Vec::new()`）。
- **校验顺序固定**：
  1. `check_nonneg_money("当前资产", …)` / `check_nonneg_money("年支出", …)`；
  2. `ensure(!inp.series.is_empty(), "收益序列须为至少 1 个元素的数值数组")`；
  3. 序列逐元素：`check_pct_signed("收益序列元素", v)`（|v| ≤ 1000 百分点）+ `ensure(v > Decimal::from(-100), "收益序列元素须大于 -100（百分点，回报率不得低于 -100%）")`；
  4. 均值/标准差四字段照 montecarlo.rs:132-144 同序校验（σ > 0 + check_pct_signed）——**仅校验不参与计算**；
  5. `to_u32_int("模拟年数", …, 1, MAX_YEARS)` / `to_u32_int("模拟路径数", …, 1, MAX_PATHS)` / `to_u64_int("随机种子", …)`。
- **序列预转换**（一次性）：`let series_f: Vec<f64> = inp.series.iter().map(|d| d.to_f64().unwrap_or(0.0) / 100.0).collect();`
- **随机流与抽样顺序**（契约核心，逐字实现）：

```rust
use rand::seq::SliceRandom;

let mut rng = StdRng::seed_from_u64(seed);
// … 路径外层、年份内层：
// 每年先抽「序列元素」（有放回均匀重抽，单次消耗随机流），再抽通胀正态样本
let mut r = series_f.choose(&mut rng).copied().unwrap_or(0.0);
if r < -0.99 {
    r = -0.99; // 防御：回报率样本 < −99% 无物理意义（与 montecarlo.rs:186-189 同口径）
}
let mut infl = nid.sample(&mut rng);
if infl < -0.99 {
    infl = -0.99;
}
```

- **递推与统计**：与 `montecarlo.rs:195-253` 逐行同口径（`spend *= 1 + infl; assets = assets * (1 + r) - spend;` 耗尽判定、钳制、`round6_f64` / `quantile_f64` + `round2_f64`、`sample_idx` 50 条索引公式）。分布构造仅保留通胀 `nid`（回报正态 `nd` 不构造——均值/标准差不参与计算）。

### 4.4 service：`src/services/finance.ts` 增量（逐字可粘贴）

现有 `parseMonteCarlo`（`finance.ts:213-226`）改为带 `fnLabel` 参数（既有调用行为不变）：

```ts
function parseMonteCarlo(
  obj: Record<string, unknown>,
  fnLabel: string = "run_monte_carlo",
): FinanceResult<MonteCarloOutput> {
  return {
    ok: true,
    data: {
      depletionProb: num(obj, "depletionProb", fnLabel),
      medianTerminal: num(obj, "medianTerminal", fnLabel),
      p5: num(obj, "p5", fnLabel),
      p25: num(obj, "p25", fnLabel),
      p75: num(obj, "p75", fnLabel),
      p95: num(obj, "p95", fnLabel),
      samplePaths: numMatrix(obj, "samplePaths", fnLabel),
    },
  };
}
```

import 区：模块导入追加 `run_monte_carlo_bootstrap as wasmRunMonteCarloBootstrap`；类型导入追加 `MonteCarloBootstrapInput`。文件末尾追加：

```ts
/** 蒙特卡洛历史自助抽样（契约 run_monte_carlo_bootstrap） */
export function calcMonteCarloBootstrap(
  input: MonteCarloBootstrapInput,
): Promise<FinanceResult<MonteCarloOutput>> {
  return invoke("run_monte_carlo_bootstrap", wasmRunMonteCarloBootstrap, input, (o) =>
    parseMonteCarlo(o, "run_monte_carlo_bootstrap"),
  );
}
```

### 4.5 store 与 defaults 增量

```ts
  /** 蒙特卡洛收益模式（正态参数 / 历史自助抽样；业务口径，随分享链接携带） */
  monteCarloReturnMode: MonteCarloReturnMode;
  setMonteCarloReturnMode: (v: MonteCarloReturnMode) => void;
  /** 自助抽样收益序列选择 */
  monteCarloSeriesId: IndexId;
  setMonteCarloSeriesId: (v: IndexId) => void;
```

```ts
  monteCarloReturnMode: "normal",
  monteCarloSeriesId: "csi300",

  setMonteCarloReturnMode: (v) => set({ monteCarloReturnMode: v }),
  setMonteCarloSeriesId: (v) => set({ monteCarloSeriesId: v }),
```

`resetAll` 同步追加 `monteCarloReturnMode: "normal"`、`monteCarloSeriesId: "csi300"`（`MONTE_CARLO_DEFAULTS` 不变——正态参数仍是默认模式）。

### 4.6 UI：`MonteCarloPanel.tsx` 增量

- import 增：`Radio`、`Select`、`Tooltip`（arco）与 `IconQuestionCircle`（`@arco-design/web-react/icon`）；`INDEX_SERIES`、`INDEX_ORDER`、`MonteCarloReturnMode`、`IndexId`（`../../data/indexSeries`）；`calcMonteCarloBootstrap`（service）。
- **静态映射**（禁用模板串拼键，同 `BasicCalculator.tsx:29` 惯例）：

```tsx
/** 指数 id → i18n 显示名键（禁用模板串拼键） */
const INDEX_NAME_KEY: Record<IndexId, string> = {
  csi300: "mc.indexCsi300",
  sp500: "mc.indexSp500",
};
/** 序列口径说明键 */
const INDEX_KIND_KEY: Record<IndexId, string> = {
  csi300: "mc.seriesPriceOnly",
  sp500: "mc.seriesTotalReturn",
};
```

- **收益模式行**（`FieldRow` 之前，`div.wf-mc-mode`）：

```tsx
<div className="wf-mc-mode">
  <Text>{t("mc.returnMode")}</Text>
  <Tooltip content={t("mc.returnModeTooltip")}>
    <span className="wf-field-tip">
      <IconQuestionCircle />
    </span>
  </Tooltip>
  <Radio.Group
    value={returnMode}
    onChange={(v) => setReturnMode(v as MonteCarloReturnMode)}
    options={[
      { label: t("mc.modeNormal"), value: "normal" },
      { label: t("mc.modeBootstrap"), value: "bootstrap" },
    ]}
  />
  {returnMode === "bootstrap" ? (
    <>
      <Text>{t("mc.seriesLabel")}</Text>
      <Tooltip content={t("mc.seriesTooltip")}>
        <span className="wf-field-tip">
          <IconQuestionCircle />
        </span>
      </Tooltip>
      <Select
        size="small"
        value={seriesId}
        options={INDEX_ORDER.map((id) => ({ label: t(INDEX_NAME_KEY[id]), value: id }))}
        onChange={(v: IndexId) => setSeriesId(v)}
        style={{ width: 190 }}
      />
    </>
  ) : null}
</div>
```

  （触控目标由 §2.5 维持项的既有触屏媒体查询承担，不额外包命中区扩展层。）
- **模式说明行**（模式行下方，`Text type="secondary"`）：bootstrap 模式渲染 `t("mc.bootstrapModeNote")`；正态模式不渲染。
- **字段显隐**：`returnMode === "bootstrap"` 时不渲染「名义回报率均值 / 名义回报率标准差」两个 `PercentField`（通胀均值/标准差保留——bootstrap 模式下通胀仍按正态抽样）。
- **序列口径注**（bootstrap 模式，`Text type="secondary" className="wf-panel-note"`；`source` 为数据层简中原文，English 界面下「本地化模板 + 简中来源」混排——与养老金来源行同属已声明取舍）：

```tsx
{returnMode === "bootstrap"
  ? t("mc.seriesNote", {
      name: t(INDEX_NAME_KEY[seriesId]),
      firstYear: INDEX_SERIES[seriesId].firstYear,
      lastYear: INDEX_SERIES[seriesId].firstYear + INDEX_SERIES[seriesId].annualReturnsPct.length - 1,
      count: INDEX_SERIES[seriesId].annualReturnsPct.length,
      kind: t(INDEX_KIND_KEY[seriesId]),
      source: INDEX_SERIES[seriesId].source,
    })
  : null}
```

- **run() 分支**：

```tsx
const run = () => {
  setRunning(true);
  const call =
    returnMode === "bootstrap"
      ? calcMonteCarloBootstrap({
          ...inputs,
          series: INDEX_SERIES[seriesId].annualReturnsPct,
        })
      : calcMonteCarlo(inputs);
  call
    .then((r) => setResult(r))
    /* …catch/finally 与现状逐字一致（MonteCarloPanel.tsx:77-86）… */
};
```

- **图表与统计口径复用**：`chartData` / Descriptions / `Progress` / 折线图全部不变；仅空态与图下注释按模式切换——空态 `returnMode === "bootstrap" ? t("mc.placeholderBootstrap") : t("mc.placeholder")`；图下注释 bootstrap 模式用 `t("mc.chartNoteBootstrap", { count: chartPathCount })`。
- **tooltip**：模式行与序列行的 `Tooltip` 图标（`wf-field-tip` 款式，同 `fields.tsx:83-89`）分别挂 `t("mc.returnModeTooltip")` / `t("mc.seriesTooltip")`（已含于上示片段）。

### 4.7 ② 验收清单

- [ ] 默认（正态参数）模式与现状完全一致：均值/标准差四字段在位，运行结果、图表、注释无变化。
- [ ] 切「历史自助抽样」→ 均值/标准差两字段消失、序列下拉出现、模式说明与序列口径注（来源 + 年份区间 + 样本数 + 价格/总回报口径）出现。
- [ ] 沪深300（价格口径 20 样本）与标普500（总回报 21 样本）可切换；同一 seed 下两序列运行结果不同。
- [ ] 同 seed 同序列同输入 → 结果逐位复现；改 seed 变化、回填复原（与正态模式同契约）。
- [ ] 图表与统计表（耗尽概率 / 分位数 / 50 条路径）与正态模式同款式样。
- [ ] 序列数据与 `src/data/indexSeries.ts` 注释来源逐值一致（抽查：沪深300 2008 = −65.95、标普500 2008 = −37.00）。

---

## 5. ③ 欲望敏感性（月开销敏感性小节）

### 5.0 口径

- 基础输出卡可展开「月开销敏感性」小节：**±10% / ±20% / ±30%** 三档月开销对应的财富自由参考线，**复用 `calculate_baseline` 逐档调用**（每档一次独立 wasm 调用，不在前端用乘数自行推算——金额计算在核心）。
- 展开时才计算（折叠态零开销）；展开状态下基础输入变化时防抖 300ms 重算。
- 任一档「实际回报率 ≤ 0」（与主输出同因）→ 小节整体显示不可用提示。

### 5.1 UI：`BasicCalculator.tsx` 增量（输出卡内、`wf-output-breakdown` 之后）

```tsx
/** 月开销敏感性档位（百分比振幅，正 = 调高月开销；展示顺序 +30 → −30） */
const SENS_STEPS = [30, 20, 10, -10, -20, -30] as const;

interface SensitivityRow {
  pct: number;
  /** 该档临界值（元；档位计算失败为 null） */
  critical: number | null;
}

/** 输出卡内局部组件：月开销敏感性（docs/p1-spec.md §5；文案经组件内 useTranslation） */
function SensitivitySection(props: {
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  rows: SensitivityRow[];
  unavailable: boolean;
  /** 说明行用变动值：父组件按「月开销 × 10% × 乘数」算好经 props 传入（字符串） */
  delta: string;
  symbol: string;
}) { /* 见下述渲染规格 */ }
```

- **状态与触发**（`BasicCalculator` 主体内）：

```tsx
const [sensOpen, setSensOpen] = useState(false);
const [sensState, setSensState] = useState<{ loading: boolean; rows: SensitivityRow[] }>({
  loading: false,
  rows: [],
});
const localInvalid = realReturnPct <= 0; // 既有变量（BasicCalculator.tsx:119）

useEffect(() => {
  if (!sensOpen || localInvalid) return;
  let cancelled = false;
  const timer = window.setTimeout(async () => {
    setSensState((s) => ({ ...s, loading: true }));
    const results = await Promise.all(
      SENS_STEPS.map(async (pct) => {
        const r = await calcBaseline({
          ...baseline,
          monthlyExpense: Math.round(baseline.monthlyExpense * (1 + pct / 100)),
        });
        return { pct, critical: r.ok && r.data.error === "" ? r.data.criticalValue : null };
      }),
    );
    if (!cancelled) setSensState({ loading: false, rows: results });
  }, DEBOUNCE_MS);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}, [sensOpen, baseline, localInvalid]);
```

- **渲染规格**（`SensitivitySection`）：
  1. 展开开关：`Button type="text" size="small" className="wf-sens-toggle" aria-expanded={open}`，文案 `open ? t("sensitivity.collapse") : t("sensitivity.expand")`，前缀 `t("sensitivity.title")`；
  2. `open` 时渲染 `div.wf-sens-block`：
     - `unavailable`（`localInvalid` 或全部行 `critical === null`）→ `Alert type="info"` 文案 `t("sensitivity.unavailable")`；
     - 否则两组：`Text type="secondary" className="wf-sens-group"` `t("sensitivity.plusTitle")` 与 `t("sensitivity.minusTitle")`；每组下 `div.wf-sens-rows` 三行 `div.wf-sens-row`——标签 `t(pct > 0 ? "sensitivity.plusRow" : "sensitivity.minusRow", { pct: Math.abs(pct) })`，值 `row.critical === null ? "—" : formatMoney(row.critical, symbol)`（loading 期间 rows state 沿用上一次结果，不逐行显示 `common.computing`）；
     - 说明行 `Text type="secondary" className="wf-sens-note"`：`t("sensitivity.note", { pct: 10, delta })`——`delta` 是父组件算好的字符串 prop（组件作用域内**不出现** `baseline` / `data`，避免按字面实现 TS 报错）；线性部分 = ΔE × 乘数，父组件内：

```tsx
/** 敏感性说明行变动值：月开销 × 10% × 乘数（乘数取核心回显值，未就绪时退回本地预览） */
const sensDelta = formatMoney(
  baseline.monthlyExpense * 0.1 * (data ? data.multiplier : multiplierPreview),
  symbol,
);
```

       `<SensitivitySection … delta={sensDelta} symbol={symbol} … />`。
- **落点**：输出卡 `localInvalid` 分支之外、`wf-output-breakdown` 之后（`BasicCalculator.tsx:226-239` 之后）——与主输出同条件渲染（`data` 未就绪时行值显示「—」，小节本身仍可展开）。

### 5.2 ③ 验收清单

- [ ] 默认折叠，输出卡与现状完全一致（无额外 DOM）；点「展开」出现 6 行（+30/+20/+10/−10/−20/−30）。
- [ ] 默认参数锚点：月开销 2,990 → +10% 档（3,289）参考线 = 3,289 × 480 + 200,000 = 1,778,720；−10% 档（2,691）= 1,491,680（±20%/±30% 同式）——抽查与 wasm 结果一致。
- [ ] 改「每月开销」→ 已展开时 6 行防抖重算；改回报率使实际回报 ≤ 0 → 小节显示不可用提示。
- [ ] 说明行 delta 数值 = 月开销 × 10% × 乘数（默认 2,990 × 0.1 × 480 = 143,520）。
- [ ] 无新增依赖；三语切换无键缺失。

---

## 6. ④ 场景分享链接

### 6.0 口径

- 把**全部业务输入切片**编码进 URL hash：基础 / 反向 / 贷款 / 收租 / 蒙特卡洛（含收益模式与序列选择）/ 打工 / 税务 / 进度环 / 养老金。**不含**主题、语言、色盲友好、币种等界面偏好；**不含** `activePresetId`（画像 id 非业务输入，恢复后置 `"custom"`）与 `accumulationTargetSynced` / `pensionMonthsSynced`（联动状态随目标值/计发月数原值恢复，恢复后一律置 `false`）。计发月数入链值自 v2 起为**联动态表值**（`effectiveMonthsDivisor` 口径：联动态携带面板所见表值，发送方所见即接收方所得；非联动态原值直传）。
- 编码：`v`（版本号）+ 各切片短键 → `JSON.stringify` → **base64url**（`+/ → -_`、去 `=`）。JSON 全部为数值与 ASCII 枚举（`equal_payment / equal_principal / normal / bootstrap / csi300 / sp500`），无中文值——`btoa` 安全（不变量注明于 share.ts 头注释；未来加入非 ASCII 值必须先改为 TextEncoder 编码）。
- hash 形如 `#s=<payload>`；**恢复后 hash 保留**（刷新可复现同一套参数）。
- **解析时机（验收 Q3-2 修正项）**：首挂载解析一次 + 监听 `hashchange`——同文档导航（地址栏改 hash / 粘贴仅差 hash 的链接，App 不重挂载）与新标签打开行为一致：合法载荷恢复并提示成功，损坏 / 版本不符业务参数回落默认（`resetBusinessInputs`，界面偏好不动）并 `Message.warning` 提示。
- 损坏 / 版本不符 → `decodeShareState` 返回 `null` → 业务参数回落默认（保持默认参数）+ `Message.warning` 提示；成功 → `Message.success` 提示。

### 6.1 `src/services/share.ts`（新文件，全文逐字可粘贴）

```ts
/**
 * 场景分享链接：业务输入切片 ⇄ URL hash 的编解码（编解码为纯函数；
 * 末尾两个 DOM 辅助服务于复制动作）。
 *
 * - 切片范围：基础 / 反向 / 贷款 / 收租 / 蒙特卡洛（含收益模式与序列 id）/ 打工 /
 *   税务 / 进度环 / 养老金；不含主题 / 语言 / 色盲 / 币种等界面偏好（契约见
 *   docs/p1-spec.md §6.0）。
 * - 编码：{ v: 版本号, ...切片 } → JSON 字符串 → base64url（+/ → -_、去填充 =）。
 *   JSON 值全部为数值与 ASCII 枚举（不含中文），btoa/atob 安全；若未来引入
 *   非 ASCII 值，必须先改造为 TextEncoder 编码，不得直接沿用本实现。
 * - 解码：任何形状不符 / 版本不符 / 超长 / base64 或 JSON 解析失败 → 返回 null
 *   （调用方静默忽略并提示）；数值字段要求有限数，枚举字段要求成员命中；
 *   不做部分恢复——半套参数比默认值更危险。
 * - 往返一致：decode(encode(x)) 对合法 x 恒等（验收见 §6.4）。
 */
import type {
  AccumulationInput,
  AmortizeInput,
  BaselineInput,
  EstimateTaxInput,
  MonteCarloInput,
  RentalAnalysisInput,
  ReverseEstimateInput,
} from "../wasm/bridge";
import type { PensionInputs } from "../data/pensionParams";
import type { IndexId, MonteCarloReturnMode } from "../data/indexSeries";

/** 分享链接版本（切片形状或字段语义变更时递增；解码端仅接受当前版本）。
 * v2：pension.monthsDivisor 编码值改为「联动态取面板所见表值」（effectiveMonthsDivisor
 * 口径），发送方所见与接收方所得一致；v1 链接按损坏处理（静默回落默认 + 提示） */
export const SHARE_LINK_VERSION = 2;

/** hash 前缀（#s=<payload>） */
const HASH_PREFIX = "#s=";

/** 载荷长度上限（防滥用；超出按损坏处理） */
const MAX_PAYLOAD_CHARS = 8192;

/** 分享切片（与 store 各业务切片一一对应） */
export interface ShareState {
  baseline: BaselineInput;
  reverse: ReverseEstimateInput;
  loan: AmortizeInput;
  rental: RentalAnalysisInput;
  monteCarlo: MonteCarloInput;
  monteCarloReturnMode: MonteCarloReturnMode;
  monteCarloSeriesId: IndexId;
  tax: EstimateTaxInput;
  accumulation: AccumulationInput;
  /** 进度环输入（切片仅此一个数值） */
  progressCurrentAssets: number;
  pension: PensionInputs;
}

interface SharePayload extends ShareState {
  /** 版本号 */
  v: number;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string | null {
  try {
    const t = s.replace(/-/g, "+").replace(/_/g, "/");
    return atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  } catch {
    return null;
  }
}

/** 取 payload 中的切片对象（须为普通对象）；不符返回 null */
function sliceOf(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = obj[key];
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

/** 逐键校验数值切片：keys 全部为有限数才返回键值表，否则 null */
function numSlice(obj: Record<string, unknown>, keys: string[]): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const k of keys) {
    const v = obj[k];
    if (!isNum(v)) return null;
    out[k] = v;
  }
  return out;
}

/** 编码分享切片 → base64url 载荷（不含 #s= 前缀） */
export function encodeShareState(state: ShareState): string {
  const payload: SharePayload = { v: SHARE_LINK_VERSION, ...state };
  return toBase64Url(JSON.stringify(payload));
}

/** 解析完整 hash（或裸载荷）→ 分享切片；任何不符返回 null */
export function decodeShareState(hash: string): ShareState | null {
  const raw = hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : hash;
  if (raw === "" || raw.length > MAX_PAYLOAD_CHARS) return null;
  const json = fromBase64Url(raw);
  if (json === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj["v"] !== SHARE_LINK_VERSION) return null;

  const baseline = numSlice(
    sliceOf(obj, "baseline") ?? {},
    ["monthlyExpense", "childCount", "costPerChild", "healthReserve", "majorInvestment", "nominalReturnPct", "inflationPct"],
  );
  const reverse = numSlice(
    sliceOf(obj, "reverse") ?? {},
    ["totalAssets", "childReserve", "healthReserve", "majorInvestment", "nominalReturnPct", "inflationPct"],
  );
  const loanObj = sliceOf(obj, "loan");
  const loanNums = loanObj
    ? numSlice(loanObj, ["principal", "annualRatePct", "years"])
    : null;
  const method = loanObj?.["method"];
  const rental = numSlice(
    sliceOf(obj, "rental") ?? {},
    ["price", "downPaymentPct", "loanAnnualRatePct", "loanYears", "monthlyRent", "vacancyRatePct", "maintenanceAnnualRatePct", "propertyFeeMonthly", "otherAnnualCost", "rentTaxRatePct"],
  );
  const monteCarlo = numSlice(
    sliceOf(obj, "monteCarlo") ?? {},
    ["currentAssets", "annualSpend", "nominalReturnMeanPct", "nominalReturnStdPct", "inflationMeanPct", "inflationStdPct", "years", "paths", "seed"],
  );
  const returnMode = obj["monteCarloReturnMode"];
  const seriesId = obj["monteCarloSeriesId"];
  const taxObj = sliceOf(obj, "tax");
  const taxNums = taxObj ? numSlice(taxObj, ["grossAnnualIncome", "standardDeduction"]) : null;
  const bandsRaw = taxObj?.["bands"];
  const accumulation = numSlice(
    sliceOf(obj, "accumulation") ?? {},
    ["currentAssets", "monthlyIncome", "monthlyExpense", "targetValue", "nominalReturnMeanPct", "nominalReturnStdPct", "inflationMeanPct", "inflationStdPct", "years", "paths", "seed"],
  );
  const progress = obj["progressCurrentAssets"];
  const pension = numSlice(
    sliceOf(obj, "pension") ?? {},
    ["currentAge", "retireAge", "contribYears", "contribIndex", "accountBalance", "avgMonthlyWage", "monthsDivisor"],
  );

  if (!baseline || !reverse || !loanNums || !rental || !monteCarlo || !taxNums || !accumulation || !pension) {
    return null;
  }
  if (!isNum(progress)) return null;
  if (method !== "equal_payment" && method !== "equal_principal") return null;
  if (returnMode !== "normal" && returnMode !== "bootstrap") return null;
  if (seriesId !== "csi300" && seriesId !== "sp500") return null;
  if (!Array.isArray(bandsRaw)) return null;
  const bands: { lower: number; rate: number }[] = [];
  for (const b of bandsRaw) {
    if (typeof b !== "object" || b === null || Array.isArray(b)) return null;
    const lower = (b as Record<string, unknown>)["lower"];
    const rate = (b as Record<string, unknown>)["rate"];
    if (!isNum(lower) || !isNum(rate) || rate < 0) return null;
    bands.push({ lower, rate });
  }

  return {
    baseline: baseline as unknown as BaselineInput,
    reverse: reverse as unknown as ReverseEstimateInput,
    loan: { ...(loanNums as unknown as { principal: number; annualRatePct: number; years: number }), method },
    rental: rental as unknown as RentalAnalysisInput,
    monteCarlo: monteCarlo as unknown as MonteCarloInput,
    monteCarloReturnMode: returnMode,
    monteCarloSeriesId: seriesId,
    tax: { ...(taxNums as unknown as { grossAnnualIncome: number; standardDeduction: number }), bands },
    accumulation: accumulation as unknown as AccumulationInput,
    progressCurrentAssets: progress,
    pension: pension as unknown as PensionInputs,
  };
}

/** 由载荷构造完整分享 URL */
export function buildShareUrl(payload: string): string {
  return `${window.location.origin}${window.location.pathname}${HASH_PREFIX}${payload}`;
}

/** 复制到剪贴板：Clipboard API 优先，失败回退 execCommand（file:// 等非安全上下文） */
export async function copyShareUrl(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
```

**切片键表速查**（与上示 `decodeShareState` 逐键一致，形状变更时两处同步并递增 `SHARE_LINK_VERSION`）：

| 切片 | 键（全部要求有限数，除注明外） |
| --- | --- |
| `baseline` | monthlyExpense / childCount / costPerChild / healthReserve / majorInvestment / nominalReturnPct / inflationPct |
| `reverse` | totalAssets / childReserve / healthReserve / majorInvestment / nominalReturnPct / inflationPct |
| `loan` | principal / annualRatePct / years + `method`（枚举 `equal_payment` \| `equal_principal`） |
| `rental` | price / downPaymentPct / loanAnnualRatePct / loanYears / monthlyRent / vacancyRatePct / maintenanceAnnualRatePct / propertyFeeMonthly / otherAnnualCost / rentTaxRatePct |
| `monteCarlo` | currentAssets / annualSpend / nominalReturnMeanPct / nominalReturnStdPct / inflationMeanPct / inflationStdPct / years / paths / seed |
| 顶层伴生键 | `monteCarloReturnMode ∈ {normal, bootstrap}`、`monteCarloSeriesId ∈ {csi300, sp500}`、`progressCurrentAssets`（单个数值） |
| `tax` | grossAnnualIncome / standardDeduction + `bands`（数组逐元素 `{ lower, rate }` 有限数校验，`rate ≥ 0`；空数组合法） |
| `accumulation` | currentAssets / monthlyIncome / monthlyExpense / targetValue / nominalReturnMeanPct / nominalReturnStdPct / inflationMeanPct / inflationStdPct / years / paths / seed |
| `pension` | currentAge / retireAge / contribYears / contribIndex / accountBalance / avgMonthlyWage / monthsDivisor |

任一键缺失 / 类型不符 / 枚举未命中 → 整体返回 `null`。

### 6.2 store 与 App 增量

`useCalculatorStore.ts`：

```ts
import { decodeShareState } from "../services/share";

  /** 从分享 hash 恢复全部业务输入切片；payload 非法/版本不符时不动任何切片并返回 false */
  applyShareState: (hash: string) => boolean;
```

```ts
  applyShareState: (hash) => {
    const shared = decodeShareState(hash);
    if (!shared) return false;
    set({
      baselineInputs: shared.baseline,
      activePresetId: "custom", // 画像 id 非业务输入，不随链接恢复
      reverseInputs: shared.reverse,
      loanInputs: shared.loan,
      rentalInputs: shared.rental,
      monteCarloInputs: shared.monteCarlo,
      monteCarloReturnMode: shared.monteCarloReturnMode,
      monteCarloSeriesId: shared.monteCarloSeriesId,
      taxInputs: shared.tax,
      accumulationInputs: shared.accumulation,
      accumulationTargetSynced: false, // 目标值以链接携带的原值呈现，不联动
      progressInputs: { currentAssets: shared.progressCurrentAssets },
      pensionInputs: shared.pension,
      pensionMonthsSynced: false,
    });
    return true;
  },
```

`App.tsx`：

- import 增：`Message`（arco）、`useCalculatorStore` 已有。
- 顶栏以下 `Content` 之前不新增 UI；挂载解析 effect：

```tsx
  const applyShareState = useCalculatorStore((s) => s.applyShareState);
  const resetBusinessInputs = useCalculatorStore((s) => s.resetBusinessInputs);
  const shareHandledRef = useRef(false);
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#s=")) return;
      if (applyShareState(hash)) {
        Message.success(t("share.restored"));
      } else {
        // 损坏 / 版本不符：业务参数回落默认（与新标签打开终态一致；界面偏好不动）+ 一次提示
        resetBusinessInputs();
        Message.warning(t("share.restoreIgnored"));
      }
    };
    if (!shareHandledRef.current) {
      shareHandledRef.current = true;
      handleHash(); // 仅首挂载解析现有 hash；hash 保留在地址栏，刷新可复现同一套参数
    }
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [applyShareState, resetBusinessInputs, t]);
```

### 6.3 复制按钮 UI（`BasicCalculator.tsx` 输入卡末尾）

落点：输入卡内、核心参数 `Collapse`（`BasicCalculator.tsx:365-406`）之后：

```tsx
{/* ④ 场景分享：把全部业务输入编码进 URL hash（界面偏好不携带，docs/p1-spec.md §6） */}
<div className="wf-share-row">
  <Button
    size="small"
    className="wf-pressable"
    onClick={() => {
      const s = useCalculatorStore.getState();
      const payload = encodeShareState({
        baseline: s.baselineInputs,
        reverse: s.reverseInputs,
        loan: s.loanInputs,
        rental: s.rentalInputs,
        monteCarlo: s.monteCarloInputs,
        monteCarloReturnMode: s.monteCarloReturnMode,
        monteCarloSeriesId: s.monteCarloSeriesId,
        tax: s.taxInputs,
        accumulation: s.accumulationInputs,
        progressCurrentAssets: s.progressInputs.currentAssets,
        pension: {
          ...s.pensionInputs,
          // 联动态以面板所见表值入链（发送方所见 = 接收方所得，验收 Q3-3）；
          // 口径与 PensionPanel 的 effectiveMonths 同一函数，禁止两处内联重推
          monthsDivisor: effectiveMonthsDivisor(
            s.pensionInputs.monthsDivisor,
            s.pensionInputs.retireAge,
            s.pensionMonthsSynced,
          ),
        },
      });
      void copyShareUrl(buildShareUrl(payload)).then((ok) => {
        if (ok) Message.success(t("share.copied"));
        else Message.error(t("share.copyFailed"));
      });
    }}
  >
    {t("share.copy")}
  </Button>
  <Text type="secondary">{t("share.copyTooltip")}</Text>
</div>
```

import 增：`encodeShareState`、`buildShareUrl`、`copyShareUrl`（`../services/share`）。

### 6.4 ④ 验收清单

- [ ] 「复制分享链接」点击 → 剪贴板得到 `…/#s=` 开头的 URL + `Message.success` 提示。
- [ ] 新开窗口粘贴该 URL → 页面加载后全部业务输入恢复（逐面板核对：基础 5+2 字段 / 反向 / 贷款含还款方式 / 收租 10 字段 / 蒙特卡洛含模式与序列 / 打工含目标值 / 税务含税档 / 进度环资产 / 养老金 7 字段），且提示「已从分享链接恢复」。
- [ ] 恢复后：画像徽标为「自定义」；打工目标值与养老金计发月数不联动（synced = false）。
- [ ] 手工把 hash 改坏（删字符 / 改 `v` 值 / 塞中文）→ 参数保持默认 + 「无法识别」警告，页面无异常。
- [ ] 不带 hash 打开 → 无任何提示（现状不变）。
- [ ] **往返一致**：复制链接 → 打开 → 再次复制 → 两次 URL 载荷逐字节相同（同一 store 状态下）；`decodeShareState(encodeShareState(x))` 与 `x` 深相等（可用 `node` + 构建产物或浏览器控制台断言）。
- [ ] 币种 / 主题 / 语言 / 色盲开关不受链接影响。

---

## 7. Rust 测试清单（`src/wasm/tests/integration.rs` 新增第 11/12 节）

前置于 `use` 区（`integration.rs:12-15`）：`estimate_pension`、`run_monte_carlo_bootstrap` 加入 `finance_core` 导入列表。

**锚点数值**全部为本规范撰写时以 Node.js 按 §3.3 公式与 §4.3 递推式验算的执行结果（非手算）：

| 用例 | 输入要点 | 锚点 |
| --- | --- | --- |
| P-A | 社平 10,343 / 指数 0.6 / 30 年 / 余额 50,000 / 139 月 / 月开销 2,990 / 0 孩 / 健康 20 万 / 名义 4.5 / 通胀 2.0 | basic = 2,482.32；account = 359.71；pension = 2,842.03；coverage = 0.95；yearsToRetire = 30；adjusted = 147.97；adjustedCritical = 271,025.60；multiplier = 480 |
| P-B | 指数 1.0 / 35 年 / 余额 120,000 / 月开销 8,000 / 1 孩 58 万 / 健康 20 万 | basic = 3,620.05；account = 863.31；pension = 4,483.36；coverage = 0.56；adjusted = 3,516.64；adjustedCritical = 2,467,987.20（与 calculate_baseline(monthlyExpense=3,516.64) 完全一致） |
| P-C | 指数 1.0 / 40 年 / 余额 200,000 / 月开销 2,000 / 健康 10 万 | pension = 5,576.05；coverage = 2.79（不封顶）；adjusted = 0；adjustedCritical = 100,000.00 |
| B-D | series = [5]（单元素）、A₀ = 1,000,000、年支出 50,000、名义字段（校验用）5/1e-9、通胀 2/1e-9、20 年 | 每年回报恒 5% → 期末全分位 ≈ 668,802.18（与既有名义口径闭式解同式同值） |
| B-E | series = [0]、通胀 2/1e-9、A₀ = 1,000,000、年支出 50,000、20 年 | 第 16 年末 ≈ 49,396 > 0、第 17 年末 ≤ 0 → 全部路径耗尽：depletionProb = 1.0、medianTerminal = 0、全部分位 0、路径第 17 年及以后为 0 |
| P-T1（P7 补） | P-A 输入 + targetRetireAge = 30 | bridgeYears = 30；bridgeFundingNeeded = round2(2,990 × 480) = **1,435,200.00**（纯生活费口径，附加项单次计入段 2——修订轮二 R5）；两段相加 1,706,225.60 = 真实总需；P-A 九锚点零漂移 |
| P-T7（P7 补） | calculate_baseline：2,990 / 1 孩 20 万 / 4.5−2.0 | multiplierExact = **489.6**（= 12×1.02/0.025 精确）；criticalValueExact = **1,663,904.00**（= 2,990×489.6 + 200,000）；480 三锚点（2.5 / 480 / 1,635,200）零漂移 |

```rust
// ---------------------------------------------------------------------------
// 11. estimate_pension
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_arguments)]
fn pension_input(
    wage: f64, idx: f64, years: f64, balance: f64, months: f64,
    expense: f64, children: f64, cost: f64, health: f64, major: f64,
    nominal: f64, inflation: f64, current_age: f64, retire_age: f64,
) -> String {
    format!(
        r#"{{"monthlyExpense":{expense},"childCount":{children},"costPerChild":{cost},"healthReserve":{health},"majorInvestment":{major},"nominalReturnPct":{nominal},"inflationPct":{inflation},"currentAge":{current_age},"retireAge":{retire_age},"contribYears":{years},"contribIndex":{idx},"accountBalance":{balance},"avgMonthlyWage":{wage},"monthsDivisor":{months}}}"#
    )
}

#[test]
fn pension_known_values_default_caliber() {
    // 锚点见本节 P-A（docs/p1-spec.md §7 表）
    let out = estimate_pension(&pension_input(
        10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0,
        4.5, 2.0, 30.0, 60.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_eq!(num(&v, "yearsToRetire"), 30.0, "距退休年限");
    assert_close(num(&v, "basicPensionMonthly"), 2_482.32, 1e-9, "基础养老金");
    assert_close(num(&v, "accountPensionMonthly"), 359.71, 1e-9, "个人账户养老金");
    assert_close(num(&v, "pensionMonthly"), 2_842.03, 1e-9, "预计月养老金");
    assert_close(num(&v, "coverageRatio"), 0.95, 1e-9, "覆盖率两位小数");
    assert_close(num(&v, "adjustedMonthlyExpense"), 147.97, 1e-9, "调整后月开销");
    assert_close(num(&v, "multiplier"), 480.0, 1e-12, "乘数与 baseline 同口径");
    assert_close(num(&v, "adjustedCriticalValue"), 271_025.60, 1e-6, "调整后参考线");
}

#[test]
fn pension_adjusted_critical_matches_baseline() {
    // 恒等式：adjustedCriticalValue == calculate_baseline(monthlyExpense = adjustedMonthlyExpense)
    let out = estimate_pension(&pension_input(
        10343.0, 1.0, 35.0, 120000.0, 139.0, 8000.0, 1.0, 580000.0, 200000.0, 0.0,
        4.5, 2.0, 30.0, 65.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    let adjusted = num(&v, "adjustedMonthlyExpense");
    let adjusted_critical = num(&v, "adjustedCriticalValue");
    assert_close(adjusted, 3_516.64, 1e-9, "调整后月开销（P-B）");
    assert_close(adjusted_critical, 2_467_987.20, 1e-6, "调整后参考线（P-B）");

    let base = calculate_baseline(&format!(
        r#"{{"monthlyExpense":{adjusted},"childCount":1,"costPerChild":580000,"healthReserve":200000,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}}"#
    ));
    let bv = jv(&base);
    assert_eq!(txt(&bv, "error"), "");
    assert_close(
        num(&bv, "criticalValue"),
        adjusted_critical,
        1e-6,
        "两函数在相同乘数与附加项下必须逐值一致",
    );
}

#[test]
fn pension_coverage_above_one_not_capped() {
    // 锚点 P-C：覆盖率 2.79 不封顶；调整后月开销钳 0；参考线只剩附加预留
    let out = estimate_pension(&pension_input(
        10343.0, 1.0, 40.0, 200000.0, 139.0, 2000.0, 0.0, 580000.0, 100000.0, 0.0,
        4.5, 2.0, 30.0, 70.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "pensionMonthly"), 5_576.05, 1e-9, "预计月养老金");
    assert_close(num(&v, "coverageRatio"), 2.79, 1e-9, "覆盖率不封顶");
    assert_eq!(num(&v, "adjustedMonthlyExpense"), 0.0, "月开销 < 养老金 → 钳 0");
    assert_close(num(&v, "adjustedCriticalValue"), 100_000.00, 1e-9, "仅剩健康预留");
}

#[test]
fn pension_error_when_real_return_not_positive() {
    let out = estimate_pension(&pension_input(
        10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0,
        2.0, 4.5, 30.0, 60.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "通胀率需低于名义回报率");
    assert_eq!(num(&v, "multiplier"), 0.0);
    assert_eq!(num(&v, "pensionMonthly"), 0.0);
    assert_eq!(num(&v, "adjustedCriticalValue"), 0.0);
}

#[test]
fn pension_validation_errors() {
    for (input, keyword) in [
        // 退休年龄 ≤ 当前年龄
        (pension_input(10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 60.0, 60.0), "退休年龄"),
        // 计发月数 0
        (pension_input(10343.0, 0.6, 30.0, 50000.0, 0.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "计发月数"),
        // 缴费基数指数越界
        (pension_input(10343.0, 12.0, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "缴费基数指数"),
        // 账户余额为负
        (pension_input(10343.0, 0.6, 30.0, -1.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "个人账户余额估计"),
        // 缴费年限越界
        (pension_input(10343.0, 0.6, 51.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "缴费年限"),
        // 当前年龄越界
        (pension_input(10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 15.0, 60.0), "当前年龄"),
        // 月开销为负
        (pension_input(10343.0, 0.6, 30.0, 50000.0, 139.0, -100.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "月开销"),
    ] {
        let v = jv(&estimate_pension(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert_eq!(num(&v, "pensionMonthly"), 0.0, "错误安全值");
    }
}

// ---------------------------------------------------------------------------
// 12. run_monte_carlo_bootstrap
// ---------------------------------------------------------------------------

fn boot_input(seed: u64, mean_i: f64, std_i: f64, years: f64, paths: f64, series: &[f64]) -> String {
    // nominalReturnMeanPct/nominalReturnStdPct 合法但被忽略（bootstrap 模式仅校验不参与）
    let series_json = series
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(",");
    format!(
        r#"{{"currentAssets":1000000,"annualSpend":50000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":{mean_i},"inflationStdPct":{std_i},"years":{years},"paths":{paths},"seed":{seed},"series":[{series_json}]}}"#
    )
}

#[test]
fn bootstrap_same_seed_is_deterministic() {
    let inp = boot_input(42, 2.0, 1.0, 30.0, 200.0, &[14.68, -65.95, 121.02, 5.58]);
    let a = run_monte_carlo_bootstrap(&inp);
    let b = run_monte_carlo_bootstrap(&inp);
    assert_eq!(a, b, "同 seed 同输入必须逐字节一致");

    let c = run_monte_carlo_bootstrap(&boot_input(43, 2.0, 1.0, 30.0, 200.0, &[14.68, -65.95, 121.02, 5.58]));
    assert_ne!(a, c, "不同 seed 输出应不同");

    let v = jv(&a);
    assert_eq!(txt(&v, "error"), "");
    let depletion = num(&v, "depletionProb");
    assert!((0.0..=1.0).contains(&depletion), "耗尽概率须在 [0,1]：{depletion}");
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50, "固定抽取 50 条");
    for path in paths {
        assert_eq!(path.as_array().unwrap().len(), 30, "每条长度 = years");
    }
}

#[test]
fn bootstrap_single_element_matches_nominal_closed_form() {
    // 锚点 B-D：单元素序列 [5] → 每年回报恒 5%，与既有名义口径闭式解同式
    // （A_20 = 668,802.18，同 monte_carlo_nominal_recurrence_known_value 的口径与容差）
    let out = run_monte_carlo_bootstrap(&boot_input(7, 2.0, 1e-9, 20.0, 20.0, &[5.0]));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_eq!(num(&v, "depletionProb"), 0.0, "该参数下不应耗尽");
    let expected = 668_802.18;
    for k in ["medianTerminal", "p5", "p25", "p75", "p95"] {
        let x = num(&v, k);
        assert!(
            (x - expected).abs() < 0.05,
            "{k} 应为名义口径闭式解 {expected}（实际 {x}）"
        );
    }
}

#[test]
fn bootstrap_zero_return_series_with_inflation_depletes() {
    // 锚点 B-E：回报恒 0、通胀 2% 精确上行 → 第 17 年耗尽；
    // 通胀路径必须来自正态机制（σ=1e-9 近似确定），序列元素只供回报
    let out = run_monte_carlo_bootstrap(&boot_input(9, 2.0, 1e-9, 20.0, 20.0, &[0.0]));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "depletionProb"), 1.0, 1e-12, "回报 0 + 支出通胀上行 → 全部耗尽");
    assert_eq!(num(&v, "medianTerminal"), 0.0, "耗尽路径期末为 0");
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    let p0 = paths[0].as_array().unwrap();
    assert!(p0[15] > 0.0, "第 16 年末仍为正（实际 {}）", p0[15]);
    assert_eq!(p0[16], 0.0, "第 17 年末耗尽记 0");
    for k in ["p5", "p25", "p75", "p95"] {
        assert_eq!(num(&v, k), 0.0, "{k} 全部耗尽为 0");
    }
}

#[test]
fn bootstrap_different_series_differ() {
    let a = run_monte_carlo_bootstrap(&boot_input(7, 2.0, 1.0, 30.0, 100.0, &[8.0]));
    let b = run_monte_carlo_bootstrap(&boot_input(7, 2.0, 1.0, 30.0, 100.0, &[-3.0]));
    assert_ne!(a, b, "不同序列（同 seed）输出应不同");
}

#[test]
fn bootstrap_validation_errors() {
    for (input, keyword) in [
        // 空序列
        (boot_input(1, 2.0, 1.0, 30.0, 10.0, &[]), "收益序列"),
        // 元素 ≤ −100（回报率不得低于 −100%）
        (boot_input(1, 2.0, 1.0, 30.0, 10.0, &[-100.0]), "收益序列元素"),
        // 元素超出百分点上限
        (boot_input(1, 2.0, 1.0, 30.0, 10.0, &[1001.0]), "1000"),
        // 通胀 σ ≤ 0（沿用既有校验语义）
        (boot_input(1, 2.0, 0.0, 30.0, 10.0, &[5.0]), "标准差"),
        // 模拟年数 0
        (boot_input(1, 2.0, 1.0, 0.0, 10.0, &[5.0]), "模拟年数"),
    ] {
        let v = jv(&run_monte_carlo_bootstrap(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert!(v.get("samplePaths").unwrap().as_array().unwrap().is_empty(), "错误安全值：路径为空");
    }
}
```

---

## 8. 新增文案键清单（64 键，简中基准；zh-Hant 逐词字形转换、en 翻译）

落点文件：`src/i18n/locales/zh-CN.ts` / `zh-Hant.ts` / `en.ts`；插值占位符名三份必须一致。

### 8.1 `advanced.pensionHeader`（1 键）

| 键 | 简中文案 |
| --- | --- |
| `advanced.pensionHeader` | `⑦ 社保养老金 —— 退休后每月能领多少，参考线能降多少` |

### 8.2 `pension.*`（33 键）

| 键 | 简中文案 |
| --- | --- |
| `pension.formulaNote` | `简化两层公式：基础养老金 ≈（社平工资 + 社平工资 × 缴费基数指数）÷ 2 × 缴费年限 × 1%；个人账户养老金 = 个人账户余额估计 ÷ 计发月数。社平工资与缴费指数不做逐年增长假设（简化口径，见下方免责）。` |
| `pension.currentAge` | `当前年龄` |
| `pension.currentAgeTooltip` | `用于推算距退休的年数；仅做年限推算，不构成任何社保待遇承诺。` |
| `pension.retireAge` | `退休年龄` |
| `pension.retireAgeTooltip` | `预期办理退休的年龄；计发月数默认按对照表联动（60 岁 = 139、55 岁 = 170、50 岁 = 195 个月），手动修改「计发月数」即解除联动。` |
| `pension.retireAgeDelayNote` | `2025-01-01 起法定退休年龄实施渐进式延迟（男职工逐步延迟至 63 岁）；请按自身预期填写，本工具不做政策判定。` |
| `pension.contribYears` | `缴费年限（截至退休）` |
| `pension.contribYearsTooltip` | `预期截至退休的累计缴费年限估计（含已缴）；视同缴费年限请自行折算后填写。` |
| `pension.contribIndex` | `缴费基数指数` |
| `pension.contribIndexTooltip` | `历年缴费基数相对当地社平工资的平均倍数（小数：0.6 ≈ 按社平的 60% 缴费，1.0 = 恰好等于社平）。多数省份下限 0.6、上限 3。` |
| `pension.accountBalance` | `个人账户余额估计` |
| `pension.accountBalanceTooltip` | `当前「养老保险个人账户储存额」估计值；可在电子社保卡 / 当地社保 App 查询后填入。` |
| `pension.avgWage` | `计发口径社会平均工资` |
| `pension.avgWageTooltip` | `基础养老金公式中的「上年度社平工资」；默认取国家统计局 2024 年城镇非私营单位口径（见下方来源行），请按所在省市养老金计发基数自行修改。` |
| `pension.monthsDivisor` | `计发月数` |
| `pension.monthsDivisorTooltip` | `个人账户养老金的除数（附表口径：60 岁 139、55 岁 170、50 岁 195 个月）；默认按退休年龄联动，手动修改即解除。` |
| `pension.monthsSyncedHint` | `计发月数当前按退休年龄联动数据层对照表；手动修改即解除联动。` |
| `pension.monthsResync` | `恢复按退休年龄联动` |
| `pension.wageSourceLine` | `社平工资取数：{{source}}` |
| `pension.monthlyPension` | `预计月养老金` |
| `pension.basicPart` | `其中：基础养老金` |
| `pension.accountPart` | `其中：个人账户养老金` |
| `pension.yearsToRetire` | `距退休年限` |
| `pension.monthsUsed` | `计发月数` |
| `pension.monthsUnit` | `个月` |
| `pension.adjustedTitle` | `调整后参考线（月开销扣除养老金覆盖部分）` |
| `pension.adjustedExpense` | `调整后月开销` |
| `pension.adjustedCritical` | `调整后财富自由参考线` |
| `pension.coverage` | `养老金覆盖率（月养老金 ÷ 月开销）` |
| `pension.coverageHint` | `月开销中被养老金覆盖的部分不再需要本金支撑，参考线相应下降；覆盖率超过 100% 表示预计养老金已覆盖当前全部月开销。` |
| `pension.coverageFull` | `预计养老金已覆盖当前全部月开销` |
| `pension.resultNote` | `以上为「退休时点」估算：未对社平工资与缴费指数做逐年增长假设；个人账户余额按当前估计值直接除以计发月数，不做未来增值假设。` |
| `pension.disclaimer` | `简化估算，不构成社保咨询；实际待遇以社保经办机构核算为准。` |

（注：`pension.monthsUsed` 与 `pension.monthsDivisor` 文案同形但用途不同——前者为结果表标签、后者为输入字段标签，保留独立键便于日后分别调整。）

### 8.3 `mc.*` 增量（14 键）

| 键 | 简中文案 |
| --- | --- |
| `mc.returnMode` | `收益模式` |
| `mc.returnModeTooltip` | `正态参数：按「均值 ± 标准差」的正态分布抽样（经典口径）。历史自助抽样：从所选指数的真实年度收益序列中有放回随机重抽（i.i.d.），保留真实历史的肥尾与偏度，但忽略年份顺序（不覆盖波动聚集等序列相关性）。` |
| `mc.modeNormal` | `正态参数` |
| `mc.modeBootstrap` | `历史自助抽样` |
| `mc.bootstrapModeNote` | `历史自助抽样模式下，「名义回报率均值 / 标准差」不参与计算（分布由所选序列决定）；通胀仍按正态分布抽样。` |
| `mc.seriesLabel` | `收益序列` |
| `mc.seriesTooltip` | `用于自助抽样的指数年度收益序列；数值与来源见下方说明与 README 数据来源表。` |
| `mc.indexCsi300` | `沪深300（中国）` |
| `mc.indexSp500` | `标普500（国际）` |
| `mc.seriesNote` | `{{name}}：{{firstYear}}–{{lastYear}} 年年度收益率，共 {{count}} 个样本（{{kind}}）；来源：{{source}}` |
| `mc.seriesPriceOnly` | `价格指数（不含股息，略低估总回报）` |
| `mc.seriesTotalReturn` | `总回报（含股息再投资）` |
| `mc.placeholderBootstrap` | `点击「运行模拟」后，将从所选指数的年度收益序列中随机重抽收益样本并逐年模拟资产走势，给出耗尽概率与期末财富分布。同一种子 + 相同输入 → 结果完全可复现。` |
| `mc.chartNoteBootstrap` | `横轴为年份、纵轴单位为「万」；图中展示 {{count}} 条代表性抽样路径（浅色细线）与逐年中位数（粗线）。收益样本取自所选指数年度序列的有放回重抽（i.i.d.，忽略年份顺序）。同一种子 + 相同输入 → 结果完全可复现（契约保证）。` |

### 8.4 `sensitivity.*`（9 键）

| 键 | 简中文案 |
| --- | --- |
| `sensitivity.title` | `月开销敏感性` |
| `sensitivity.expand` | `展开` |
| `sensitivity.collapse` | `收起` |
| `sensitivity.plusTitle` | `调高月开销（更贵的生活）` |
| `sensitivity.minusTitle` | `调低月开销（更省的生活）` |
| `sensitivity.plusRow` | `+{{pct}}%` |
| `sensitivity.minusRow` | `−{{pct}}%` |
| `sensitivity.note` | `同一乘数下参考线与月开销线性同比例：月开销每变动 {{pct}}%，参考线约变动 {{delta}}；育儿、健康与重大投入预留不受月开销影响——「欲壑难填」在这里就是参考线的抬升幅度。` |
| `sensitivity.unavailable` | `当前实际回报率 ≤ 0，无法计算敏感性（请调整「核心参数」）。` |

### 8.5 `share.*`（6 键）

| 键 | 简中文案 |
| --- | --- |
| `share.copy` | `复制分享链接` |
| `share.copyTooltip` | `把当前全部业务输入（不含主题 / 语言 / 币种等界面偏好）编码进链接；粘贴给他人打开即为同一套参数。` |
| `share.copied` | `分享链接已复制到剪贴板` |
| `share.copyFailed` | `复制失败：请手动复制地址栏链接（含 #s= 的完整部分）` |
| `share.restored` | `已从分享链接恢复全部业务输入` |
| `share.restoreIgnored` | `分享链接内容无法识别（已忽略，显示默认参数）` |

### 8.6 `currency.noTimestamp`（1 键）

| 键 | 简中文案 |
| --- | --- |
| `currency.noTimestamp` | `数据不可用` |

**合计：1 + 33 + 14 + 9 + 6 + 1 = 64 键**（落在任务书预计的 55–70 区间）。

### 8.7 复用的既有键（不新增，直接引用）

`common.computing`、`units.yuan` / `units.yearUnit`、`mc.run` / `mc.running` / `mc.pathsYears` / `mc.medianTerminal` / `mc.p5` / `mc.p25` / `mc.p75` / `mc.p95`、`field.errorRange`。

---

## 9. README 双语增补点

### 9.1 功能特性表 +4 行

- **`README.md`**：插入位置 = 功能特性表「打工模拟」行之后（`README.md:127`）。行文本：

```markdown
| 社保养老金估算 | ✅ 已实现 | 简化两层公式（基础养老金 + 个人账户）估算退休后月养老金：当前/退休年龄、缴费年限与基数指数、账户余额估计；输出「调整后参考线」（月开销中被养老金覆盖的部分不再需要本金支撑）；面板内固定注明「简化估算，不构成社保咨询」 |
| 蒙特卡洛历史自助抽样 | ✅ 已实现 | 收益模式可选：正态参数（经典口径）或从沪深300 / 标普500 真实年度收益序列有放回重抽样（i.i.d.）；统计与图表口径与正态模式一致，同种子可复现 |
| 月开销敏感性 | ✅ 已实现 | 基础输出卡可展开 ±10% / ±20% / ±30% 三档月开销对应的财富自由参考线（复用基线计算逐档调用），量化「欲望对自由的影响」 |
| 场景分享链接 | ✅ 已实现 | 「复制分享链接」把全部业务输入（基础 / 反向 / 贷款 / 收租 / 蒙特卡洛 / 打工 / 税务 / 进度环 / 养老金）编码进 URL hash（版本号 + base64url）；打开链接自动恢复，损坏或版本不符静默忽略并提示 |
```

- **`README.en.md`**：插入位置 = 功能表「Work-years simulation」行之后（§`## ✨ Features`）。行文本：

```markdown
| Pension estimate | ✅ Done | Simplified two-layer formula (basic + individual account) estimates the monthly pension at retirement from current/retirement age, contribution years and base index, and an account-balance estimate; outputs an "adjusted reference line" (the expense share already covered by the pension no longer needs principal); the panel carries a fixed "simplified estimate, not social-security advice" notice |
| Monte Carlo historical bootstrap | ✅ Done | Return mode selectable: normal parameters (classic) or i.i.d. resampling from real annual return series of CSI 300 / S&P 500; statistics and chart conventions identical to the normal mode, same-seed runs reproducible |
| Expense sensitivity | ✅ Done | The base output card expands to show the reference line at ±10% / ±20% / ±30% monthly expense (re-running the baseline calculation per step), quantifying how appetite moves financial freedom |
| Scenario share link | ✅ Done | "Copy share link" encodes all business inputs (base / reverse / loan / rental / Monte Carlo / work-years / tax / progress ring / pension) into the URL hash (versioned + base64url); opening the link restores them; corrupt or unknown versions are silently ignored with a notice |
```

### 9.2 效果演示区 +4 图

- **`README.md`**：插入位置 = 既有 gifs 容器「色盲友好配色」块之后、`</div>` 之前（`README.md:67` 与 `README.md:69` 之间）。4 个块：

```markdown
### 社保养老金 · 退休后能领多少，参考线能降多少

![社保养老金演示](docs/assets/demo-pension.gif)

*面板⑦默认输入（30 岁 / 60 岁退休 / 30 年 / 指数 0.6 / 账户余额 5 万 / 社平 10,343 / 计发月数 139）：预计月养老金 ¥2,842.03（基础 ¥2,482.32 + 个人账户 ¥359.71），覆盖率 95%；调整后参考线从 ¥1,635,200 降至 ¥271,025.60；面板底部固定「简化估算，不构成社保咨询」*

### 蒙特卡洛 · 历史自助抽样

![历史自助抽样演示](docs/assets/demo-bootstrap.gif)

*收益模式切「历史自助抽样」：均值/标准差字段隐藏，选择沪深300（2005–2024 年度涨跌幅 20 个样本，价格指数口径）运行后耗尽概率与分布即时更新；切标普500（2005–2025 总回报 21 个样本）结果随之变化；同种子可复现*

### 月开销敏感性 · 欲望对自由的影响

![月开销敏感性演示](docs/assets/demo-sensitivity.gif)

*输出卡点「展开」：±10% / ±20% / ±30% 三档月开销对应参考线逐档刷新（月开销每变动 10%，参考线约变动 ¥143,520）；拖动「每月开销」输入，六档数值防抖跟随*

### 场景分享 · 一条链接带走全部参数

![场景分享演示](docs/assets/demo-share.gif)

*点「复制分享链接」→ 新窗口粘贴打开：基础 / 反向 / 贷款 / 收租 / 蒙特卡洛 / 打工 / 税务 / 进度环 / 养老金全部业务输入一键恢复并提示；手改 hash 后打开则提示「无法识别」并保持默认参数*
```

- **`README.en.md`**：插入位置 = gifs 容器 `</div>` 之前（英文演示区），四个对应英文块：

```markdown
### Pension estimate · How much you would draw, and how much lower the line gets

![Pension estimate demo](docs/assets/en/demo-pension.gif)

*Panel ⑦ with defaults (age 30, retiring at 60, 30 contribution years, base index 0.6, account balance 50k, average wage 10,343, divisor 139): expected monthly pension ¥2,842.03 (basic ¥2,482.32 + account ¥359.71), coverage 95%; the adjusted reference line drops from ¥1,635,200 to ¥271,025.60; a fixed "simplified estimate, not social-security advice" notice stays at the bottom*

### Monte Carlo · Historical bootstrap sampling

![Bootstrap demo](docs/assets/en/demo-bootstrap.gif)

*Switching the return mode to "historical bootstrap" hides the mean/std fields and offers CSI 300 (20 annual returns 2005–2024, price index) — depletion probability and distribution update instantly; switching to S&P 500 (21 total-return samples 2005–2025) changes the results; same-seed runs stay reproducible*

### Expense sensitivity · How appetite moves freedom

![Sensitivity demo](docs/assets/en/demo-sensitivity.gif)

*Clicking "Expand" on the output card shows the reference line at ±10% / ±20% / ±30% monthly expense (every 10% of expense moves the line by about ¥143,520); dragging the expense input refreshes all six rows with debounce*

### Scenario share · One link carries every input

![Share link demo](docs/assets/en/demo-share.gif)

*Clicking "Copy share link" and opening the URL in a new window restores every business input — base / reverse / loan / rental / Monte Carlo / work-years / tax / progress ring / pension — with a success notice; a tampered hash is ignored with a warning and defaults stay*
```

### 9.3 数据来源与口径表 +2 行（`README.md` / `README.en.md` 数据来源表）

简中（插入「居民消费 / 恩格尔系数（中国）」行之后）：

```markdown
| 指数年度收益序列 | 沪深300：年末收盘价复算（行情历史数据接口 zs_000300，2026-11-18 拉取，价格指数不含股息）；标普500：Slickcharts 年度总回报表（2026-11-18 读取，含股息再投资） | 沪深300 2005–2024 / 标普500 2005–2025，2026-11 查证 | 序列见 `src/data/indexSeries.ts`；沪深300 为价格口径（不含股息），自助抽样继承该口径 |
| 社保养老金参数 | 国家统计局：2024 年城镇非私营单位就业人员年平均工资 124,110 元（2025-05-16 发布）；个人账户计发月数（60 岁 139 / 55 岁 170 / 50 岁 195，国发〔2005〕38号附表通行口径） | 2024 年工资数据，2026-11-18 查证；计发月数为长期口径（50/55 档待复核法规原文） | 简化估算不代表实际待遇，见面板免责文案；参数见 `src/data/pensionParams.ts` |
```

英文对应行（`README.en.md` 数据来源表同步翻译）。

### 9.4 演示素材清单（同步方录制，入 `docs/assets/`）

| 文件 | 界面语言 | 内容 |
| --- | --- | --- |
| `docs/assets/demo-pension.gif` | 简中 | 面板⑦默认输入自动出结果 → 改退休年龄看计发月数联动 → 覆盖率 >100% 场景 |
| `docs/assets/demo-bootstrap.gif` | 简中 | 蒙特卡洛切自助抽样 → 沪深300 运行 → 切标普500 对比 |
| `docs/assets/demo-sensitivity.gif` | 简中 | 输出卡展开敏感性 → 改月开销六档联动 |
| `docs/assets/demo-share.gif` | 简中 | 复制链接 → 新窗口恢复 → 改坏 hash 的忽略提示 |
| `docs/assets/en/…`（同名 4 文件） | English | 同上（英文界面） |

素材口径与既有演示一致：**真实运行画面**（构建产物截图/录屏，非设计稿）；`README.md:111-112` 素材清单 NOTE 顺带补入新文件名。

---

## 10. 样式增量（`src/styles/global.css`，界面方）

追加区块（全部走既有令牌，禁止裸写字面量时长/曲线/颜色；命名对照既有 `wf-mc-actions` / `wf-preset-bar` 布局模式）：

```css
/* ===== P1 冲刺：社保养老金 / 历史自助抽样 / 欲望敏感性 / 场景分享 ===== */
.wf-mc-mode { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.wf-sens-toggle { margin-top: 8px; }
.wf-sens-block { margin-top: 8px; }
.wf-sens-group { margin-top: 8px; }
.wf-sens-rows { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; font-variant-numeric: tabular-nums; }
.wf-sens-row { display: flex; justify-content: space-between; gap: 8px; }
.wf-sens-note { margin-top: 8px; }
.wf-share-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
```

另有 §2.4（A4）的等宽数字规则块（落位「布局与既有修复区」之后、上示 P1 区块之前均可）：

```css
.wf-amortize-table,
.wf-realtime {
  font-variant-numeric: tabular-nums;
}
```

---

## 11. 总验收与回归命令

```bash
cargo test --manifest-path src/wasm/Cargo.toml                      # §7 测试 + 既有回归原样通过
wasm-pack build src/wasm --target web --out-dir pkg --release       # 产物再生成（核心方）
npm run build                                                        # tsc --noEmit + vite build（strict 通过）
npm run check:size                                                   # 尺寸门禁（wasm 增量后仍须最大 .wasm ≤ 800KB）
```

中性命名自查（§1.3）与设计打磨验收（§2.1–2.4 各条）逐项执行；手动验收：§3.7 / §4.7 / §5.2 / §6.4 四张清单逐项勾验；三语切换下新增界面无键缺失（i18next 控制台无 missing key 警告）。

---

## 12. 决策记录（与任务书的差异与理由）

1. **养老金落 wasm（`estimate_pension`）而非纯 TS**：任务书允许二选一。选 wasm 与「金额计算在核心」原则一致——调整后参考线涉及乘数舍入链路（`round2(12 ÷ 实际回报率小数)` 先舍入后相乘），与 `calculate_baseline` 的一致性必须由同一实现保证（§7 一致性测试锁定恒等式），TS 复算必然形成第二实现。
2. **`PensionInput extends BaselineInput`**：任务书要求「调整后参考线（月开销中被养老金覆盖的部分降低临界值）」。让养老金函数直接复用基础卡当前值（单一事实来源），面板不复制 7 个基础字段——否则出现两份月开销/回报率输入，用户改基础卡时养老金面板口径漂移。
3. **社平工资不做增长假设**：任务书允许「大胆简化 + 诚实标注」。真实公式中「退休时上年度社平工资」随经济增长，本工具按用户填入值直接代入并在面板 `formulaNote` / `resultNote` 与 README 局限中如实标注；数据层锚点取全国非私营口径并提示按省市计发基数修改（私营口径 69,476 元/年显著更低，已注明）。
4. **`series` 单位百分点 + plain `Vec<Decimal>` 字段**：与 MC 其余输入同单位，契约整体一致；rust_decimal 默认 `Deserialize`（`deserialize_any` → `DecimalVisitor::visit_map`，serde.rs:372）承接 serde_json arbitrary_precision 的数字字面量——本规范撰写时已在临时 crate 以同版本实证（字面量精确解析、非法元素报错），非纸面推断。
5. **bootstrap 模式保留均值/标准差字段但忽略**：任务书要求「其余同现有蒙特卡洛」——契约形状完全一致（`MonteCarloInput & { series }`），两字段照常校验（σ > 0）但不参与计算；契约文字、面板说明与 README 三处如实注明，避免「填了却没用」的静默困惑。
6. **沪深300 采用价格指数口径**：任务书要求「年度总回报序列 + 数值必须查证」。沪深300 全收益（H00300）序列无法在本会话可靠查证，价格指数 20 年序列已按原始年末收盘价独立复算并交叉印证——如实录入价格口径并在数据层/UI/README 三处标注「不含股息，略低估总回报」，不编造股息调整值；标普500 为总回报口径（Slickcharts 全表），两序列口径差异在 UI 序列注中显式区分（`mc.seriesPriceOnly` / `mc.seriesTotalReturn`）。
7. **分享链接不含币种**：币种是展示换算偏好（任务书点名不含界面偏好），且金额数值本身与币种无关（全站口径）；`activePresetId` 亦不携带（恢复后置 `"custom"`——画像 id 非业务输入）。
8. **税务切片边界**：store 只承载 `taxInputs`（收入/扣除/税档）；国别选择与手工税率是 `TaxPanel.tsx:47-49` 的本地 state，不属业务输入切片——本次不扩大 store 范围，README 与契约注明该边界。
9. **敏感性展开才计算**：六路 `calcBaseline` 调用极轻（毫秒级 wasm 往返），但折叠态零调用的纪律避免每次输入变更的冗余计算；展开态随输入防抖 300ms 重算，与全站防抖节拍一致。
10. **锚点数值来源**：§7 全部锚点（P-A/P-B/P-C/B-D/B-E）为本规范撰写时以 Node.js 按公式验算的执行结果；P-B 额外验证了与 `calculate_baseline` 的恒等式（两值均为 2,467,987.20）。测试代码内同时内联公式复算与锚点断言，不依赖手算。
11. **计发月数仅收录 50/55/60 三档**：60 岁 139 已独立印证；50/55 为通行表值但本会话未取得法规原文（gov.cn 历史档案链接已失效）——按「查不到可靠来源就降低主张」原则，数据文件注明待复核，面板联动只在这三档生效（其他退休年龄回落用户手填值）。
12. **README 数据来源表 +2 行**超出任务书列举的「特性表 +4 行、演示区 +4 图」：新数据（指数序列 / 养老金参数）进入应用，按既有「各数据在 src/data/** 均以结构化 source/year/note 随页面展示」纪律必须登记来源——属任务书增补点的自然完成，非扩权。
