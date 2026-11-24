/**
 * 统一的数值输入字段：限额一律来自 src/data/defaults.ts 的 LIMITS（或调用方
 * 显式传入的 NumberInputLimit），无任何静默修正：
 * - InputNumber 不传 min/max（Arco 会在键入/失焦/越界时把非法值静默钳制到边界，
 *   见 @arco-design/web-react InputNumber getLegalValue 的三处调用），范围校验
 *   收敛到本组件 handleChange：合法值才落 store，越界值不落库、保留显示并点亮错误；
 * - 清空输入时保留上次有效值并恢复显示。
 */
import { Grid, InputNumber, Tooltip, Typography } from "@arco-design/web-react";
import { IconQuestionCircle } from "@arco-design/web-react/icon";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LIMITS } from "../data/defaults";
import type { NumberInputLimit } from "../data/types";
import { formatNumber } from "../services/format";
import { cnyToDisplay, displayToCny } from "../services/currency";

const { Text } = Typography;
const { Row, Col } = Grid;

export interface NumberFieldProps {
  /** 字段名 */
  label: ReactNode;
  /** 财务术语通俗解释（悬停图标展示） */
  tooltip?: string;
  /** 当前值（受控，CNY 规范值） */
  value: number;
  /** 合法数值变更回调（非有限数不会触发；落库恒为 CNY 规范值） */
  onChange: (value: number) => void;
  /** 输入限额（CNY 规范域） */
  limit: NumberInputLimit;
  /** 输入框前缀（如币种符号） */
  prefix?: ReactNode;
  /** 输入框后缀（如 "元/月"） */
  suffix?: ReactNode;
  /** 常态下的补充说明（不含业务数值） */
  hint?: string;
  /** md 断点栅格跨度（默认 24 = 单列；高级面板传 12 = 两列） */
  md?: number;
  /** xs 断点栅格跨度（默认 24 = 单列；P10 槽内紧凑两列布局传 12——槽内字段恒两列
   *  与视口断点解耦，docs/p10-spec.md §1.1 F8 槽内 2×52 行预算口径） */
  xs?: number;
  disabled?: boolean;
  /** 展示换算率（1 CNY = rate 展示币种；p4-spec §3.6）。省略或 null = 不换算（现状行为）。
   *  传入时：显示值 = cnyToDisplay(value, rate)；用户编辑经 displayToCny 回写 onChange；
   *  越界校验按回写后的 CNY 规范值对 limit 判定（displayToCny(v) < min || > max）；
   *  换算模式下 InputNumber 精度固定 2、step 1（局部覆写 limit 的 0/100，减少往返漂移）。
   *  越界错误文案的 min/max 插值维持 limit 原值（CNY 域）——报错边界与展示币种错位为
   *  本轮按现状简化不扩大（p4-spec §14 #13），由换算横幅「自动回写为人民币口径」表述兜底。 */
  convertRate?: number | null;
  /** WF-04 T2 公式解构高亮锚点（wf04-spec §1-T2）：true 时 wf-field 容器挂静态描边类
   *  + label 加粗（纯展示态，置位/清除由宿主成对驱动；缺省 false = 既有行为零变化。
   *  实现注记：字段宿主 Col 由本组件自渲染，外包 div 会破坏 FieldRow 栅格——以本可选
   *  prop 承载高亮，登记为 wf04-spec §1-T2 落点文件的在册扩展） */
  highlighted?: boolean;
}

export function NumberField({
  label,
  tooltip,
  value,
  onChange,
  limit,
  prefix,
  suffix,
  hint,
  md = 24,
  xs = 24,
  disabled,
  convertRate,
  highlighted,
}: NumberFieldProps) {
  const { t } = useTranslation();
  const { min, max, step, precision } = limit;
  /** A2 程序关联三件套（p4-spec §7）：useId 稳定 id——标签 labelledby、提示/错误
   *  describedby（错误与提示互斥渲染，describedby 指向当前可见者；两者皆空不传，
   *  条件展开避免读屏指向空容器）。可访问名称 = label 文本（aria-labelledby），
   *  单位由 hint 文案承载（research-a11y §3.3 取轻口径，§14 #14 登记） */
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  /** 换算模式判定：rate 非空且为有限正数才生效（rate null = 汇率未就绪，按 CNY 值渲染） */
  const converting = convertRate != null && Number.isFinite(convertRate) && convertRate > 0;
  const rate = converting ? (convertRate as number) : 1;
  /** 越界但保留显示的键入值（不落 store，仅点亮错误；换算模式下存展示值供回显） */
  const [pendingInvalid, setPendingInvalid] = useState<number | null>(null);
  // store 值被外部变更（重置/预设填充等）时，撤销保留显示的越界值
  useEffect(() => {
    setPendingInvalid(null);
  }, [value]);
  const invalid = pendingInvalid !== null || value < min || value > max;
  /** 受控显示值：换算模式下 = cnyToDisplay(CNY 规范值, rate) */
  const displayValue = converting ? cnyToDisplay(value, rate) : value;
  /** 外部值变更重挂载（验收 T2-1，p4-spec §14.10 备案的组件层补充）：组件库
   *  InputNumber 经用户键入后内部文本不再跟随受控值更新——store 侧外部写入
   *  （预设 / 重置）经 resetEpoch 重挂载覆盖基础五字段，但展示币种切回
   *  （convertRate 变化）与高级面板字段无对应通路。此处记录「我方写入口径」
   *  （handleChange 落库前先行同步），effect 里只对非用户写入的 value/rate
   *  变更递增 key 强制重挂 InputNumber，使其内部态从受控值重新初始化；
   *  重挂仅发生在键入以外场景（切币种 / 预设 / 分享导入），焦点不在本字段。 */
  const [inputEpoch, setInputEpoch] = useState(0);
  const syncedRef = useRef<{ value: number; rate: number | null }>({ value, rate: converting ? rate : null });
  useEffect(() => {
    const cur = { value, rate: converting ? rate : null };
    if (syncedRef.current.value !== cur.value || syncedRef.current.rate !== cur.rate) {
      syncedRef.current = cur;
      setInputEpoch((e) => e + 1);
    }
  }, [value, rate, converting]);
  /** 拒绝式校验：合法值才落 store；越界值不落库、保留显示并点亮错误提示。
   *  换算模式下先 displayToCny 回写 CNY 规范值，再按 CNY 域 limit 判定。
   *  落库前先同步 syncedRef：用户自身写入引发的 value 变化不触发重挂。 */
  const handleChange = (v: number) => {
    if (!Number.isFinite(v)) {
      setPendingInvalid(null); // 清空输入：恢复显示上次有效值
      return;
    }
    const cnyValue = converting ? displayToCny(v, rate) : v;
    if (cnyValue < min || cnyValue > max) {
      setPendingInvalid(v); // 保留展示值供回显
      return;
    }
    setPendingInvalid(null);
    syncedRef.current = { value: cnyValue, rate: converting ? rate : null };
    onChange(cnyValue);
  };

  return (
    <Col xs={xs} md={md}>
      <div className={highlighted ? "wf-field wf-anatomy-target" : "wf-field"}>
        <div className="wf-field-label">
          <Text id={labelId} bold={highlighted || undefined}>
            {label}
          </Text>
          {tooltip ? <FieldTip text={tooltip} /> : null}
        </div>
        <InputNumber
          key={inputEpoch}
          value={pendingInvalid ?? displayValue}
          step={converting ? 1 : step}
          precision={converting ? 2 : precision}
          prefix={prefix}
          suffix={suffix}
          error={invalid}
          disabled={disabled}
          onChange={handleChange}
          style={{ width: "100%" }}
          aria-labelledby={labelId}
          aria-describedby={invalid ? errorId : hint ? hintId : undefined}
          aria-invalid={invalid || undefined}
        />
        <div className="wf-field-hint">
          {invalid ? (
            <Text type="error" id={errorId}>
              {t("field.errorRange", { min: formatNumber(min, precision), max: formatNumber(max, precision) })}
            </Text>
          ) : hint ? (
            <Text type="secondary" id={hintId}>
              {hint}
            </Text>
          ) : null}
        </div>
      </div>
    </Col>
  );
}

/** 金额类字段（限额：LIMITS.amount，单位「元」口径由各面板注明） */
export function AmountField(props: Omit<NumberFieldProps, "limit">) {
  return <NumberField {...props} limit={LIMITS.amount} />;
}

/**
 * 字段提示图标（A5，p4-spec §7）：键盘可达——Tab 可聚焦（tabIndex=0）、focus 触发 Tooltip、
 * Esc 可收起（组件库 Tooltip 内建）；提示文本即 aria-label（读屏直读可访问名称）。
 * 不挂 role="button" 以免暗示点击动作（WCAG 1.4.13 悬停内容三条件 + 4.1.2 控件名称）。
 */
export function FieldTip({ text }: { text: string }) {
  return (
    <Tooltip content={text} trigger={["hover", "focus"]}>
      <span className="wf-field-tip" tabIndex={0} aria-label={text}>
        <IconQuestionCircle />
      </span>
    </Tooltip>
  );
}

/** 百分比类字段（限额：LIMITS.percent，单位「百分点」） */
export function PercentField(props: Omit<NumberFieldProps, "limit">) {
  return <NumberField {...props} limit={LIMITS.percent} />;
}

/** 蒙特卡洛路径数字段（限额：LIMITS.paths） */
export function PathsField(props: Omit<NumberFieldProps, "limit">) {
  return <NumberField {...props} limit={LIMITS.paths} />;
}

export interface IntFieldProps extends Omit<NumberFieldProps, "limit"> {
  min?: number;
  max?: number;
}

/** 整数字段（precision = 0；min/max 为 UI 约束，默认取 LIMITS.int 宽松上限） */
export function IntField({ min = LIMITS.int.min, max = LIMITS.int.max, ...rest }: IntFieldProps) {
  const limit: NumberInputLimit = { min, max, step: 1, precision: 0 };
  return <NumberField {...rest} limit={limit} />;
}

/** 高级面板的表单行：两列（md 起）→ 窄屏单列；P10 槽内紧凑栅格经 className 扩展 */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Row gutter={[16, 0]} className={className ? `wf-field-row ${className}` : "wf-field-row"}>
      {children}
    </Row>
  );
}
