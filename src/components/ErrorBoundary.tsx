/**
 * 渲染错误边界（第 3 轮验收 ZS-04）：包住 atlas-region 渲染树——面板渲染路径抛错时
 * React 根整树卸载（#root 清空、整页白屏，第 3 轮实测一次：一孩预设应用后切风险页
 * #root EMPTY）。边界捕获后显示降级 UI（错误提示 + 重新加载按钮），页面不再白屏；
 * 错误堆栈经 console.error 上报。文案走 i18next 直调（类组件不经 hook），键
 * app.renderError / app.reload 三语在册。
 */
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import i18next from "i18next";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 上报堆栈（组件栈在 info.componentStack；控制台保留完整证据链）
    console.error("[ErrorBoundary] render tree error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginBottom: 12 }}>{i18next.t("app.renderError")}</p>
          <button
            type="button"
            className="arco-btn arco-btn-secondary arco-btn-size-small"
            onClick={() => window.location.reload()}
          >
            {i18next.t("app.reload")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
