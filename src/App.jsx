/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect } from 'react';

/**
 * 修复后的 Firebase 环境变量调试器
 * 1. 移除了 JSX 中不合法的 ">" 字符
 * 2. 优化了对 import.meta 的访问以兼容 ES2015 环境
 */
export default function App() {
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    // 扫描所有可能的环境变量位置
    const env = typeof process !== 'undefined' ? process.env : {};
    
    // 尝试安全地访问 Vite 环境变量
    let viteEnv = {};
    try {
      // 使用 window 检查或 try-catch 避免 esbuild 在 es2015 目标下报错
      viteEnv = (import.meta && import.meta.env) ? import.meta.env : {};
    } catch (e) {
      viteEnv = {};
    }
    
    setDebugInfo({
      "当前运行环境": typeof process !== 'undefined' ? "Node/CRA/Next.js" : "ESModules/Vite",
      "检测到 REACT_APP 前缀": !!env.REACT_APP_FIREBASE_CONFIG,
      "检测到 VITE 前缀": !!viteEnv.VITE_FIREBASE_CONFIG,
      "检测到 NEXT_PUBLIC 前缀": !!env.NEXT_PUBLIC_FIREBASE_CONFIG,
      "__firebase_config (模拟注入)": !!(window.__firebase_config),
      "命中相关变量键名": Object.keys({...env, ...viteEnv}).filter(key => 
        key.includes('CONFIG') || key.includes('FIREBASE') || key.includes('APP')
      )
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-green-400 p-8 font-mono text-sm leading-relaxed">
      <h1 className="text-xl font-bold border-b border-green-900 pb-4 mb-6 flex items-center gap-2">
        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
        Firebase 环境变量调试器 (已修复)
      </h1>
      
      <div className="space-y-6 max-w-2xl">
        <section className="bg-slate-900/50 p-4 rounded-lg border border-green-900/30">
          <h2 className="text-white mb-3 font-bold border-l-4 border-green-600 pl-2">1. 扫描结果</h2>
          <div className="space-y-2">
            {Object.entries(debugInfo).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b border-green-900/10 py-1">
                <span className="text-slate-400">{key}:</span>
                <span className={value === true ? "text-green-400 font-bold" : (Array.isArray(value) && value.length > 0 ? "text-blue-400" : "text-red-500")}>
                  {Array.isArray(value) ? (value.length > 0 ? value.join(', ') : '无') : String(value)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 p-5 rounded-xl border border-blue-900/50 shadow-xl">
          <h2 className="text-white mb-3 font-bold flex items-center gap-2">
             诊断建议
          </h2>
          {(!debugInfo["检测到 REACT_APP 前缀"] && !debugInfo["检测到 VITE 前缀"]) ? (
            <div className="text-amber-400 space-y-3">
              <p className="flex items-center gap-2 font-bold text-red-500">
                ❌ 状态：前端未读取到任何有效的加密配置。
              </p>
              <p className="text-slate-300">请按照以下步骤操作：</p>
              <ol className="list-decimal ml-5 space-y-2 text-slate-300">
                <li>前往 Vercel 项目设置 {'->'} Environment Variables。</li>
                <li>
                  <span className="text-white">关键步骤：</span> 
                  由于不确定你的框架，请同时添加 
                  <code className="mx-1 bg-black px-1.5 py-0.5 rounded text-pink-400 font-bold">VITE_FIREBASE_CONFIG</code> 
                  和 
                  <code className="mx-1 bg-black px-1.5 py-0.5 rounded text-blue-400 font-bold">REACT_APP_FIREBASE_CONFIG</code>。
                </li>
                <li>内容均为你的那段 JSON 字符串。</li>
                <li>
                  <span className="text-red-400 font-bold italic underline">必须重新部署：</span> 
                  在 Vercel 顶部菜单点击 Deployments {'->'} 选择最新一次 {'->'} 点击三个点 {'->'} 选 <b>Redeploy</b>。
                </li>
              </ol>
            </div>
          ) : (
            <div className="text-green-400">
              <p className="font-bold text-lg mb-2">✅ 变量已识别！</p>
              <p className="text-slate-400">系统已成功读取到配置。现在您可以将此调试器代码替换回之前的 Rummikub 游戏代码，游戏将能正常连接数据库。</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-slate-500 mb-2 text-xs uppercase tracking-widest">3. 变量内容快照 (脱敏)</h2>
          <div className="bg-black p-4 rounded border border-green-900/20 overflow-x-auto">
            <pre className="text-[10px] leading-tight">
              {JSON.stringify({
                CRA_Source: typeof process !== 'undefined' ? (process.env.REACT_APP_FIREBASE_CONFIG ? "已加载 (前5位: " + process.env.REACT_APP_FIREBASE_CONFIG.substring(0,5) + "...)" : "未找到") : "环境不支持",
                Vite_Source: "由于 ES2015 限制，请查阅上方扫描结果"
              }, null, 2)}
            </pre>
          </div>
        </section>
      </div>
      
      <div className="mt-10 flex gap-4">
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-green-900/50 hover:bg-green-800 text-green-100 rounded-lg border border-green-700 transition-all flex items-center gap-2"
        >
          <RefreshCw size={16} /> 刷新并重新检测
        </button>
      </div>
    </div>
  );
}