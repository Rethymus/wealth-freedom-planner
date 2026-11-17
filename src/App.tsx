/**
 * 页面骨架：标题栏、基础计算区占位、高级估算 Collapse 占位、底部免责声明。
 * 功能阶段逐个接入表单与 WASM 计算调用（契约见 src/wasm/bridge.ts）。
 */
import { Alert, Card, Collapse, Layout, Switch, Typography } from "@arco-design/web-react";
import { IconThunderbolt } from "@arco-design/web-react/icon";
import { APP_COPY, THEME } from "./data/defaults";
import { useCalculatorStore } from "./store/useCalculatorStore";

const { Header, Content, Footer } = Layout;
const { Text, Title } = Typography;
const CollapseItem = Collapse.Item;

/** 高级估算面板占位清单 */
const ADVANCED_PANELS: Array<{ key: string; title: string; desc: string }> = [
  { key: "reverse", title: "反向估算", desc: "由总资产与各项预留反推可持续月开销（契约 reverse_estimate）" },
  { key: "loan", title: "贷款测算", desc: "等额本息 / 等额本金还款计划（契约 amortize）" },
  { key: "rental", title: "买房收租分析", desc: "租金现金流、回本年限与明细拆解（契约 rental_analysis）" },
  { key: "monte-carlo", title: "蒙特卡洛模拟", desc: "资产耗尽概率与期末分位数，图表用 recharts（契约 run_monte_carlo）" },
  { key: "tax", title: "税务估算", desc: "按税表估算税额与有效税率（契约 estimate_tax）" },
  { key: "currency", title: "多币种", desc: "币种切换与离线汇率快照换算（数据 CURRENCIES / FX_RATE_SNAPSHOT）" },
];

export default function App() {
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const toggleColorBlindFriendly = useCalculatorStore((s) => s.toggleColorBlindFriendly);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: THEME.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconThunderbolt style={{ color: "#fff", fontSize: 20 }} />
          <Title heading={5} style={{ color: "#fff", margin: 0 }}>
            财富自由规划工具
          </Title>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text style={{ color: "rgba(255, 255, 255, 0.85)" }}>色盲友好模式</Text>
          <Switch checked={colorBlindFriendly} onChange={toggleColorBlindFriendly} size="small" />
        </div>
      </Header>

      <Content style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <Card title="基础计算（480 法则基线）" style={{ marginBottom: 16 }}>
          <Alert
            type="info"
            content="占位：基础输入表单与结果区将在功能阶段接入；输入/输出契约见 src/wasm/bridge.ts（calculate_baseline）。"
          />
        </Card>

        <Card title="高级估算">
          <Collapse bordered={false}>
            {ADVANCED_PANELS.map((panel) => (
              <CollapseItem key={panel.key} name={panel.key} header={panel.title}>
                <Alert type="info" content={`占位：${panel.desc}。`} />
              </CollapseItem>
            ))}
          </Collapse>
        </Card>
      </Content>

      <Footer style={{ textAlign: "center", padding: "16px 24px" }}>
        <Text type="secondary">{APP_COPY.disclaimer}</Text>
      </Footer>
    </Layout>
  );
}
