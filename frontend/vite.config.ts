import path from "path";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import react from "@vitejs/plugin-react";

// 默认情况下，index.html 是该 Vite 项目的入口文件。并且 index.html 是在项目最外层
// Vite 解析 index.html 的 <script type="module" src="..."> ，这个标签指向你的 JavaScript 源码。
// TODO: vite 是如何去解析的？

// PS: 多页面模式见 https://cn.vitejs.dev/guide/build.html#multi-page-app


// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_IS_DEPLOYED ? "/free-tools/screenshot-to-code/" : "",
  plugins: [react(), checker({ typescript: true })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
