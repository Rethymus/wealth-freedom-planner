# 财富自由规划工具

纯前端、本地计算的财富自由个性化规划工具。核心是「480 法则」财务自由基线计算，高级模式提供反向估算、贷款测算、买房收租分析、蒙特卡洛模拟、税务估算与多币种换算。所有计算均在浏览器本地完成，不上传任何数据；可静态部署至 GitHub Pages。

> 本工具基于公开统计与简化假设，仅为规划参考，不构成投资建议。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | React 18 + Vite 6 + TypeScript（strict） |
| UI 组件 | @arco-design/web-react（图标使用其内置 icon） |
| 状态管理 | zustand |
| 图表 | recharts（仅高级模式使用） |
| 计算核心 | Rust → WASM（本阶段仅定义契约与占位 stub，见 `src/wasm/`） |

## 本地运行

```bash
npm install
npm run dev       # 开发服务器
npm run build     # tsc --noEmit && vite build（类型检查 + 产物构建）
npm run preview   # 预览构建产物
```

## GitHub Pages 部署

`vite.config.ts` 已设置 `base: "./"`，构建产物全部为相对路径，将 `dist/` 发布到 GitHub Pages 项目页（`<user>.github.io/<repo>/` 子路径）即可直接访问。

## 计算核心（Rust → WASM）

- **输入/输出契约（单一事实来源）**：`src/wasm/bridge.ts`。所有 Rust 导出函数签名统一为 `(input: string) => string`——JSON 序列化进、JSON 序列化出，函数与语义共 6 个：`calculate_baseline`、`amortize`、`rental_analysis`、`reverse_estimate`、`run_monte_carlo`、`estimate_tax`。
- **Rust crate**：`src/wasm/Cargo.toml`（crate 名 `finance-core`，`cdylib` + `rlib`）；实现入口 `src/wasm/src/lib.rs`（本阶段为空库占位）。
- **占位 stub**：`src/wasm/pkg/finance_core.js` + `finance_core.d.ts`，在核心未构建时被调用会抛出 `WASM_NOT_BUILT`。真实产物用 `wasm-pack build --target web --out-dir src/wasm/pkg` 覆盖本目录；stub 保留入库。

## 目录结构

```
├── index.html                 # lang="zh-CN"，标题「财富自由规划工具」
├── src
│   ├── App.tsx                # 页面骨架（标题栏 / 基础计算区占位 / 高级估算 Collapse 占位 / 免责声明）
│   ├── main.tsx               # 挂载入口（Arco ConfigProvider locale zh-CN）
│   ├── data
│   │   ├── types.ts           # 数据层类型契约（限额 / 币种 / 汇率快照 / 税表 / 城市参数 / 区域参考）
│   │   ├── defaults.ts        # 默认值、LIMITS、免责声明、主题常量
│   │   ├── taxTables.ts       # 税表（类型化占位，由数据研究员填充）
│   │   └── rentParams.ts      # 城市租售参数（类型化占位，由数据研究员填充）
│   ├── store
│   │   └── useCalculatorStore.ts  # zustand 全局状态
│   └── wasm
│       ├── bridge.ts          # WASM 接口契约（TS 类型）
│       ├── Cargo.toml         # finance-core crate 定义
│       ├── src/lib.rs         # 空库占位（由计算核心工程师实现）
│       └── pkg/               # 占位 stub（未来由 wasm-pack 产物覆盖，不忽略）
└── vite.config.ts             # base:"./"，GitHub Pages 相对路径
```
