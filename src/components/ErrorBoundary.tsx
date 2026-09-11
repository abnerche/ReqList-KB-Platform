import React from "react";

interface State {
  error: Error | null;
}

/**
 * 全局错误边界：任何渲染期异常都会被捕获并显示可读错误信息，
 * 避免整棵组件树卸载导致的「白屏」（之前点知识库就白屏的根因）。
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 同时打到 DevTools Console，方便排查
    console.error("界面渲染崩溃：", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "Consolas, monospace",
            color: "#b00020",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          <h2 style={{ color: "#b00020" }}>界面崩溃（已被捕获）</h2>
          <p>
            <strong>错误信息：</strong>
            {this.state.error.message}
          </p>
          <pre style={{ background: "#fbe9e7", padding: 12, borderRadius: 4 }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
