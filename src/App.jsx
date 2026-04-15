/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, 
  updateDoc, collection 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken
} from 'firebase/auth';
import { Users, RefreshCw, ArrowRight, ShieldAlert, WifiOff } from 'lucide-react';

// -----------------------------------------------------------------------------
// 1. Firebase 初始化逻辑 (适配 Vercel 环境变量)
// -----------------------------------------------------------------------------
const getSafeConfig = () => {
  // 优先尝试环境注入
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
  }

  // 尝试读取 Vercel 环境变量 (React App / Vite / Next.js 全兼容匹配)
  const env = typeof process !== 'undefined' ? process.env : {};
  const configStr = env.REACT_APP_FIREBASE_CONFIG || env.VITE_FIREBASE_CONFIG || env.NEXT_PUBLIC_FIREBASE_CONFIG;

  if (configStr) {
    try {
      // 如果是字符串形式的 JSON，进行解析
      return typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
    } catch (e) {
      console.error("Firebase Config Parse Error:", e);
      return null;
    }
  }
  return null;
};

const firebaseConfig = getSafeConfig();
let app, auth, db;

if (firebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'rummikub-multiplayer';

// -----------------------------------------------------------------------------
// 2. 主程序组件
// -----------------------------------------------------------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [roomID, setRoomID] = useState('');
  const [gameState, setGameState] = useState(null);
  const [inputID, setInputID] = useState('');
  const [status, setStatus] = useState(firebaseConfig ? 'initializing' : 'config_missing');

  useEffect(() => {
    if (!auth) return;

    const initConnection = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Failed:", err);
        setStatus('auth_error');
      }
    };

    initConnection();
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setStatus('ready');
      }
    });
  }, []);

  // 监听房间数据
  useEffect(() => {
    if (!user || !roomID || !db) return;
    
    // 遵循 RULE 1: 使用特定的路径结构
    const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomID);
    
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data());
      } else {
        console.log("Room does not exist");
      }
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });

    return () => unsubscribe();
  }, [user, roomID]);

  // 创建房间
  const handleCreateRoom = async () => {
    if (!user || !db) return;
    const newRoomID = Math.floor(1000 + Math.random() * 9000).toString();
    const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', newRoomID);
    
    try {
      await setDoc(roomRef, {
        roomId: newRoomID,
        host: user.uid,
        players: { [user.uid]: { name: "Player 1", hand: [] } },
        playerOrder: [user.uid],
        status: 'waiting',
        board: [],
        lastUpdated: Date.now()
      });
      setRoomID(newRoomID);
    } catch (e) {
      console.error("Create Room Failed:", e);
    }
  };

  // -----------------------------------------------------------------------------
  // 3. UI 渲染渲染
  // -----------------------------------------------------------------------------

  // 错误状态：配置缺失
  if (status === 'config_missing') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-10 text-center">
        <ShieldAlert size={80} className="text-red-500 mb-6" />
        <h1 className="text-2xl font-bold text-white mb-4">环境变量未生效</h1>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-left max-w-md w-full mb-8">
          <p className="text-slate-400 text-sm mb-4 font-mono">
            检测到环境变量 <code className="text-amber-400">REACT_APP_FIREBASE_CONFIG</code> 暂不可用。
          </p>
          <ul className="text-slate-300 text-sm space-y-2 list-disc ml-4">
            <li>如果你刚刚在 Vercel 添加了变量，请执行 <b>Redeploy</b>。</li>
            <li>如果你使用的是 Vite，请将变量名改为 <code className="text-blue-400">VITE_FIREBASE_CONFIG</code>。</li>
            <li>确保你的代码仓库已推送到 GitHub 并触发了 Vercel 的构建。</li>
          </ul>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-white text-black px-8 py-3 rounded-full font-bold flex items-center gap-2"
        >
          <RefreshCw size={20} /> 检查更新
        </button>
      </div>
    );
  }

  // 加载状态
  if (status === 'initializing' || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Connecting to Firebase...</p>
      </div>
    );
  }

  // 初始大厅
  if (!roomID) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <h1 className="text-5xl font-black text-white italic mb-12 tracking-tighter">RUMMIKUB<span className="text-blue-600">.</span></h1>
        <div className="w-full max-w-xs space-y-4">
          <button 
            onClick={handleCreateRoom}
            className="w-full h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-all active:scale-95"
          >
            创建房间
          </button>
          <div className="relative group">
            <input 
              type="text" 
              placeholder="输入4位房间号" 
              value={inputID}
              onChange={(e) => setInputID(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full h-16 bg-slate-900 border-2 border-slate-800 rounded-2xl text-center text-2xl font-mono text-white focus:border-blue-500 outline-none transition-colors"
            />
            {inputID.length === 4 && (
              <button 
                onClick={() => setRoomID(inputID)}
                className="absolute right-2 top-2 h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white"
              >
                <ArrowRight />
              </button>
            )}
          </div>
        </div>
        <p className="mt-12 text-slate-600 text-xs font-mono uppercase">User ID: {user.uid.slice(0,8)}...</p>
      </div>
    );
  }

  // 游戏房间 UI
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <header className="h-16 border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-mono font-bold tracking-wider">ROOM: {roomID}</span>
        </div>
        <button 
          onClick={() => { setRoomID(''); setGameState(null); }}
          className="text-xs font-bold text-slate-500 hover:text-white transition-colors"
        >
          离开
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center">
        {gameState ? (
          <div className="text-center">
            <Users size={40} className="mx-auto mb-4 text-blue-500" />
            <h2 className="text-xl font-bold mb-2">房间已就绪</h2>
            <p className="text-slate-400">当前玩家数量: {Object.keys(gameState.players).length}</p>
            <div className="mt-6 p-4 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-blue-400">
              等待房主开始游戏...
            </div>
          </div>
        ) : (
          <div className="text-center animate-pulse">
            <WifiOff size={40} className="mx-auto mb-4 text-slate-700" />
            <p className="text-slate-600 font-medium">正在检索房间信息...</p>
          </div>
        )}
      </main>

      <footer className="h-40 bg-slate-900/80 border-t border-white/5 p-4 flex flex-col items-center justify-center text-slate-500">
        <p className="text-[10px] uppercase tracking-[0.2em] mb-4">Player Dashboard</p>
        <div className="flex gap-2">
           {[1,2,3,4,5,6].map(i => (
             <div key={i} className="w-10 h-14 bg-slate-800 rounded-lg border border-slate-700/50"></div>
           ))}
        </div>
      </footer>
    </div>
  );
}