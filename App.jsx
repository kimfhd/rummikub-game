import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, 
  updateDoc, deleteDoc, collection 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { Users, Plus, LogIn, Trophy, RefreshCw, Trash2, ArrowRight } from 'lucide-react';

// --- Firebase 初始化 ---
const firebaseConfig = JSON.parse(__firebase_config); 
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'rummikub-v1';

// --- 游戏常量 ---
const COLORS = [
  { name: 'black', text: 'text-slate-900', bg: 'bg-slate-900' },
  { name: 'red', text: 'text-red-500', bg: 'bg-red-500' },
  { name: 'blue', text: 'text-blue-500', bg: 'bg-blue-500' },
  { name: 'orange', text: 'text-orange-500', bg: 'bg-orange-500' }
];

const App = () => {
  const [user, setUser] = useState(null);
  const [roomID, setRoomID] = useState('');
  const [gameState, setGameState] = useState(null);
  const [inputID, setInputID] = useState('');
  const [loading, setLoading] = useState(false);
  const [authInitializing, setAuthInitializing] = useState(true);

  // 1. 匿名登录
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        setAuthInitializing(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setAuthInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 实时监听房间数据
  useEffect(() => {
    if (!user || !roomID) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomID);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameState(snapshot.data());
      } else {
        setRoomID('');
        setGameState(null);
      }
    }, (error) => {
      console.error("监听失败:", error);
    });

    return () => unsubscribe();
  }, [user, roomID]);

  // --- 游戏逻辑函数 ---

  // 创建房间
  const createRoom = async () => {
    if (!user) {
      alert("正在连接服务器，请稍后再试...");
      return;
    }
    setLoading(true);
    try {
      const id = Math.floor(1000 + Math.random() * 9000).toString();
      const deck = [];
      // 生成104张牌 + 2张鬼牌
      for (let i = 0; i < 2; i++) {
        COLORS.forEach(c => {
          for (let v = 1; v <= 13; v++) {
            deck.push({ id: `${c.name}-${v}-${i}`, value: v, colorClass: c.text, type: 'number' });
          }
        });
      }
      deck.push({ id: 'joker-red', value: '☻', colorClass: 'text-red-500', type: 'joker' });
      deck.push({ id: 'joker-black', value: '☻', colorClass: 'text-slate-900', type: 'joker' });
      
      // 洗牌
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      const initialData = {
        roomId: id,
        status: 'waiting',
        deck: deck,
        boardMelds: [],
        players: {
          [user.uid]: {
            uid: user.uid,
            name: `玩家 1`,
            hand: [],
            isReady: false
          }
        },
        playerOrder: [user.uid],
        turnIndex: 0
      };

      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', id), initialData);
      setRoomID(id);
    } catch (err) {
      console.error("Create room error:", err);
      alert("创建房间失败");
    } finally {
      setLoading(false);
    }
  };

  // 加入房间
  const joinRoom = async () => {
    if (!user) return;
    if (inputID.length !== 4) return;
    setLoading(true);
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', inputID);
      const snap = await getDoc(roomRef);
      
      if (snap.exists()) {
        const data = snap.data();
        if (!data.playerOrder.includes(user.uid)) {
          if (data.playerOrder.length >= 4) {
            alert("房间已满");
            return;
          }
          const updatedPlayers = { ...data.players };
          updatedPlayers[user.uid] = {
            uid: user.uid,
            name: `玩家 ${data.playerOrder.length + 1}`,
            hand: [],
            isReady: false
          };
          await updateDoc(roomRef, {
            playerOrder: [...data.playerOrder, user.uid],
            players: updatedPlayers
          });
        }
        setRoomID(inputID);
      } else {
        alert("房间号不存在");
      }
    } catch (err) {
      console.error("Join room error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 开始游戏 (发牌)
  const startGame = async () => {
    if (!gameState) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomID);
    const newDeck = [...gameState.deck];
    const newPlayers = { ...gameState.players };

    gameState.playerOrder.forEach(uid => {
      newPlayers[uid].hand = newDeck.splice(0, 14);
    });

    await updateDoc(roomRef, {
      status: 'playing',
      deck: newDeck,
      players: newPlayers
    });
  };

  // 摸牌逻辑
  const handleDraw = async () => {
    if (!gameState || !user) return;
    if (gameState.playerOrder[gameState.turnIndex] !== user.uid) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomID);
    
    const newDeck = [...gameState.deck];
    if (newDeck.length === 0) {
      alert("牌堆已空！");
      return;
    }
    const drawnTile = newDeck.pop();
    const newPlayers = { ...gameState.players };
    newPlayers[user.uid].hand.push(drawnTile);

    await updateDoc(roomRef, {
      deck: newDeck,
      players: newPlayers,
      turnIndex: (gameState.turnIndex + 1) % gameState.playerOrder.length
    });
  };

  // --- UI渲染 ---

  // 初始加载或未登录
  if (authInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-blue-500" size={32} />
          <p className="text-slate-400 font-bold tracking-widest text-xs uppercase">正在初始化身份...</p>
        </div>
      </div>
    );
  }

  // 初始界面
  if (!roomID) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-black italic tracking-tighter text-blue-500 mb-2">RUMMIKUB</h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">在线对战版</p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <button 
            onClick={createRoom}
            disabled={loading || !user}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed h-16 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg transition-all shadow-lg shadow-blue-900/20 active:scale-95"
          >
            <Plus size={24} /> {loading ? '创建中...' : '创建新房间'}
          </button>

          <div className="relative flex items-center">
            <input 
              type="text"
              placeholder="输入4位房间号"
              maxLength={4}
              value={inputID}
              onChange={(e) => setInputID(e.target.value)}
              disabled={loading || !user}
              className="w-full h-16 bg-slate-900 border-2 border-slate-800 rounded-2xl px-6 text-center text-2xl font-mono focus:border-blue-500 focus:outline-none transition-all disabled:opacity-50"
            />
            <button 
              onClick={joinRoom}
              disabled={loading || !user || inputID.length !== 4}
              className="absolute right-2 p-3 bg-slate-800 rounded-xl hover:text-blue-400 disabled:opacity-50"
            >
              <ArrowRight />
            </button>
          </div>
          {!user && <p className="text-red-400 text-center text-xs">认证失败，请检查网络连接</p>}
        </div>
      </div>
    );
  }

  // 游戏房间界面
  const isMyTurn = gameState?.playerOrder[gameState.turnIndex] === user?.uid;
  const myData = user ? gameState?.players[user.uid] : null;

  return (
    <div className="h-screen bg-slate-950 flex flex-col text-white overflow-hidden">
      {/* 顶部状态 */}
      <header className="p-4 bg-slate-900/50 flex justify-between items-center shrink-0 border-b border-white/5">
        <div className="flex gap-4 items-center">
          <div className="bg-slate-800 px-3 py-1 rounded-lg">
            <span className="text-[10px] text-slate-500 block font-bold">房间</span>
            <span className="font-mono font-bold text-blue-400">#{roomID}</span>
          </div>
          <div className="bg-slate-800 px-3 py-1 rounded-lg">
            <span className="text-[10px] text-slate-500 block font-bold">牌堆</span>
            <span className="font-bold">{gameState?.deck?.length || 0}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {gameState?.playerOrder.map((uid, idx) => (
            <div key={uid} className={`flex flex-col items-center px-3 py-1 rounded-xl border transition-all ${idx === gameState.turnIndex ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-transparent opacity-40'}`}>
              <span className="text-[9px] font-bold uppercase">{uid === user?.uid ? '我' : `玩家${idx+1}`}</span>
              <div className="w-1 h-1 bg-current rounded-full mt-1"></div>
            </div>
          ))}
        </div>
      </header>

      {/* 游戏桌子 */}
      <main className="flex-1 overflow-y-auto p-4 bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#020617_100%)]">
        {gameState?.status === 'waiting' ? (
          <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="text-center">
              <Users size={48} className="mx-auto text-blue-500 mb-4 opacity-50" />
              <p className="text-slate-400 font-medium">等待其他玩家加入...</p>
              <p className="text-xs text-slate-600 mt-2">当前人数: {gameState.playerOrder.length}/4</p>
            </div>
            {gameState.playerOrder[0] === user?.uid && gameState.playerOrder.length >= 2 && (
              <button 
                onClick={startGame}
                className="bg-green-600 hover:bg-green-500 px-12 py-4 rounded-2xl font-black shadow-xl shadow-green-900/20 transition-all active:scale-95"
              >
                开始发牌
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {gameState?.boardMelds?.map((meld, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-wrap gap-2 min-h-[100px] content-start">
                {meld.map(tile => (
                  <div key={tile.id} className={`w-10 h-14 bg-white rounded flex items-center justify-center font-black text-lg shadow-md ${tile.colorClass}`}>
                    {tile.value}
                  </div>
                ))}
              </div>
            ))}
            {isMyTurn && (
              <div className="border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-[10px] text-white/20 font-bold uppercase h-[100px]">
                点击此处创建牌组 (开发中)
              </div>
            )}
          </div>
        )}
      </main>

      {/* 底部操作区 */}
      <footer className="bg-slate-900 p-4 border-t border-white/10 shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-3">
               <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${isMyTurn ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                 {isMyTurn ? '你的回合' : '等待中'}
               </span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDraw} disabled={!isMyTurn} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold disabled:opacity-20 transition-all">摸牌并结束回合</button>
              <button disabled={!isMyTurn} className="px-6 py-2 bg-blue-600 rounded-xl text-xs font-black disabled:opacity-20 shadow-lg shadow-blue-900/40 transition-all">确认操作</button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide min-h-[90px] items-end">
            {myData?.hand?.map(tile => (
              <div 
                key={tile.id}
                className={`w-12 h-16 bg-white rounded-lg flex-shrink-0 flex items-center justify-center font-black text-2xl shadow-xl ${tile.colorClass} active:scale-110 transition-transform cursor-grab`}
              >
                {tile.value}
              </div>
            ))}
            {(!myData?.hand || myData.hand.length === 0) && gameState?.status === 'playing' && (
              <div className="w-full text-center py-4 text-slate-700 text-xs font-bold uppercase tracking-widest">手牌已空！</div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;