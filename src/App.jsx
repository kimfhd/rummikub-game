/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  arrayUnion,
  query
} from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  LogOut, 
  Trophy, 
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  AlertCircle
} from 'lucide-react';

// --- 安全初始化函数 ---
const initFirebase = () => {
  try {
    const config = JSON.parse(__firebase_config);
    const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    const auth = getAuth(app);
    const db = getFirestore(app);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'rummikub-v1';
    return { auth, db, appId, available: true };
  } catch (e) {
    console.error("Firebase config error:", e);
    return { available: false, error: e.message };
  }
};

const fb = initFirebase();

// --- 游戏逻辑常量 ---
const COLORS = ['red', 'blue', 'orange', 'black'];
const NUMBERS = Array.from({ length: 13 }, (_, i) => i + 1);

const generateDeck = () => {
  const deck = [];
  for (let i = 0; i < 2; i++) {
    COLORS.forEach(color => {
      NUMBERS.forEach(num => {
        deck.push({ id: `${color}-${num}-${i}`, color, number: num, type: 'normal' });
      });
    });
  }
  deck.push({ id: 'joker-1', color: 'joker', number: 0, type: 'joker' });
  deck.push({ id: 'joker-2', color: 'joker', number: 0, type: 'joker' });
  return deck.sort(() => Math.random() - 0.5);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputID, setInputID] = useState('');

  // 1. 身份验证逻辑
  useEffect(() => {
    if (!fb.available) {
      setError("Firebase 配置加载失败，请检查环境。");
      setLoading(false);
      return;
    }

    const startAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(fb.auth, __initial_auth_token);
        } else {
          await signInAnonymously(fb.auth);
        }
      } catch (err) {
        console.error("Auth Failure:", err);
        setError("登录失败: " + err.message);
      }
    };

    startAuth();
    const unsubscribe = onAuthStateChanged(fb.auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 房间列表监听
  useEffect(() => {
    if (!user || !fb.available) return;
    const roomsCol = collection(fb.db, 'artifacts', fb.appId, 'public', 'data', 'rooms');
    const q = query(roomsCol); // 简单查询，Rule 2
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(list);
    }, (err) => {
      console.error("Snapshot error:", err);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. 游戏状态同步
  useEffect(() => {
    if (!user || !currentRoomId || !fb.available) {
      setGameState(null);
      return;
    }
    const roomRef = doc(fb.db, 'artifacts', fb.appId, 'public', 'data', 'rooms', currentRoomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data());
      } else {
        setCurrentRoomId(null);
      }
    }, (err) => {
      console.error("Room sync error:", err);
      setError("同步房间状态失败");
    });
    return () => unsubscribe();
  }, [user, currentRoomId]);

  // 动作处理
  const handleCreateRoom = async () => {
    if (!user) return;
    const rid = Math.random().toString(36).substring(7).toUpperCase();
    const roomData = {
      id: rid,
      hostId: user.uid,
      hostName: `Player-${user.uid.slice(0, 4)}`,
      players: [{ uid: user.uid, name: `Player-${user.uid.slice(0, 4)}`, hand: [] }],
      status: 'waiting',
      board: [],
      deck: [],
      turnIndex: 0,
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(fb.db, 'artifacts', fb.appId, 'public', 'data', 'rooms', rid), roomData);
      setCurrentRoomId(rid);
    } catch (e) {
      setError("创建房间失败");
    }
  };

  const handleJoinRoom = async (id) => {
    if (!id || !user) return;
    const targetId = id.trim().toUpperCase();
    const ref = doc(fb.db, 'artifacts', fb.appId, 'public', 'data', 'rooms', targetId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setError("找不到该房间");
        return;
      }
      const data = snap.data();
      if (data.players.some(p => p.uid === user.uid)) {
        setCurrentRoomId(targetId);
        return;
      }
      if (data.players.length >= 4) {
        setError("房间已满");
        return;
      }
      await updateDoc(ref, {
        players: arrayUnion({ uid: user.uid, name: `Player-${user.uid.slice(0, 4)}`, hand: [] })
      });
      setCurrentRoomId(targetId);
    } catch (e) {
      setError("加入失败");
    }
  };

  // 渲染帮助组件
  const Tile = ({ tile, size = "md" }) => {
    if (!tile) return null;
    const colorClasses = {
      red: 'text-red-600 border-red-200',
      blue: 'text-blue-600 border-blue-200',
      orange: 'text-orange-500 border-orange-200',
      black: 'text-slate-900 border-slate-300',
      joker: 'text-purple-600 border-purple-200 bg-purple-50'
    };
    return (
      <div className={`
        ${size === 'sm' ? 'w-8 h-10 text-sm' : 'w-11 h-16 text-xl'}
        bg-white border-2 rounded-lg flex flex-col items-center justify-center font-black shadow-sm
        ${colorClasses[tile.color] || 'text-gray-400'}
      `}>
        {tile.type === 'joker' ? '★' : tile.number}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <RefreshCw className="animate-spin mb-4 text-orange-500" size={40} />
        <p className="animate-pulse">正在准备游戏环境...</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={60} />
        <h2 className="text-xl font-bold mb-2">系统启动失败</h2>
        <p className="text-slate-400 mb-6 max-w-md">{error}</p>
        <button onClick={() => window.location.reload()} className="bg-slate-700 px-6 py-2 rounded-xl">重试</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* 顶部导航 */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <LayoutGrid size={20} className="text-white" />
          </div>
          <span className="font-black tracking-tighter text-lg">RUMMIKUB<span className="text-orange-500 italic">PRO</span></span>
        </div>
        {user && (
          <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
            <span className="hidden sm:inline">UID: {user.uid.slice(0, 8)}</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {!currentRoomId ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-orange-500 to-red-600 p-8 rounded-3xl shadow-2xl shadow-orange-500/20 group overflow-hidden relative">
                <div className="relative z-10">
                  <h2 className="text-3xl font-black mb-2 italic">准备好了吗？</h2>
                  <p className="text-white/80 mb-6">创建一个新房间，邀请好友或等待路人加入。</p>
                  <button onClick={handleCreateRoom} className="bg-white text-orange-600 px-8 py-3 rounded-2xl font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-lg">
                    <Plus size={20} /> 创建房间
                  </button>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                  <LayoutGrid size={160} />
                </div>
              </div>

              <div className="bg-slate-900 border border-white/5 p-8 rounded-3xl flex flex-col justify-center">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Users className="text-orange-500" size={24} /> 快速加入
                </h3>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="输入 6 位房间 ID..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 focus:border-orange-500 transition-colors uppercase outline-none"
                    value={inputID}
                    onChange={(e) => setInputID(e.target.value)}
                  />
                  <button onClick={() => handleJoinRoom(inputID)} className="bg-slate-800 hover:bg-slate-700 px-6 rounded-2xl font-bold">加入</button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <RefreshCw size={18} className="text-orange-500" /> 正在等待的对局
                </h3>
                <span className="text-xs text-slate-500">{rooms.length} 个活跃房间</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.length === 0 ? (
                  <div className="col-span-full py-20 bg-white/5 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500">
                    <p>目前还没有房间，去创建一个吧！</p>
                  </div>
                ) : (
                  rooms.map(room => (
                    <div key={room.id} className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl hover:bg-slate-900 transition-colors group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] text-orange-500 font-mono tracking-widest uppercase mb-1">Room ID: {room.id}</p>
                          <h4 className="font-bold text-lg">{room.hostName || '房主'}</h4>
                        </div>
                        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded text-xs">
                          <Users size={12} /> {room.players?.length || 0}/4
                        </div>
                      </div>
                      <button 
                        disabled={room.status === 'playing' || (room.players?.length || 0) >= 4}
                        onClick={() => handleJoinRoom(room.id)}
                        className="w-full bg-slate-800 group-hover:bg-orange-600 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        {room.status === 'playing' ? '对局中' : '加入对局'} <ChevronRight size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* 游戏内 UI */}
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-white/5">
              <button 
                onClick={() => {
                  if (confirm("确定要离开房间吗？")) {
                    setCurrentRoomId(null);
                  }
                }}
                className="text-slate-400 hover:text-white flex items-center gap-2 text-sm"
              >
                <LogOut size={16} /> 离开房间
              </button>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500 font-mono italic">#{currentRoomId}</span>
                <div className="px-3 py-1 bg-orange-500/10 text-orange-500 rounded-full text-xs font-bold uppercase tracking-tighter">
                  {gameState?.status || '等待中'}
                </div>
              </div>
            </div>

            {gameState?.status === 'waiting' ? (
              <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                <h2 className="text-2xl font-black mb-6">等待对局开始...</h2>
                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  {(gameState.players || []).map(p => (
                    <div key={p.uid} className="flex flex-col items-center gap-2">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${p.uid === user.uid ? 'bg-orange-500 shadow-lg shadow-orange-500/30' : 'bg-slate-800'}`}>
                        <Users size={24} />
                      </div>
                      <span className="text-xs font-bold">{p.name}</span>
                    </div>
                  ))}
                </div>
                {gameState.hostId === user.uid && (
                  <button className="bg-green-600 hover:bg-green-500 px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 transition-all">
                    开始游戏
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                 {/* 这里以后可以扩展对局内复杂的 Rummikub 棋盘逻辑 */}
                 <div className="p-12 text-center bg-slate-900 rounded-3xl border border-white/5">
                    <LayoutGrid className="mx-auto mb-4 text-slate-700" size={48} />
                    <p className="text-slate-500 italic">游戏正在进行中，棋盘功能开发中...</p>
                 </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 全局错误浮层 */}
      {error && user && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <AlertCircle size={20} />
          <span className="font-bold">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-50">✕</button>
        </div>
      )}
    </div>
  );
}