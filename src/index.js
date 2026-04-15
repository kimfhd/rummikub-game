import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // 这会自动寻找同目录下的 App.jsx 或 App.js

// 找到 index.html 中 id="root" 的元素
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("找不到 root 容器，请确保 public/index.html 中有 <div id='root'></div>");
}

const root = ReactDOM.createRoot(rootElement);

// 开始渲染
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);