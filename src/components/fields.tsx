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
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LIMITS } from "../data/defaults";
import type { NumberInputLimit } from "../data/types";
import { formatNumber } from "../services/format";

const { Text } = Typography;
const { Row, Col } = Grid;

export interface NumberFieldProps {
  /** 字段名 */
  label: ReactNode;
  /** 财务术语通俗解释（悬停图标展示） */
  tooltip?: string;
  /** 当前值（受控） */
  value: number;
  /** 合法数值变更回调（非有限数不会触发） */
  onChange: (value: number) => void;
  /** 输入限额 */
  limit: NumberInputLimit;
  /** 输入框前缀（如币种符号） */
  prefix?: ReactNode;
  /** 输入框后缀（如 "元/月"） */
  suffix?: ReactNode;
  /** 常态下的补充说明（不含业务数值） */
  hint?: string;
  /** md 断点栅格跨度（默认 24 = 单列；高级面板传 12 = 两列） */
  md?: number;
  disabled?: boolean;
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
  disabled,
}: NumberFieldProps) {
  const { t } = useTranslation();
  const { min, max, step, precision } = limit;
  /** 越界但保留显示的键入值（不落 store，仅点亮错误；修复后经外部变更清空） */
  const [pendingInvalid, setPendingInvalid] = useState<number | null>(null);
  // store 值被外部变更（重置/预设填充等）时，撤销保留显示的越界值
  useEffect(() => {
    setPendingInvalid(null);
  }, [value]);
  const invalid = pendingInvalid !== null || value < min || value > max;
  /** 拒绝式校验：合法值才落 store；越界值不落库、保留显示并点亮错误提示 */
  const handleChange = (v: number) => {
    if (!Number.isFinite(v)) {
      setPendingInvalid(null); // 清空输入：恢复显示上次有效值
      return;
    }
    if (v < min || v > max) {
      setPendingInvalid(v);
      return;
    }
    setPendingInvalid(null);
    onChange(v);
  };

  return (
    <Col xs={24} md={md}>
      <div className="wf-field">
        <div className="wf-field-label">
          <Text>{label}</Text>
          {tooltip ? (
            <Tooltip content={tooltip}>
              <span className="wf-field-tip">
                <IconQuestionCircle />
              </span>
            </Tooltip>
          ) : null}
        </div>
        <InputNumber
          value={pendingInvalid ?? value}
          step={step}
          precision={precision}
          prefix={prefix}
          suffix={suffix}
          error={invalid}
          disabled={disabled}
          onChange={handleChange}
          style={{ width: "100%" }}
        />
        <div className="wf-field-hint">
          {invalid ? (
            <Text type="error">
              {t("field.errorRange", { min: formatNumber(min, precision), max: formatNumber(max, precision) })}
            </Text>
          ) : hint ? (
            <Text type="secondary">{hint}</Text>
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

/** 高级面板的表单行：两列（md 起）→ 窄屏单列 */
export function FieldRow({ children }: { children: ReactNode }) {
  return (
    <Row gutter={[16, 0]} className="wf-field-row">
      {children}
    </Row>
  );
}
