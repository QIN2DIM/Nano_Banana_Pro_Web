import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// 移除首屏兜底层（避免白屏闪烁）
requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.style.transition = 'opacity 180ms ease';
  boot.style.opacity = '0';
  window.setTimeout(() => boot.remove(), 200);
});
