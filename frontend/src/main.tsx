import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Toaster } from "react-hot-toast";

// react-hot-toast 轻量级 toast 组件，
// 这里相当于全局引入组件，后续在项目中直接使用
/**
```tsx
import toast from "react-hot-toast"

toast.succes('Here is your toast.')
```

 */

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
);
