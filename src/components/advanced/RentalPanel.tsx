/**
 * ③ 买房收租：房价 / 首付 / 利率年限 / 租金与持有成本 → 年度净现金流 + 回本年限。
 * 城市参数预设来自 src/data/rentParams.ts，按「中国一线 / 中国二线 / 国际一线 / 国际门户」
 * 四档分组展示，并在下拉旁附各档参照城市图例；文案经 react-i18next 三语化。
 */
import { Alert, Descriptions, Select, Tag, Typography } from "@arco-design/web-react";
import { useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Customized,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { calcRental } from "../../services/finance";
import { formatNumber, formatCompactAxis } from "../../services/format";
import { cnyToDisplay } from "../../services/currency";
import { LIMITS, MOTION_DURATIONS, resolveThemeTokens } from "../../data/defaults";
import { CITY_RENT_PARAMS } from "../../data/rentParams";
import type { CityGroup, CityName, CityRentParams } from "../../data/types";
import type { NumberInputLimit } from "../../data/types";
import type { RentalBreakdown } from "../../wasm/bridge";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { AmountField, FieldRow, FieldTip, IntField, NumberField, PercentField } from "../fields";
import { useFinanceCall, useIsNarrowViewport, useMoney, usePrefersReducedMotion } from "../hooks";

const { Text } = Typography;

/** 贷款年限 UI 限额（数据层 LIMITS 集中维护） */
const LOAN_YEARS_LIMIT = LIMITS.loanYears;

/**
 * 租金税率限额：数据层城市预设含 0%（如迪拜无个人所得税），
 * 故在 LIMITS.percent 基础上把下限放宽到 0，其余沿用数据层限额。
 */
const RENT_TAX_LIMIT: NumberInputLimit = {
  min: 0,
  max: LIMITS.percent.max,
  step: LIMITS.percent.step,
  precision: LIMITS.percent.precision,
};

/**
 * 瀑布图数据行（docs/p2-spec.md §6.3 C3：堆叠透明底段法——透明定位段 + 彩色变动段；
 * recharts/d3 的 stackOffsetNone 为单累加器口径：同列内正负值共用一条累计线，
 * 故每列至多一个定位段 + 一个彩色段，跨零列以负定位段 + 正彩色段表达）。
 */
interface WaterfallRow {
  key: string;
  /** 列名（i18n，复用 rental.breakdown.* 键） */
  name: string;
  /** 透明定位段·正侧（≥ 0） */
  basePos: number;
  /** 透明定位段·负侧（≤ 0） */
  baseNeg: number;
  /** 彩色段·涨色系列（增加柱 / 从零起合计柱） */
  riseSeg: number;
  /** 彩色段·跌色系列（扣减柱 / 负值合计柱） */
  fallSeg: number;
  /** 该列彩色段所在系列（标签渲染位；null = 无彩色段不渲染标签） */
  carrier: "riseSeg" | "fallSeg" | null;
  /** 合计柱 = 主色、扣减柱 = 跌色（C3 ②三角色配色；本图无增加柱，涨色系列保留通用性） */
  color: "primary" | "fall";
  /** 标签位置：柱顶（上） / 柱底（下）自适应（C3 ④） */
  labelSide: "top" | "bottom";
  /** 标签文本：变动柱带符号金额 / 合计柱累计值 */
  labelText: string;
  /** 该列结束时的累计位（连接线层位） */
  endLevel: number;
}

/** LabelList content 回调的形状（recharts 未导出精确类型，此处窄化已知字段） */
interface BarLabelShape {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
}

/** Customized 注入的图表坐标形状（窄化本图用到的字段；scale 为 d3 刻度函数） */
interface WfBandScale {
  (value: string): number;
  bandwidth?: () => number;
}
interface WfLinearScale {
  (value: number): number;
}
interface WfChartFrame {
  xAxisMap?: Record<string, { scale?: unknown }>;
  yAxisMap?: Record<string, { scale?: unknown }>;
}

/**
 * 瀑布图列序（C3 ①）：毛租金（起，从零起）→ −空置 → 有效租金（小计，从零起）→
 * −租金税 → −维护 → −物业 → −其他（值为 0 不渲染）→ −年供款 → 净现金流（终，从零起）。
 * 合计 / 起 / 终不参与累计；首付 / 贷款金额为一次性金额，不入年度现金流瀑布。
 * breakdown 契约类型为 Record<string, number>（键集以 RentalBreakdown 接口为准），
 * 读取按「不信任 JSON 解析结果」纪律防御取值（缺键 / 非有限数按 0）。
 * ⑤ 数值与标签经 convert / fmt（展示币种换算）——率 > 0 为线性缩放，几何形状不变。
 */
function buildWaterfallRows(
  b: Record<string, number>,
  net: number,
  convert: (v: number) => number,
  fmt: (v: number) => string,
  label: (key: string) => string,
): WaterfallRow[] {
  const numOf = (key: string): number => {
    const v = b[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  const rows: WaterfallRow[] = [];
  let cum = 0;
  const blank = (key: string, name: string): WaterfallRow => ({
    key,
    name,
    basePos: 0,
    baseNeg: 0,
    riseSeg: 0,
    fallSeg: 0,
    carrier: null,
    color: "primary",
    labelSide: "top",
    labelText: "",
    endLevel: cum,
  });

  // 合计柱（从零起）：值 > 0 走涨色系列，< 0 走跌色系列；标签 = 累计值
  const pushTotal = (key: string, name: string, value: number, endLevel: number): void => {
    const row = blank(key, name);
    row.endLevel = endLevel;
    row.labelText = fmt(value);
    if (value > 0) {
      row.riseSeg = value;
      row.carrier = "riseSeg";
      row.color = "primary";
      row.labelSide = "top";
    } else if (value < 0) {
      row.fallSeg = value;
      row.carrier = "fallSeg";
      row.color = "primary";
      row.labelSide = "bottom";
    }
    rows.push(row);
  };
  // 扣减柱：值 = 0 该列不渲染（C3 ①）；跨零列（累计转负）以负定位段 + 正彩色段表达
  const pushDec = (key: string, name: string, amount: number): void => {
    if (amount === 0) return;
    const start = cum;
    const end = cum - amount;
    cum = end;
    const row = blank(key, name);
    row.endLevel = end;
    row.color = "fall";
    row.labelSide = "bottom";
    row.labelText = `−${fmt(amount)}`;
    row.carrier = "fallSeg";
    if (end >= 0) {
      row.basePos = end;
      row.fallSeg = amount;
    } else if (start <= 0) {
      row.baseNeg = start;
      row.fallSeg = end - start;
    } else {
      row.baseNeg = end;
      row.fallSeg = start - end;
    }
    rows.push(row);
  };

  pushTotal("gross", label("rental.breakdown.annualGrossRent"), convert(numOf("annualGrossRent")), convert(numOf("annualGrossRent")));
  cum = convert(numOf("annualGrossRent"));
  pushDec("vacancy", label("rental.breakdown.annualVacancyLoss"), convert(numOf("annualVacancyLoss")));
  pushTotal("effective", label("rental.breakdown.annualEffectiveRent"), cum, cum);
  pushDec("tax", label("rental.breakdown.annualRentTax"), convert(numOf("annualRentTax")));
  pushDec("maintenance", label("rental.breakdown.annualMaintenance"), convert(numOf("annualMaintenance")));
  pushDec("property", label("rental.breakdown.annualPropertyFee"), convert(numOf("annualPropertyFee")));
  pushDec("other", label("rental.breakdown.annualOtherCost"), convert(numOf("annualOtherCost")));
  pushDec("loan", label("rental.breakdown.annualLoanPayment"), convert(numOf("annualLoanPayment")));
  pushTotal("net", label("rental.annualNetCashFlow"), convert(net), convert(net));
  return rows;
}

/** 城市分组的展示顺序：中国城市四档在前，国际城市两组在后（下拉按分区 OptGroup 展示） */
const GROUP_ORDER: CityGroup[] = [
  "cn-tier1",
  "cn-tier2",
  "cn-tier3",
  "cn-tier4",
  "intl-global",
  "intl-regional",
];
const CN_GROUPS: CityGroup[] = ["cn-tier1", "cn-tier2", "cn-tier3", "cn-tier4"];
const INTL_GROUPS: CityGroup[] = ["intl-global", "intl-regional"];

/** 数据层分组值 → i18n 键名 */
const GROUP_LABEL_KEYS: Record<CityGroup, string> = {
  "cn-tier1": "tiers.cnTier1",
  "cn-tier2": "tiers.cnTier2",
  "cn-tier3": "tiers.cnTier3",
  "cn-tier4": "tiers.cnTier4",
  "intl-global": "tiers.intlGlobal",
  "intl-regional": "tiers.intlRegional",
};

/** 数据层城市名 → i18n 键的静态映射（禁用模板串拼键；键集与 CityName / 三语资源 city.* 一致，缺键在编译期报错） */
const CITY_NAME_KEY: Record<CityName, string> = {
  北京: "city.北京",
  上海: "city.上海",
  深圳: "city.深圳",
  广州: "city.广州",
  成都: "city.成都",
  武汉: "city.武汉",
  东京: "city.东京",
  纽约: "city.纽约",
  伦敦: "city.伦敦",
  新加坡: "city.新加坡",
  迪拜: "city.迪拜",
  珠海: "city.珠海",
  海口: "city.海口",
  吉隆坡: "city.吉隆坡",
  桂林: "city.桂林",
  清迈: "city.清迈",
};

export default function RentalPanel() {
  const { t } = useTranslation();
  const inputs = useCalculatorStore((s) => s.rentalInputs);
  const setInputs = useCalculatorStore((s) => s.setRentalInputs);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const theme = useCalculatorStore((s) => s.theme);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：输出与瀑布图标签经展示币种换算；rate null = 符号-only */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;
  /** CNY 规范值 → 展示币种数值（瀑布图几何数据同源换算；rate 不可用时恒等） */
  const convert = (v: number): number => (rate !== null ? cnyToDisplay(v, rate) : v);
  /** 窄视口下结果 Descriptions 切纵向堆叠（标签上/值下），避免长 label 挤压数值列 */
  const isNarrow = useIsNarrowViewport();

  const [group, setGroup] = useState<CityGroup | null>(null);
  const [groupCities, setGroupCities] = useState<CityRentParams[]>([]);
  const [repParams, setRepParams] = useState<CityRentParams | null>(null);

  const { loading, result } = useFinanceCall(() => calcRental(inputs), [inputs]);

  const data = result?.ok === true ? result.data : null;
  const error = result && !result.ok ? result.error : null;

  const netCashFlow = data?.annualNetCashFlow ?? 0;
  const semanticPositive = netCashFlow >= 0;
  // 图表 / 语义色经主题解析函数取值（规范 6.2 #12 与第 8 节取色口径）：深浅选组与
  // 色盲友好替换在函数内完成，组件不感知主题
  const themeTokens = resolveThemeTokens(theme, colorBlindFriendly);
  const semanticFall = themeTokens.fall;
  /** 系统「减弱动态效果」偏好：命中时瀑布图入场动画停用（C3 ⑧，与既有折线图同口径） */
  const reducedMotion = usePrefersReducedMotion();

  /** C3 瀑布图数据（md+ 桌面渲染；窄屏不渲染，保留明细表信息无损） */
  const waterfallRows =
    data && !isNarrow
      ? buildWaterfallRows(data.breakdown, netCashFlow, convert, money, (key) => t(key))
      : null;

  /** C3 ④：标签渲染——变动柱带符号金额 / 合计柱累计值，柱顶 / 柱底自适应（12px chartTick） */
  const renderWaterfallLabel = (carrier: "riseSeg" | "fallSeg") => (shape: unknown): ReactElement => {
    const p = shape as BarLabelShape;
    const row = waterfallRows?.[p.index ?? -1];
    if (
      !row ||
      row.carrier !== carrier ||
      row.labelText === "" ||
      typeof p.x !== "number" ||
      typeof p.y !== "number" ||
      typeof p.width !== "number" ||
      typeof p.height !== "number"
    ) {
      return <g />;
    }
    const x = p.x + p.width / 2;
    const y = row.labelSide === "top" ? p.y - 6 : p.y + p.height + 14;
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={12} fill={themeTokens.chartTick}>
        {row.labelText}
      </text>
    );
  };

  /** C3 ③：连接线——虚线 4 4、chartGrid 色、1px，连接前后柱的累计位（Customized 读取
   *  图表坐标状态计算柱缘位置；柱宽显式 barSize 保证几何确定性） */
  const renderWaterfallConnectors = (frame: unknown): ReactElement => {
    const p = frame as WfChartFrame;
    const xAxisEntry = Object.values(p.xAxisMap ?? {})[0];
    const yAxisEntry = Object.values(p.yAxisMap ?? {})[0];
    if (!waterfallRows || !xAxisEntry || !yAxisEntry) return <g />;
    const xScale = xAxisEntry.scale as WfBandScale | undefined;
    const yScale = yAxisEntry.scale as WfLinearScale | undefined;
    if (typeof xScale !== "function" || typeof yScale !== "function") return <g />;
    const bandWidth = typeof xScale.bandwidth === "function" ? xScale.bandwidth() : 0;
    const barSize = 28;
    const lines: ReactElement[] = [];
    for (let i = 0; i < waterfallRows.length - 1; i += 1) {
      const level = waterfallRows[i].endLevel;
      const x1 = xScale(waterfallRows[i].name) + (bandWidth - barSize) / 2 + barSize;
      const x2 = xScale(waterfallRows[i + 1].name) + (bandWidth - barSize) / 2;
      const y = yScale(level);
      if (![x1, x2, y].every(Number.isFinite)) continue;
      lines.push(
        <line
          key={waterfallRows[i].key}
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          stroke={themeTokens.chartGrid}
          strokeWidth={1}
          strokeDasharray="4 4"
        />,
      );
    }
    return <g>{lines}</g>;
  };

  /** C3 ⑧：入场动画三参数与既有折线图同口径 */
  const waterfallAnimationProps = {
    isAnimationActive: !reducedMotion,
    animationDuration: MOTION_DURATIONS.slow,
    animationEasing: "ease-out",
  } as const;

  /** 选中分组即填充该组代表城市的持有成本默认值（代表城市由数据层 representative 标记）；
   *  房价 / 租金保留用户输入，组内其他城市口径可经提示行参考后手动微调 */
  const applyGroup = (value: CityGroup | "" | undefined) => {
    if (!value) {
      setGroup(null);
      setGroupCities([]);
      setRepParams(null);
      return;
    }
    const cities = CITY_RENT_PARAMS.filter((c) => c.group === value);
    setGroup(value);
    setGroupCities(cities);
    const rep = cities.find((c) => c.representative) ?? (cities.length > 0 ? cities[0] : null);
    setRepParams(rep);
    if (rep) {
      const h = rep.holdingCostDefaults;
      setInputs({
        vacancyRatePct: h.vacancyRatePct,
        maintenanceAnnualRatePct: h.maintenanceAnnualRatePct,
        propertyFeeMonthly: h.propertyFeeMonthly,
        otherAnnualCost: h.otherAnnualCost,
        rentTaxRatePct: h.rentTaxRatePct,
      });
    }
  };

  /** 六个分组选项：每个选项右侧小字标注 2–3 个示例城市（数据层 example 标记），供用户对号入座 */
  const groupOptions = GROUP_ORDER.map((g) => {
    const cities = CITY_RENT_PARAMS.filter((c) => c.group === g);
    const examples = cities
      .filter((c) => c.example)
      .map((c) => t(CITY_NAME_KEY[c.city]))
      .join(t("tiers.exampleJoiner"));
    return { group: g, cities, examples };
  }).filter((g) => g.cities.length > 0);

  /** 组内收益率区间并集 + 参照城市列表（选中后展示） */
  const selectedRange = (() => {
    if (groupCities.length === 0) return null;
    const lo = Math.min(...groupCities.map((c) => c.rentYieldRangePct[0]));
    const hi = Math.max(...groupCities.map((c) => c.rentYieldRangePct[1]));
    return { lo: formatNumber(lo, 1), hi: formatNumber(hi, 1) };
  })();
  const selectedCitiesText = groupCities.map((c) => t(CITY_NAME_KEY[c.city])).join(t("tiers.cityJoiner"));
  const selectedGroupLabel = group ? t(GROUP_LABEL_KEYS[group]) : null;
  const currencyNote =
    repParams && repParams.currency !== displayCode
      ? t("rental.currencyNote", { currency: repParams.currency })
      : "";

  /** breakdown 键 → i18n 标签（键集见 bridge.ts RentalBreakdown） */
  const BREAKDOWN_LABELS: ReadonlyArray<readonly [keyof RentalBreakdown & string, string]> = [
    ["loanAmount", "rental.breakdown.loanAmount"],
    ["downPayment", "rental.breakdown.downPayment"],
    ["annualGrossRent", "rental.breakdown.annualGrossRent"],
    ["annualVacancyLoss", "rental.breakdown.annualVacancyLoss"],
    ["annualEffectiveRent", "rental.breakdown.annualEffectiveRent"],
    ["annualRentTax", "rental.breakdown.annualRentTax"],
    ["annualMaintenance", "rental.breakdown.annualMaintenance"],
    ["annualPropertyFee", "rental.breakdown.annualPropertyFee"],
    ["annualOtherCost", "rental.breakdown.annualOtherCost"],
    ["annualLoanPayment", "rental.breakdown.annualLoanPayment"],
  ];

  return (
    <div>
      {CITY_RENT_PARAMS.length === 0 ? (
        <Alert
          type="info"
          style={{ marginBottom: 12 }}
          content={t("rental.cityEmpty")}
        />
      ) : (
        <div className="wf-field" style={{ marginBottom: 12 }}>
          <div className="wf-field-label">
            <Text>{t("rental.cityParams")}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {t("rental.cityParamsHint")}
            </Text>
          </div>
          <Select
            value={group || undefined}
            placeholder={t("rental.tierPlaceholder")}
            onChange={applyGroup}
            style={{ width: 400 }}
            allowClear
            className="wf-pressable"
          >
            <Select.OptGroup label={t("tiers.cnSection")}>
              {groupOptions
                .filter((g) => CN_GROUPS.includes(g.group))
                .map((g) => (
                  <Select.Option key={g.group} value={g.group}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 12,
                      }}
                    >
                      <span>{t(GROUP_LABEL_KEYS[g.group])}</span>
                      <span style={{ fontSize: 12, color: "var(--wf-text-secondary)" }}>{g.examples}</span>
                    </span>
                  </Select.Option>
                ))}
            </Select.OptGroup>
            <Select.OptGroup label={t("tiers.intlSection")}>
              {groupOptions
                .filter((g) => INTL_GROUPS.includes(g.group))
                .map((g) => (
                  <Select.Option key={g.group} value={g.group}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 12,
                      }}
                    >
                      <span>{t(GROUP_LABEL_KEYS[g.group])}</span>
                      <span style={{ fontSize: 12, color: "var(--wf-text-secondary)" }}>{g.examples}</span>
                    </span>
                  </Select.Option>
                ))}
            </Select.OptGroup>
          </Select>
          {selectedGroupLabel ? (
            <Tag color="arcoblue" style={{ marginLeft: 8 }}>
              {selectedGroupLabel}
            </Tag>
          ) : null}
          {group && selectedRange && repParams ? (
            <>
              <div className="wf-field-hint">
                <Text type="secondary">
                  {t("rental.tierHint", {
                    tier: selectedGroupLabel,
                    cities: selectedCitiesText,
                    lo: selectedRange.lo,
                    hi: selectedRange.hi,
                    currencyNote,
                  })}
                </Text>
              </div>
              <div className="wf-field-hint">
                <Text type="secondary">
                  {t("tiers.representativeNote", { city: t(CITY_NAME_KEY[repParams.city]) })}
                </Text>
              </div>
              {/* P5 §5 冗长治理：分级口径注压 ≤1 行 + 全文（2 段拼接键）进 FieldTip */}
              <div className="wf-field-hint">
                <Text type="secondary">
                  {t("tiers.gradingNoteShort")}
                  <FieldTip text={`${t("tiers.gradingNote1")} ${t("tiers.gradingNote2")}`} />
                </Text>
              </div>
            </>
          ) : null}
        </div>
      )}

      <FieldRow>
        <AmountField
          label={t("rental.price")}
          tooltip={t("rental.priceTooltip")}
          value={inputs.price}
          onChange={(v) => setInputs({ price: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        <AmountField
          label={t("rental.monthlyRent")}
          tooltip={t("rental.monthlyRentTooltip")}
          value={inputs.monthlyRent}
          onChange={(v) => setInputs({ monthlyRent: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuanPerMonth") : undefined}
          convertRate={rate}
        />
        <PercentField
          md={12}
          label={t("rental.downPayment")}
          tooltip={t("rental.downPaymentTooltip")}
          value={inputs.downPaymentPct}
          onChange={(v) => setInputs({ downPaymentPct: v })}
          suffix="%"
        />
        <PercentField
          md={12}
          label={t("rental.loanRate")}
          tooltip={t("rental.loanRateTooltip")}
          value={inputs.loanAnnualRatePct}
          onChange={(v) => setInputs({ loanAnnualRatePct: v })}
          suffix="%"
        />
        <IntField
          md={12}
          label={t("rental.loanYears")}
          tooltip={t("rental.loanYearsTooltip")}
          value={inputs.loanYears}
          onChange={(v) => setInputs({ loanYears: v })}
          min={LOAN_YEARS_LIMIT.min}
          max={LOAN_YEARS_LIMIT.max}
          suffix={t("units.yearUnit")}
          hint={t("loan.yearsHint", { max: LOAN_YEARS_LIMIT.max })}
        />
        <PercentField
          md={12}
          label={t("rental.vacancy")}
          tooltip={t("rental.vacancyTooltip")}
          value={inputs.vacancyRatePct}
          onChange={(v) => setInputs({ vacancyRatePct: v })}
          suffix="%"
        />
        <PercentField
          md={12}
          label={t("rental.maintenance")}
          tooltip={t("rental.maintenanceTooltip")}
          value={inputs.maintenanceAnnualRatePct}
          onChange={(v) => setInputs({ maintenanceAnnualRatePct: v })}
          suffix="%"
        />
        <AmountField
          md={12}
          label={t("rental.propertyFee")}
          tooltip={t("rental.propertyFeeTooltip")}
          value={inputs.propertyFeeMonthly}
          onChange={(v) => setInputs({ propertyFeeMonthly: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuanPerMonth") : undefined}
          convertRate={rate}
        />
        <AmountField
          md={12}
          label={t("rental.otherCost")}
          tooltip={t("rental.otherCostTooltip")}
          value={inputs.otherAnnualCost}
          onChange={(v) => setInputs({ otherAnnualCost: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuanPerYear") : undefined}
          convertRate={rate}
        />
        <NumberField
          md={12}
          label={t("rental.rentTax")}
          tooltip={t("rental.rentTaxTooltip")}
          value={inputs.rentTaxRatePct}
          onChange={(v) => setInputs({ rentTaxRatePct: v })}
          limit={RENT_TAX_LIMIT}
          suffix="%"
        />
      </FieldRow>

      {loading ? <Text type="secondary">{t("common.computing")}</Text> : null}
      {data ? (
        <>
          <Descriptions
            border
            size="small"
            style={{ marginTop: 8 }}
            layout={isNarrow ? "vertical" : "horizontal"}
            column={{ xs: 1, md: 3 }}
            data={[
              { label: t("rental.monthlyPayment"), value: money(data.monthlyPayment) },
              {
                label: t("rental.annualNetCashFlow"),
                value: (
                  <Text bold className="wf-nowrap" style={{ color: semanticPositive ? undefined : semanticFall }}>
                    {/* T10 = S10 方向冗余编码：净现金流正负前置 ▲/▼ 字形（形状通道独立于颜色通道，
                        WCAG 1.4.1），字形走 caption 档字号；语义色仍由涨跌令牌承载 */}
                    <span style={{ fontSize: "var(--wf-text-caption)" }}>{semanticPositive ? "▲" : "▼"}</span>{" "}
                    {money(netCashFlow)}
                  </Text>
                ),
              },
              {
                label: t("rental.paybackYears"),
                value:
                  data.paybackYears >= 0
                    ? `${formatNumber(data.paybackYears, 1)} ${t("units.yearUnit")}`
                    : t("rental.paybackNever"),
              },
            ]}
          />
          <Descriptions
            border
            size="small"
            style={{ marginTop: 12 }}
            title={t("rental.breakdownTitle")}
            layout={isNarrow ? "vertical" : "horizontal"}
            column={{ xs: 1, md: 2 }}
            data={BREAKDOWN_LABELS.map(([key, labelKey]) => ({
              label: t(labelKey),
              value: key in data.breakdown ? money(data.breakdown[key]) : "—",
            }))}
          />
          {/* C3 ⑥ 窄屏降级：瀑布图不渲染，年度明细 Descriptions（上方，信息无损）承载全部数值；
              md+ 桌面图表 + 明细表并存（数据表替代即该明细表，C5 口径） */}
          {waterfallRows && waterfallRows.length > 0 ? (
            <div className="wf-waterfall-chart" role="img" aria-label={t("rental.waterfallAria")}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={waterfallRows}
                  margin={{ top: 24, right: 16, bottom: 0, left: 0 }}
                  barSize={28}
                >
                  {/* §6 图表质感：仅水平 1px 实线网格（去虚线），去轴框与刻度短线 */}
                  <CartesianGrid stroke={themeTokens.chartGrid} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: themeTokens.chartTick }}
                    interval={0}
                  />
                  <YAxis
                    width={72}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: themeTokens.chartTick }}
                    tickFormatter={(v: number) => formatCompactAxis(v)}
                  />
                  {/* C3 ⑤ 堆叠透明底段法：透明定位段（正 / 负侧）+ 彩色变动段 */}
                  <Bar dataKey="basePos" stackId="wf" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="baseNeg" stackId="wf" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="riseSeg" stackId="wf" {...waterfallAnimationProps}>
                    {waterfallRows.map((row) => (
                      <Cell
                        key={row.key}
                        fill={row.carrier === "riseSeg" ? themeTokens[row.color] : "transparent"}
                      />
                    ))}
                    <LabelList content={renderWaterfallLabel("riseSeg")} />
                  </Bar>
                  <Bar dataKey="fallSeg" stackId="wf" {...waterfallAnimationProps}>
                    {waterfallRows.map((row) => (
                      <Cell
                        key={row.key}
                        fill={row.carrier === "fallSeg" ? themeTokens[row.color] : "transparent"}
                      />
                    ))}
                    <LabelList content={renderWaterfallLabel("fallSeg")} />
                  </Bar>
                  {/* C3 ③ 连接线：累计位虚线（几何经 Customized 读图表刻度状态计算） */}
                  <Customized component={renderWaterfallConnectors} />
                </BarChart>
              </ResponsiveContainer>
              {/* C3 ⑦ 图注：三角色配色与连接线含义 */}
              <Text type="secondary" className="wf-panel-note">
                {t("rental.waterfallNote")}
              </Text>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? <Alert type="error" style={{ marginTop: 8 }} content={error} /> : null}
      <Text type="secondary" className="wf-panel-note">
        {t("rental.note")}
      </Text>
    </div>
  );
}
