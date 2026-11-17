import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base: "./" —— GitHub Pages 项目页（/repo-name/ 子路径）使用相对路径加载资源
export default defineConfig({
  base: "./",
  plugins: [react()],
});
