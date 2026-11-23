/**
 * P9 人生事件编辑器（docs/p9-spec.md §5.2；life 页 events 组新面板，非读数卡内——
 * D9 纯读数卡同构延伸，p8-spec §5 红线 2）。
 * - 事件列表 ＋ 三动作（add/update/remove）直写 store；每条事件行 = kind Tag ＋
 *   年龄/金额读数（金额经 money() 币种换算）＋ 编辑/删除；添加表单 = kind 三选 ＋
 *   年龄 ＋（endAge/annualAmount/amount 按 kind 显隐）。
 * - 零自动播种（p9-spec §1.5 铁律）：空态 = 「添加第一条人生事件」指路文案，
 *   无示例事件、无演示数据、无「帮你填一条」。
 * - 零新 calc* 调用：本组件是纯输入面，引擎读数仍由 LifeTrajectoryCard 唯一 hook
 *   消费（写 store 即触发该卡重算）。
 * - 校验（p9-spec §1.5-1）：age/endAge 走 LIMITS.lifeEventAge（NumberField 拒绝式）；
 *   endAge ≥ age 校验不过 → 保存按钮禁用 ＋ 表单内错误文案（不弹全局 Alert）；
 *   amount/annualAmount 走 LIMITS.amount；条数上限 20（第 21 条添加禁用 ＋ 计数提示）。
 */
import { Button, Radio, Tag, Typography } from "@arco-design/web-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LIMITS } from "../data/defaults";
import { formatNumber } from "../services/format";
import type { LifeEventInput } from "../services/finance";
import { useCalculatorStore } from "../store/useCalculatorStore";
import { NumberField } from "./fields";
import { useMoney } from "./hooks";

const { Text } = Typography;

/** 事件条数上限（与 share.ts 解码端同值；p9-spec §1.5-1/§6.3-3） */
const MAX_LIFE_EVENTS = 20;

type EventKind = LifeEventInput["kind"];

/** 事件行读数：kind Tag ＋ 年龄/金额读数（金额经 money()；childBirth 无事件体金额——
 *  年成本单一事实来源 = base.costPerChild ÷ 18，事件行不展示派生值） */
function EventReadRow({ ev, money, onEdit, onRemove, editing }: {
  ev: LifeEventInput;
  money: (v: number) => string;
  onEdit: () => void;
  onRemove: () => void;
  editing: boolean;
}) {
  const { t } = useTranslation();
  const kindLabel = ev.kind === "homePurchase" ? t("life.eventKindHome") : ev.kind === "childBirth" ? t("life.eventKindChild") : t("life.eventKindHealth");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <Tag style={{ margin: 0 }}>{kindLabel}</Tag>
      <Text className="wf-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
        {ev.kind === "healthPhase"
          ? `${formatNumber(ev.age, 0)}–${formatNumber(ev.endAge, 0)} ${t("units.yearUnit")} · ${money(ev.annualAmount)}`
          : `${formatNumber(ev.age, 0)} ${t("units.yearUnit")}${ev.kind === "homePurchase" ? ` · ${money(ev.amount)}` : ""}`}
      </Text>
      <span className="wf-touch-target-sm">
        <Button size="mini" type="text" aria-pressed={editing} onClick={onEdit}>
          {t("life.eventEdit")}
        </Button>
      </span>
      <span className="wf-touch-target-sm">
        <Button size="mini" type="text" onClick={onRemove}>
          {t("life.eventDelete")}
        </Button>
      </span>
    </div>
  );
}

export default function LifeEventEditor() {
  const { t } = useTranslation();
  const lifeEvents = useCalculatorStore((s) => s.lifeEvents);
  const addLifeEvent = useCalculatorStore((s) => s.addLifeEvent);
  const updateLifeEvent = useCalculatorStore((s) => s.updateLifeEvent);
  const removeLifeEvent = useCalculatorStore((s) => s.removeLifeEvent);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const { money } = useMoney(displayCode);

  /** 表单本地态（不入 store 的中间值；age/endAge/amount/annualAmount 恒为合法域内值
   *  ——NumberField 拒绝式保证；跨字段校验 endAge ≥ age 在此层判定） */
  const [kind, setKind] = useState<EventKind>("homePurchase");
  const [age, setAge] = useState(30);
  const [endAge, setEndAge] = useState(31);
  const [amount, setAmount] = useState(0);
  const [annualAmount, setAnnualAmount] = useState(0);
  /** null = 添加模式；非 null = 编辑该 id（表单载入事件原值，保存走 update） */
  const [editingId, setEditingId] = useState<string | null>(null);
  const endAgeInvalid = kind === "healthPhase" && endAge < age;
  const full = lifeEvents.length >= MAX_LIFE_EVENTS;

  const resetForm = () => {
    setEditingId(null);
    setKind("homePurchase");
    setAge(30);
    setEndAge(31);
    setAmount(0);
    setAnnualAmount(0);
  };

  const startEdit = (ev: LifeEventInput) => {
    // 同行再点 = 退出编辑回添加模式（不设独立取消键——i18n 键预算 §10）
    if (editingId === ev.id) {
      resetForm();
      return;
    }
    setEditingId(ev.id);
    setKind(ev.kind);
    setAge(ev.age);
    if (ev.kind === "healthPhase") {
      setEndAge(ev.endAge);
      setAnnualAmount(ev.annualAmount);
    } else if (ev.kind === "homePurchase") {
      setAmount(ev.amount);
    }
  };

  const submit = () => {
    if (endAgeInvalid) return;
    const id = editingId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const next: LifeEventInput =
      kind === "homePurchase"
        ? { id, kind, age, amount }
        : kind === "childBirth"
          ? { id, kind, age }
          : { id, kind, age, endAge, annualAmount };
    if (editingId !== null) updateLifeEvent(editingId, next);
    else addLifeEvent(next);
    resetForm();
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Text bold>{t("life.eventsTitle")}</Text>
        <Text type="secondary" className="wf-nowrap">{t("life.eventCount", { count: lifeEvents.length })}</Text>
      </div>

      {/* 事件列表（显式增删改；删除不经二次确认——事件可即时重建，与情景删除的
          Popconfirm 口径不同源，登记为最小面裁定） */}
      {lifeEvents.length > 0 ? (
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {lifeEvents.map((ev) => (
            <EventReadRow
              key={ev.id}
              ev={ev}
              money={money}
              editing={editingId === ev.id}
              onEdit={() => startEdit(ev)}
              onRemove={() => {
                removeLifeEvent(ev.id);
                if (editingId === ev.id) resetForm();
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">{t("life.eventsEmpty")}</Text>
        </div>
      )}

      {/* 添加/编辑表单（纯输入面：写 store 即由 LifeTrajectoryCard 唯一 hook 重算） */}
      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <div>
          <Text type="secondary" style={{ marginRight: 8 }}>{t("life.eventKindHome")}/{t("life.eventKindChild")}/{t("life.eventKindHealth")}</Text>
          <Radio.Group
            type="button"
            size="small"
            value={kind}
            onChange={(v: string) => setKind(v as EventKind)}
            options={[
              { label: t("life.eventKindHome"), value: "homePurchase" },
              { label: t("life.eventKindChild"), value: "childBirth" },
              { label: t("life.eventKindHealth"), value: "healthPhase" },
            ]}
          />
        </div>
        <NumberField label={t("life.eventAge")} value={age} onChange={setAge} limit={LIMITS.lifeEventAge} md={12} />
        {kind === "healthPhase" ? (
          <>
            <NumberField label={t("life.eventEndAge")} value={endAge} onChange={setEndAge} limit={LIMITS.lifeEventAge} md={12} />
            <NumberField label={t("life.eventAnnualAmount")} value={annualAmount} onChange={setAnnualAmount} limit={LIMITS.amount} md={12} />
          </>
        ) : null}
        {kind === "homePurchase" ? (
          <NumberField label={t("life.eventAmount")} value={amount} onChange={setAmount} limit={LIMITS.amount} md={12} />
        ) : null}
        {endAgeInvalid ? (
          <Text type="error">{t("life.eventEndAgeError")}</Text>
        ) : null}
        <div>
          <span className="wf-touch-target-sm">
            <Button
              type="primary"
              size="small"
              className="wf-pressable"
              disabled={full || endAgeInvalid}
              onClick={submit}
            >
              {editingId !== null ? t("life.eventEdit") : t("life.eventAdd")}
            </Button>
          </span>
          {full ? (
            <Text type="secondary" style={{ marginLeft: 8 }}>{t("life.eventCount", { count: lifeEvents.length })}</Text>
          ) : null}
        </div>
      </div>
    </div>
  );
}
