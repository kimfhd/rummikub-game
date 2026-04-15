import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken
} from 'firebase/auth';
import { Users, RefreshCw, ArrowRight } from 'lucide-react';

/**
 * 安全地获取 Firebase 配置
 * 适配 Canvas 预览环境与 Vercel 生产环境
 */
const getFirebaseConfig = () => {
  try {
    // 1. 预览环境：尝试从全局变量获取
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
    
    // 2. 生产环境：从环境变量获取 (注意：Vercel 需配置 REACT_APP_FIREBASE_CONFIG)
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_FIREBASE_CONFIG) {
      return JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);
    }

    // 3. 占位符：防止初始化崩溃
    return {
      apiKey: "unconfigured", 
      authDomain: "",
      projectId: "rummikub-v1",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    };
  } catch (e) {
    console.error("Firebase config error", e);
    return {};
  }
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'rummikub-v1';

const COLORS = [
  { name: 'black', text: 'text-slate-900' },
  { name: 'red', text: 'text-red-500' },
  { name: 'blue', text: 'text-blue-500' },
  { name: 'orange', text: 'text-orange-500' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [roomID, setRoomID] = useState('');
  const [gameState, setGameState] = useState(null);
  const [inputID, setInputID] = useState('');
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState('initializing');

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error", err);
        setAuthStatus('error');
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setAuthStatus('authenticated');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomID) return;

    const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomID);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameState(snapshot.data());
      } else {
        setRoomID('');
        setGameState(null);
      }
    }, (err) => {
        // 静默处理监听错误，避免 UI 崩溃
        console.debug("Firestore snapshot error", err);
    });

    return () => unsubscribe();
  }, [user, roomID]);

  const createRoom = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const id = Math.floor(1000 + Math.random() * 9000).toString();
      const deck = [];
      for (let i = 0; i < 2; i++) {
        COLORS.forEach(c => {
          for (let v = 1; v <= 13; v++) {
            deck.push({ id: `${c.name}-${v}-${i}`, value: v, colorClass: c.text, type: 'number' });
          }
        });
      }
      deck.push({ id: 'j1', value: '☻', colorClass: 'text-red-500', type: 'joker' });
      deck.push({ id: 'j2', value: '☻', colorClass: 'text-slate-900', type: 'joker' });
      
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
          [user.uid]: { uid: user.uid, name: `玩家 1`, hand: [] }
        },
        playerOrder: [user.uid],
        turnIndex: 0
      };

      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', id), initialData);
      setRoomID(id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!user || inputID.length !== 4) return;
    setLoading(true);
    try {
      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', inputID);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.playerOrder.includes(user.uid)) {
          if (data.playerOrder.length >= 4) return;
          const newPlayers = { ...data.players };
          newPlayers[user.uid] = { uid: user.uid, name: `玩家 ${data.playerOrder.length + 1}`, hand: [] };
          await updateDoc(roomRef, {
            playerOrder: [...data.playerOrder, user.uid],
            players: newPlayers
          });
        }
        setRoomID(inputID);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (authStatus === 'initializing') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <RefreshCw className="animate-spin mb-4 text-blue-500" />
        <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">加载中...</p>
      </div>
    );
  }

  if (!roomID) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black italic text-blue-600 tracking-tighter">RUMMIKUB</h1>
          <p className="text-slate-500 text-[10px] tracking-[0.5em] mt-2 font-black uppercase">Online Arena</p>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <button 
            onClick={createRoom} 
            disabled={loading}
            className="w-full h-16 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-lg shadow-xl shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '处理中...' : '创建新房间'}
          </button>
          <div className="relative flex items-center">
            <input 
              type="text" placeholder="房间号" maxLength={4} value={inputID}
              onChange={e => setInputID(e.target.value.replace(/\D/g, ''))}
              className="w-full h-16 bg-slate-900 border-2 border-slate-800 rounded-2xl text-center text-2xl font-mono focus:border-blue-500 focus:outline-none transition-all"
            />
            <button onClick={joinRoom} className="absolute right-2 p-3 bg-slate-800 rounded-xl text-blue-400 hover:text-white transition-colors">
              <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isMyTurn = gameState?.playerOrder[gameState.turnIndex] === user?.uid;
  const myData = gameState?.players[user?.uid];

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col font-sans overflow-hidden">
      <header className="p-4 bg-slate-900/90 border-b border-white/5 flex justify-between items-center shadow-2xl z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 px-3 py-1 rounded-lg border border-blue-500/30">
            <span className="font-mono font-black text-blue-400">#{roomID}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {gameState?.playerOrder.map((uid, idx) => (
            <div key={uid} className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase transition-all ${idx === gameState.turnIndex ? 'bg-blue-600 border-blue-400 scale-105 shadow-lg shadow-blue-900/40' : 'bg-slate-800 border-transparent opacity-30'}`}>
              {uid === user?.uid ? 'Me' : `P${idx+1}`}
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#020617_100%)]">
        {gameState?.status === 'waiting' ? (
          <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="bg-slate-900/50 p-8 rounded-3xl border border-white/5 text-center">
              <Users size={48} className="text-blue-500 mx-auto mb-4 opacity-40" />
              <p className="text-slate-400 font-black tracking-widest text-xs uppercase mb-1">等待对局开始</p>
              <p className="text-2xl font-bold">{gameState.playerOrder.length} / 4 玩家已就绪</p>
            </div>
            {gameState.playerOrder[0] === user?.uid && gameState.playerOrder.length >= 2 && (
              <button onClick={() => updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomID), { status: 'playing' })} className="bg-green-600 hover:bg-green-500 px-12 py-4 rounded-2xl font-black shadow-2xl shadow-green-900/40 transition-all active:scale-95">开始发牌</button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center">
            {gameState?.boardMelds.length === 0 && (
              <div className="mt-20 text-slate-700 font-bold uppercase tracking-widest text-sm">空牌桌</div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-4 pb-8 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-4xl mx-auto flex justify-between items-center mb-4">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${isMyTurn ? 'bg-blue-600 shadow-lg shadow-blue-900/50 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
            {isMyTurn ? '你的回合' : '等待对手...'}
          </div>
          <button disabled={!isMyTurn} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-10 transition-all">摸牌</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide min-h-[85px] items-end px-2">
          {myData?.hand.map(tile => (
            <div key={tile.id} className={`w-11 h-15 bg-white rounded-lg flex-shrink-0 flex items-center justify-center font-black text-xl shadow-xl transition-all hover:-translate-y-2 cursor-grab ${tile.colorClass}`}>
              {tile.value}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}