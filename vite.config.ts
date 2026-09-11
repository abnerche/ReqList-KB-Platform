import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 期望固定的开发端口
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      // 忽略 Rust 侧改动，避免无谓重启
      ignored: ["**/src-tauri/**"],
    },
  },
});
