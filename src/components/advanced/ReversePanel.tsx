/**
 * ① 反向估算：已有资产 → 扣除各项预留 → 反推每月可放心花费与可维持年数。
 * 文案经 react-i18next 三语化。
 */
import { Alert, Button, Descriptions, Message, Tooltip, Typography } from "@arco-design/web-react";
import { IconLock } from "@arco-design/web-react/icon";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { calcReverse } from "../../services/finance";
import { formatNumber } from "../../services/format";
import type { ReverseEstimateInput } from "../../wasm/bridge";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { effectiveReverse, reverseUnlockPatch } from "../../store/effectiveInputs";
import { AmountField, FieldRow, FieldTip, PercentField } from "../fields";
import { SegBar, SlotBox, SlotPager } from "../slots";
import { useAnimatedNumber, useFinanceCall, useIsCompactViewport, useIsNarrowViewport, useIsWorkbenchViewport, useMoney, useShortViewport } from "../hooks";

const { Text } = Typography;

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

/**
 * 反向估算六字段（P10 §8 尺寸回收：pro 完整面板与 F8 反向卡共用同一字段组，
 * 两列栅格由 twoUp 统一承载——pro 叶槽化后同为两列紧凑口径，单列旧形态退役登记）。
 * 须置于 FieldRow / .wf-slot-fields 内渲染（子元素为 Col）。
 * 骨架修复轮：分页切片双形态——`half`（旧 3+3 两页）与 `page/perPage`（编辑态分页
 * 粒度档位化：矮视口档 2 字段/页 × 3 页，使反向卡 190 档内可达，F2 修复轮）。
 */
function ReverseFields({ twoUp, half, page, perPage = 2 }: { twoUp: boolean; half?: 0 | 1; page?: number; perPage?: 2 | 3 }) {
  const { t } = useTranslation();
  const inputs = useCalculatorStore((s) => s.reverseInputs);
  const setInputs = useCalculatorStore((s) => s.setReverseInputs);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const { symbol, display } = useMoney(displayCode);
  const rate = display.rate;
  /** P10fix §3.2 普查 #1–#5：reverseSynced 锁态（默认 true）五字段取 baseline 派生直显
   *  （childReserve = 子女数 × 单孩成本，childCount=0 → 0 恒显示不隐藏；其余四字段直取
   *  同名值）——disabled + 尾部锁标（mcMeansSynced 模板）；解锁 = 显式动作同时把当刻
   *  核心值落入切片（reverseUnlockPatch 快照，消除「解锁即见旧值」错位）。totalAssets
   *  非重复字段恒可编。预设联动口径（§3.3）：applyPreset 只写 baseline，锁态显示层
   *  即时跟随派生值——预设后任何宿主不再出现与预设矛盾的「子女预留 ¥580000.00」残留 */
  const reverseSynced = useCalculatorStore((s) => s.reverseSynced);
  const setSyncFlag = useCalculatorStore((s) => s.setSyncFlag);
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  /** 锁标（解锁触发点；五字段共用同一按钮元素）——aria 三语键复用 mc.meanSync*（§11.2 降档登记） */
  const lockButton = (
    <Button
      size="mini"
      type="text"
      className="wf-pressable"
      aria-label={t("mc.meanSyncLockAria")}
      icon={<IconLock />}
      onClick={() => {
        setSyncFlag("reverseSynced", false);
        setInputs(reverseUnlockPatch(baseline));
      }}
    />
  );
  const moneySuffix = displayCode === "CNY" ? t("units.yuan") : undefined;
  /** 锁态显示对象：effectiveReverse 单源派生（锁态五字段 = baseline 派生值、解锁态 =
   *  切片原值）——字段 value 直读显示对象，与 calcReverse 调用同一真源 */
  const disp = effectiveReverse(inputs, baseline, reverseSynced);
  /** P10fix 偏差登记（§8 红线 7 口径 + 尺寸门禁降档）：五字段不渲染可见 hint——
   *  ReverseCard 恒高 228/170（overflow:hidden、编辑分页 2 字段/页 ≤170）容不下每字段
   *  +20px hint 行；锁 affordance 为可见 icon 锁标按钮（aria-label = mc.meanSyncLockAria，
   *  非 title-only——可聚焦控件自带可访问名），语义与 MC 两均值字段可见 hint 同键同源。
   *  44 命中、tab 键盘序不受影响。 */
  /** 锁态后缀复用（金额三字段/百分比两字段各自同 suffix——锁定即锁标） */
  const moneySuffixLocked = reverseSynced ? lockButton : moneySuffix;
  const pctSuffix = reverseSynced ? lockButton : "%";
  const span = twoUp ? { xs: 12, md: 12 } : { md: 24 };
  const all = [
    <AmountField
      key="ta"
      {...span}
      label={t("reverse.totalAssets")}
      tooltip={t("reverse.totalAssetsTooltip")}
      value={inputs.totalAssets}
      onChange={(v) => setInputs({ totalAssets: v })}
      prefix={symbol}
      suffix={moneySuffix}
      convertRate={rate}
    />,
    <AmountField
      key="cr"
      {...span}
      label={t("reverse.childReserve")}
      tooltip={t("reverse.childReserveTooltip")}
      value={disp.childReserve}
      onChange={(v) => setInputs({ childReserve: v })}
      disabled={reverseSynced}
      prefix={symbol}
      suffix={moneySuffixLocked}
      convertRate={rate}
    />,
    <AmountField
      key="hr"
      {...span}
      label={t("common.healthReserve")}
      tooltip={t("common.healthReserveTooltip")}
      value={disp.healthReserve}
      onChange={(v) => setInputs({ healthReserve: v })}
      disabled={reverseSynced}
      prefix={symbol}
      suffix={moneySuffixLocked}
      convertRate={rate}
    />,
    <AmountField
      key="mi"
      {...span}
      label={t("common.majorInvestment")}
      tooltip={t("common.majorInvestmentTooltip")}
      value={disp.majorInvestment}
      onChange={(v) => setInputs({ majorInvestment: v })}
      disabled={reverseSynced}
      prefix={symbol}
      suffix={moneySuffixLocked}
      convertRate={rate}
    />,
    <PercentField
      key="nr"
      {...span}
      label={t("common.nominalReturn")}
      tooltip={t("common.nominalReturnTooltip")}
      value={disp.nominalReturnPct}
      onChange={(v) => setInputs({ nominalReturnPct: v })}
      disabled={reverseSynced}
      suffix={pctSuffix}
    />,
    <PercentField
      key="if"
      {...span}
      label={t("common.inflation")}
      tooltip={t("common.inflationTooltip")}
      value={disp.inflationPct}
      onChange={(v) => setInputs({ inflationPct: v })}
      disabled={reverseSynced}
      suffix={pctSuffix}
    />,
  ];
  if (half !== undefined) return <>{all.slice(half * 3, half * 3 + 3)}</>;
  if (page !== undefined) return <>{all.slice(page * perPage, page * perPage + perPage)}</>;
  return <>{all}</>;
}

export default function ReversePanel() {
  const { t } = useTranslation();
  /** S18 可见性闸宿主（hooks.ts useAnimatedNumber）：hidden/视口外暂停 rAF（§6 红线 2） */
  const hostRef = useRef<HTMLDivElement>(null);
  const inputs = useCalculatorStore((s) => s.reverseInputs);
  const setInputs = useCalculatorStore((s) => s.setReverseInputs);
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  /** P10fix §3.2：reverseSynced 口径标志（显示层与计算调用统一消费 effectiveInputs.ts
   *  派生——单一真源，锁态五字段 = baseline 派生值） */
  const reverseSynced = useCalculatorStore((s) => s.reverseSynced);
  const setSyncFlag = useCalculatorStore((s) => s.setSyncFlag);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：展示币种符号 + 换算率；rate null = 符号-only */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;

  /** P10fix §3.2：calcReverse 调用点统一消费 effectiveReverse 派生（锁态五字段 = 核心参数
   *  派生，运行即所显示值——「同一值、同一帧」先例同构）；解锁态 = 切片原值。
   *  deps 用切片对象与原始值（锁态派生对象每渲染新建，不得入 deps——useFinanceCall
   *  effect 依赖数组要求稳定标识，runner 内派生保证提交帧取当刻 baseline 现值） */
  const { loading, result } = useFinanceCall(
    () => calcReverse(effectiveReverse(inputs, baseline, reverseSynced)),
    [inputs, baseline, reverseSynced],
  );
  /** 窄视口下结果 Descriptions 切纵向堆叠（标签上/值下），避免长 label 挤压数值列 */
  const isNarrow = useIsNarrowViewport();
  /** 深矮档（H<850）：桌面整叶在矮视口贴线/溢出（第 3 轮验收 1366×620 zh dark pro:init
   *  页根 500>460 实测——整叶内容与页框等高，任何 ±1px 抖动即溢出+回退闪现）——
   *  深矮档并入窄档分页承载（槽内四页），内容压至页框内稳定零滚动 */
  const isShort = useShortViewport();
  /** V2（第 1 轮视觉验收 P0）：双栏右栏容器 ~596px，viewport 级 md:3 横排内容宽
   *  748px 溢出被 tabs 裁切层静默裁掉（「回报杠杆年限 4.8 年」整列不可见）。
   *  ≥1200 双栏激活时切单列键值行（label|value 逐行纵排，最长 label ~250px 容得下）；
   *  <768 行为不变（layout vertical + xs:1），768–1199 单列形态容器宽维持 md:3。 */
  const isWorkbench = useIsWorkbenchViewport();

  const data = result?.ok === true ? result.data : null;
  const error = result && !result.ok ? result.error : null;
  /** S18 面板主数渐近滚动（p6-spec §2）：防抖落定值经渐近收敛呈现；rAF 中间帧只进
   *  显示值、永不进 store（§6 红线 2）；reduced-motion / 首值 / 非有限数由 hook 内建短路 */
  const animatedSustainable = useAnimatedNumber(data?.sustainableMonthly ?? 0, undefined, hostRef);
  /** F-02 窄档槽内分页页码（仅 <768 分支消费；跨档停留页码越界由 safeRevPage 钳制） */
  const [revPage, setRevPage] = useState(0);

  /** 与基础模式同步预留与回报假设（数值全部来自 store，不写死） */
  const syncFromBaseline = () => {
    setInputs({
      childReserve: baseline.childCount * baseline.costPerChild,
      healthReserve: baseline.healthReserve,
      majorInvestment: baseline.majorInvestment,
      nominalReturnPct: baseline.nominalReturnPct,
      inflationPct: baseline.inflationPct,
    });
  };

  /** 共享渲染块（F-02 窄档分页与桌面整叶两分支复用，同源单一实现）：
   *  ① 算例行（P5 §5：两条算例口径注全文下沉 FieldTip，键零增删）；
   *  ② 同步钮（F-4 配套：下距 12→6，深矮档 pro pane 5–24px 裁切的面板内构成行收敛）；
   *  ③ 恢复联动钮（P10fix §3.2：解锁态渲染，置回锁态字段即回派生显示）；
   *  ④ 读数块（loading/读数/错误/口径注——P7/D 永续警示全文归 tooltip，§8.2 模板句）。 */
  const exampleBar = (
    <div className="wf-example-bar">
      <Text type="secondary">
        {t("reverse.exampleLegend")}
        <FieldTip text={`${t("reverse.exampleNote")} ${t("reverse.exampleBNote")}`} />
      </Text>
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
  );
  const syncButton = (
    <Button size="small" style={{ marginBottom: 6 }} onClick={syncFromBaseline} className="wf-pressable">
      {t("reverse.syncButton")}
    </Button>
  );
  const restoreButton = !reverseSynced ? (
    <Button size="small" style={{ marginBottom: 6 }} onClick={() => setSyncFlag("reverseSynced", true)} className="wf-pressable">
      {t("mc.meanSyncRestore")}
    </Button>
  ) : null;
  const resultsBlock = (
    <>
      {loading ? <Text type="secondary">{t("common.computing")}</Text> : null}
      {data ? (
        <Descriptions
          border
          size="small"
          layout={isNarrow ? "vertical" : "horizontal"}
          column={isNarrow || isWorkbench ? 1 : { xs: 1, md: 3 }}
          data={[
            { label: t("reverse.investable"), value: money(data.investableAssets) },
            {
              label: t("reverse.sustainableMonthly"),
              value: (
                <Text bold className="wf-nowrap">{money(animatedSustainable)}</Text>
              ),
            },
            {
              label: t("reverse.leverageYears"),
              value: (
                <Tooltip content={t("reverse.leverageTooltip")}>
                  <span>{formatNumber(data.yearsSupported, 1)} {t("units.yearUnit")}</span>
                </Tooltip>
              ),
            },
          ]}
        />
      ) : null}
      {error ? <Alert type="error" style={{ marginTop: 8 }} content={error} /> : null}
      <Text type="secondary" className="wf-panel-note">
        {t("reverse.note")}
        <FieldTip text={t("reverse.perpetuityWarning")} />
      </Text>
    </>
  );

  /** 第 1 轮验收 F-02：窄档（<768）整叶承载退役，改槽内分页（§2.5-8 路线）——375 宽
   *  整叶内容 689（zh）/821+（en）实测超活动面板根 199/476 被组件库 overflow:hidden
   *  静默裁切（60/60 在册格 pro:init / pro:radio:人生规划 逐格复现）。四页等高互换：
   *  页 0/1 = 六字段 2 页×3（两列，ReverseFields page/perPage 既有切片）、页 2 = 算例
   *  与同步/恢复、页 3 = 读数与口径注——信息路径零丢失。≥768 整叶承载不变（桌面预算
   *  在册：1366×650 en 337 ≤ pane 343）。 */
  if (isNarrow || isShort) {
    const safeRevPage = Math.min(revPage, 3);
    return (
      <div ref={hostRef}>
        <SlotBox height={200}>
          <div className="wf-slot-body">
            {safeRevPage <= 1 ? (
              <FieldRow className="wf-slot-row">
                <ReverseFields twoUp page={safeRevPage} perPage={3} />
              </FieldRow>
            ) : safeRevPage === 2 ? (
              <>
                {exampleBar}
                {syncButton}
                {restoreButton}
              </>
            ) : (
              resultsBlock
            )}
            <SlotPager label={t("advanced.reverseTitle")} total={4} page={safeRevPage} onPage={setRevPage} />
          </div>
        </SlotBox>
      </div>
    );
  }

  return (
    <div ref={hostRef}>
      <FieldRow>
        {/* P10 §8：字段组共享（pro 叶槽化后同为两列紧凑口径，单列旧形态退役登记） */}
        <ReverseFields twoUp />
      </FieldRow>
      {exampleBar}
      {syncButton}
      {restoreButton}
      {resultsBlock}
    </div>
  );
}

/**
 * P10 §1.1 F8 反向估算卡（卡内双态「估算结果 ⇄ 编辑参数」：结果态恒高 228，编辑态
 * min-height 228 起步可生长——第 3 轮验收 F-02，修订对照轮二⑧：
 * 整卡实高 ≈540/558 不可容于 F8 槽 280 与右列，故改卡内双态等高互换，信息路径零丢失：
 * 读数 / 编辑 / 算例 / 同步全量可达，一次卡内切换）。宿主为 freedom 叶B F8 槽（<1200）
 * 与桌面右列（≥1200）；pro 页仍用上方完整 ReversePanel（整叶承载，不加槽）。
 * S18 可见性闸宿主随卡容器重挂（p10-spec §6-S18 迁移落点）。
 * 编辑态字段分页两页（每页 3 字段两列 = 2 行）＋末页同步钮与算例按钮（算例图例全文下沉
 * FieldTip——P5 冗长治理口径）；页码切换复用组件库 Pagination mini（零新交互词汇）。
 */
const REVERSE_CARD_HEIGHT = 228;
/** 矮视口档（高度 <850）卡高：170 = 双栏右列在 1200×800（可用 656）内页栈回预算并
 *  给主槽留 ≥200 图位（F2 修复轮档位压缩登记：结果态 148 / 编辑态 3 页×2 字段
 *  138 ≤ 170；口径注 sr-only 零布局高度） */
const REVERSE_CARD_HEIGHT_SHORT = 170;

export function ReverseCard() {
  const { t } = useTranslation();
  /** S18 可见性闸宿主（hooks.ts useAnimatedNumber）：hidden/视口外暂停 rAF（§6 红线 2） */
  const hostRef = useRef<HTMLDivElement>(null);
  const inputs = useCalculatorStore((s) => s.reverseInputs);
  const setInputs = useCalculatorStore((s) => s.setReverseInputs);
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  /** P10fix §3.2：reverseSynced 口径标志（读数与编辑两态同源——calcReverse 消费
   *  effectiveReverse 派生；叶B F8 槽与桌面右列两宿主共用） */
  const reverseSynced = useCalculatorStore((s) => s.reverseSynced);
  const setSyncFlag = useCalculatorStore((s) => s.setSyncFlag);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;
  // P10fix §3.2：calcReverse 消费 effectiveReverse 派生（读数态即锁态派生值；deps 切片
  // 对象 + 原始标志——派生对象每渲染新建不得入 deps，runner 内取当刻 baseline 现值）
  const { loading, result } = useFinanceCall(
    () => calcReverse(effectiveReverse(inputs, baseline, reverseSynced)),
    [inputs, baseline, reverseSynced],
  );
  const data = result?.ok === true ? result.data : null;
  const error = result && !result.ok ? result.error : null;
  const animatedSustainable = useAnimatedNumber(data?.sustainableMonthly ?? 0, undefined, hostRef);
  const [view, setView] = useState<"result" | "edit">("result");
  const [editPage, setEditPage] = useState(0);
  /** ≤480 紧档：口径注全文下沉 FieldTip（P5 口径；槽 260 内与 Descriptions 共存） */
  const isCompact = useIsCompactViewport();
  /** 矮视口档（hooks useShortViewport）：卡 190 + 编辑分页 3 页×2 字段 + 口径注视觉隐藏
   *  （sr-only，读屏可达——1200×800 双栏右列页栈回预算，F2 修复轮） */
  const isShort = useShortViewport();
  /** 编辑分页总数随档位变化（2↔3），页码越界钳制（跨档停留不悬空） */
  const editTotal = isShort ? 3 : 2;
  const safeEditPage = Math.min(editPage, editTotal - 1);

  const syncFromBaseline = () => {
    setInputs({
      childReserve: baseline.childCount * baseline.costPerChild,
      healthReserve: baseline.healthReserve,
      majorInvestment: baseline.majorInvestment,
      nominalReturnPct: baseline.nominalReturnPct,
      inflationPct: baseline.inflationPct,
    });
  };

  return (
    <div
      ref={hostRef}
      className="wf-reverse-card"
      style={
        view === "edit"
          ? /* 第 3 轮验收 F-02：编辑态 min-height 替代固定 height——en 双行字段标签
             * 等内容增高时卡随之生长（sh==ch 恒成立，杜绝溢出裁切；结果态仍固定高
             * ——读数内容定高确定性强） */
            { minHeight: isShort ? REVERSE_CARD_HEIGHT_SHORT : REVERSE_CARD_HEIGHT }
          : { height: isShort ? REVERSE_CARD_HEIGHT_SHORT : REVERSE_CARD_HEIGHT }
      }
    >
      <SegBar
        name="wf-reverse-card-view"
        ariaLabel={t("advanced.reverseTitle")}
        value={view}
        onChange={(v: string) => setView(v as "result" | "edit")}
        options={[
          { value: "result", label: t("reverse.viewResult") },
          { value: "edit", label: t("reverse.editParams") },
        ]}
      />
      {view === "result" ? (
        <div className="wf-reverse-card-body">
          {loading ? <Text type="secondary">{t("common.computing")}</Text> : null}
          {data ? (
            <Descriptions
              border
              size="small"
              column={1}
              tableLayout="fixed"
              data={[
                { label: t("reverse.investable"), value: money(data.investableAssets) },
                {
                  label: t("reverse.sustainableMonthly"),
                  value: (
                    <Text bold className="wf-nowrap">{money(animatedSustainable)}</Text>
                  ),
                },
                { label: t("reverse.leverageYears"), value: `${formatNumber(data.yearsSupported, 1)} ${t("units.yearUnit")}` },
              ]}
            />
          ) : null}
          {error ? <Alert type="error" style={{ marginTop: 4 }} content={error} /> : null}
          {/* 第 2 轮验收 F-02：口径注全档 sr-only（读屏可达、零布局高度——ReverseCard
              固定高 228/170 容不下 en 两行注，1440×900 实测裁 39/111px；全文含永续
              警示由 sr-only 文本承载，FieldTip 触发点随注一并隐去避免不可见聚焦靶） */}
          <Text type="secondary" className="wf-panel-note wf-sr-only">
            {t("reverse.note")} {t("reverse.perpetuityWarning")}
          </Text>
        </div>
      ) : (
        <div className="wf-reverse-card-body">
          <div className="wf-slot-fields">
            {/* 编辑态字段分页（档位化：常规 2 页×3 字段 / 矮视口档 3 页×2 字段——
                F2 修复轮；切片语义见 ReverseFields page/perPage） */}
            <ReverseFields twoUp page={safeEditPage} perPage={isShort ? 2 : 3} />
            {safeEditPage === editTotal - 1 ? (
              <div className="wf-reverse-card-actions">
                {/* 算例两钮 + 同步钮（图例全文下沉 FieldTip——P5 冗长治理口径） */}
                {REVERSE_EXAMPLES.map((example) => (
                  <Button
                    key={example.id}
                    size="mini"
                    className="wf-pressable"
                    onClick={() => {
                      setInputs(example.inputs);
                      Message.success(t("reverse.exampleApplied", { name: t(example.nameKey) }));
                    }}
                  >
                    {t(example.nameKey)}
                  </Button>
                ))}
                <Button size="mini" type="primary" onClick={syncFromBaseline} className="wf-pressable">
                  {t("reverse.syncButton")}
                </Button>
                {/* P10fix §3.2：一键恢复联动（reverseSynced 解锁态渲染；叶B 卡内页末同位） */}
                {!reverseSynced ? (
                  <Button size="mini" onClick={() => setSyncFlag("reverseSynced", true)} className="wf-pressable">
                    {t("mc.meanSyncRestore")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {/* 编辑态字段分页（2 页×3 字段 / 矮档 3 页×2 字段）；槽内分页器零新交互词汇 */}
          <SlotPager label={t("reverse.editParams")} total={editTotal} page={safeEditPage} onPage={setEditPage} />
        </div>
      )}
    </div>
  );
}
