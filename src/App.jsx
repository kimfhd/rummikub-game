/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
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
  runTransaction 
} from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  LogOut, 
  Play, 
  Trophy, 
  MessageCircle, 
  ChevronRight,
  RefreshCw,
  Hash,
  LayoutGrid,
  AlertCircle
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'rummikub-pro-v1';

// --- Game Constants & Logic ---
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
  const [currentRoom, setCurrentRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputID, setInputID] = useState('');

  // --- Auth Effect ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setError("身份验证失败，请确保 Firebase 已启用匿名登录。");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Rooms Listener ---
  useEffect(() => {
    if (!user) return;
    const roomsCol = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
    const unsubscribe = onSnapshot(roomsCol, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomList);
    }, (err) => {
      console.error("Rooms listener error:", err);
      setError("无法获取房间列表");
    });
    return () => unsubscribe();
  }, [user]);

  // --- Game State Listener ---
  useEffect(() => {
    if (!user || !currentRoom) {
      setGameState(null);
      return;
    }
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoom.id);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data());
      } else {
        setCurrentRoom(null);
        setGameState(null);
      }
    }, (err) => {
      console.error("Game sync error:", err);
      setError("游戏同步中断");
    });
    return () => unsubscribe();
  }, [user, currentRoom]);

  // --- Actions ---
  const createRoom = async () => {
    if (!user) return;
    const roomId = Math.random().toString(36).substring(7).toUpperCase();
    const newRoom = {
      id: roomId,
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
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), newRoom);
      setCurrentRoom({ id: roomId });
    } catch (err) {
      setError("创建房间失败: " + err.message);
    }
  };

  const joinRoom = async (roomOrId) => {
    if (!user) return;
    const targetRoomId = typeof roomOrId === 'string' ? roomOrId.toUpperCase() : roomOrId.id;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', targetRoomId);
    
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setError("房间不存在");
        return;
      }
      const data = snap.data();
      if (data.players.find(p => p.uid === user.uid)) {
        setCurrentRoom({ id: targetRoomId });
        return;
      }
      if (data.players.length >= 4) {
        setError("房间已满");
        return;
      }

      await updateDoc(roomRef, {
        players: arrayUnion({ uid: user.uid, name: `Player-${user.uid.slice(0, 4)}`, hand: [] })
      });
      setCurrentRoom({ id: targetRoomId });
    } catch (err) {
      setError("加入房间失败: " + err.message);
    }
  };

  const startGame = async () => {
    if (!gameState || gameState.hostId !== user.uid) return;
    const fullDeck = generateDeck();
    const updatedPlayers = gameState.players.map(p => ({
      ...p,
      hand: fullDeck.splice(0, 14)
    }));

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', gameState.id);
    await updateDoc(roomRef, {
      status: 'playing',
      deck: fullDeck,
      players: updatedPlayers,
      turnIndex: 0
    });
  };

  const drawTile = async () => {
    if (!gameState) return;
    const currentPlayer = gameState.players[gameState.turnIndex];
    if (currentPlayer?.uid !== user.uid) return;
    if (gameState.deck.length === 0) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', gameState.id);
    const newDeck = [...gameState.deck];
    const tile = newDeck.pop();
    
    const newPlayers = gameState.players.map(p => {
      if (p.uid === user.uid) {
        return { ...p, hand: [...p.hand, tile] };
      }
      return p;
    });

    await updateDoc(roomRef, {
      deck: newDeck,
      players: newPlayers,
      turnIndex: (gameState.turnIndex + 1) % gameState.players.length
    });
  };

  const leaveRoom = async () => {
    if (!currentRoom) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoom.id);
    
    try {
      if (gameState?.hostId === user.uid) {
        await deleteDoc(roomRef);
      } else if (gameState) {
        const filteredPlayers = gameState.players.filter(p => p.uid !== user.uid);
        await updateDoc(roomRef, { players: filteredPlayers });
      }
      setCurrentRoom(null);
    } catch (err) {
      setCurrentRoom(null);
    }
  };

  // --- Tile Component ---
  const Tile = ({ tile, size = "md", onClick }) => {
    const isJoker = tile.type === 'joker';
    const colorMap = {
      red: 'text-red-500 border-red-500',
      blue: 'text-blue-500 border-blue-500',
      orange: 'text-orange-400 border-orange-400',
      black: 'text-zinc-800 border-zinc-800',
      joker: 'text-purple-600 border-purple-500'
    };

    const sizeClasses = {
      sm: 'w-8 h-10 text-xs',
      md: 'w-10 h-14 text-lg',
      lg: 'w-12 h-16 text-xl'
    };

    return (
      <div 
        onClick={onClick}
        className={`${sizeClasses[size]} bg-amber-50 rounded-md border-2 shadow-sm flex flex-col items-center justify-center font-bold cursor-pointer hover:scale-105 transition-transform select-none ${colorMap[tile.color]}`}
      >
        {isJoker ? (
          <div className="text-center leading-none">
            <span className="block text-[8px]">JOKER</span>
            <span className="text-xl">☺</span>
          </div>
        ) : (
          tile.number
        )}
        <div className="w-full h-1 bg-current opacity-10 mt-1"></div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
      <RefreshCw className="animate-spin mr-3" size={24} />
      正在连接服务器...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-70 font-bold text-lg">×</button>
        </div>
      )}

      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-2 rounded-xl shadow-lg shadow-orange-500/20">
            <LayoutGrid className="text-slate-900" size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
            RUMMIKUB PRO
          </h1>
        </div>
        
        {user && (
          <div className="flex items-center gap-4 bg-slate-900/50 p-1 pl-4 rounded-full border border-slate-800">
            <span className="text-sm font-medium opacity-60">ID: {user.uid.slice(0, 6)}</span>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">
              {user.uid[0]?.toUpperCase() || '?'}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto">
        {!currentRoom || !gameState ? (
          /* Lobby UI */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold">游戏大厅</h2>
                  <p className="text-slate-400 mt-1">加入现有的房间或创建一个新房间</p>
                </div>
                <button 
                  onClick={createRoom}
                  className="bg-orange-500 hover:bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                >
                  <Plus size={20} /> 创建房间
                </button>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={inputID}
                  onChange={(e) => setInputID(e.target.value)}
                  placeholder="输入房间 ID 直接加入..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-orange-500 transition-colors uppercase font-mono"
                />
                <button 
                  onClick={() => joinRoom(inputID)}
                  className="bg-slate-800 hover:bg-slate-700 px-6 rounded-xl font-bold"
                >
                  加入
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
                    <Users className="mx-auto text-slate-700 mb-4" size={48} />
                    <p className="text-slate-500 text-lg">当前没有正在等待的房间</p>
                  </div>
                ) : (
                  rooms.map(room => (
                    <div 
                      key={room.id}
                      className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 hover:border-orange-500/50 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-slate-800 px-3 py-1 rounded-lg text-xs font-mono text-orange-400">
                          #{room.id}
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${room.status === 'playing' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                          {room.status === 'playing' ? '进行中' : '待加入'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mb-1">{room.hostName} 的房间</h3>
                      <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
                        <Users size={14} />
                        <span>{room.players?.length || 0} / 4 玩家</span>
                      </div>
                      <button 
                        disabled={room.status === 'playing' || room.players?.length >= 4}
                        onClick={() => joinRoom(room)}
                        className="w-full bg-slate-800 hover:bg-orange-500 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group-hover:bg-orange-500"
                      >
                        加入游戏 <ChevronRight size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 rounded-3xl p-6 border border-indigo-500/20">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Trophy className="text-amber-400" size={20} /> 游戏规则
                </h3>
                <ul className="text-sm text-slate-400 space-y-3 list-disc pl-4">
                  <li>第一个将手中 14 张牌全部打出的玩家获胜。</li>
                  <li>每次出牌至少需要 3 张以上的组合。</li>
                  <li>组合分为：同色顺子 (1-2-3) 或 异色同数 (8-8-8)。</li>
                  <li>第一次出牌（开局）总分必须大于等于 30 分。</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Game Area */
          <div className="flex flex-col h-[calc(100vh-140px)]">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-6">
                <button 
                  onClick={leaveRoom}
                  className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold"
                >
                  <LogOut size={18} /> 退出房间
                </button>
                <div className="h-6 w-[1px] bg-slate-700"></div>
                <div className="flex items-center gap-2">
                  <Hash className="text-orange-500" size={16} />
                  <span className="font-mono text-sm uppercase tracking-wider">{currentRoom.id}</span>
                </div>
              </div>

              {gameState.status === 'waiting' && gameState.hostId === user.uid && (
                <button 
                  onClick={startGame}
                  className="bg-green-600 hover:bg-green-500 text-white px-8 py-2 rounded-full font-bold shadow-lg shadow-green-900/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Play size={18} fill="currentColor" /> 开始游戏
                </button>
              )}

              {gameState.status === 'playing' && (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">剩余牌堆</p>
                    <p className="text-xl font-black text-orange-500">{gameState.deck?.length || 0}</p>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-700"></div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">当前回合</p>
                    <p className="text-sm font-bold text-white">
                      {gameState.players?.[gameState.turnIndex]?.name || '未知玩家'} 
                      {gameState.players?.[gameState.turnIndex]?.uid === user.uid ? " (你)" : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {gameState.status === 'waiting' ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                  <Users className="text-slate-700 mb-6 animate-pulse" size={64} />
                  <h2 className="text-2xl font-bold mb-2">等待玩家加入...</h2>
                  <div className="flex gap-4 mt-4">
                    {gameState.players?.map((p) => (
                      <div key={p.uid} className="flex flex-col items-center">
                         <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border-2 border-orange-500/30 mb-2">
                           {p.name?.[0] || '?'}
                         </div>
                         <span className="text-xs text-slate-400">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Opponents Hands */}
                  <div className="flex justify-center gap-8 py-2">
                    {gameState.players?.filter(p => p.uid !== user.uid).map(p => (
                      <div key={p.uid} className={`px-4 py-2 rounded-xl border flex items-center gap-3 ${gameState.players[gameState.turnIndex]?.uid === p.uid ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                        <div className="relative">
                          <Users size={20} className={gameState.players[gameState.turnIndex]?.uid === p.uid ? 'text-orange-500' : 'text-slate-600'} />
                          {gameState.players[gameState.turnIndex]?.uid === p.uid && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">{p.name}</p>
                          <p className="text-sm font-bold">{p.hand?.length || 0} 张牌</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Table Board */}
                  <div className="flex-1 bg-slate-900/40 rounded-3xl border border-slate-800 p-6 overflow-y-auto shadow-inner relative">
                    {!gameState.board || gameState.board.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 flex-col">
                        <div className="text-6xl font-black mb-4">BOARD</div>
                        <p className="text-lg">请将牌组放置在此区域</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-6">
                        {gameState.board.map((set, i) => (
                           <div key={i} className="flex bg-slate-800/50 p-2 rounded-lg gap-1">
                              {set.map(tile => <Tile key={tile.id} tile={tile} size="sm" />)}
                           </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Player Hand & Controls */}
                  <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700 p-6 pb-4">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-slate-800 rounded-md text-xs hover:bg-slate-700">按数字排序</button>
                        <button className="px-3 py-1 bg-slate-800 rounded-md text-xs hover:bg-slate-700">按颜色排序</button>
                      </div>
                      
                      <div className="flex gap-3">
                         <button 
                          disabled={gameState.players[gameState.turnIndex]?.uid !== user.uid}
                          onClick={drawTile}
                          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 px-6 py-2 rounded-full font-bold text-sm transition-all"
                         >
                           摸一张牌
                         </button>
                         <button 
                          disabled={gameState.players[gameState.turnIndex]?.uid !== user.uid}
                          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-30 px-8 py-2 rounded-full font-bold text-sm shadow-lg shadow-orange-500/20"
                         >
                           结束回合
                         </button>
                      </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide min-h-[80px]">
                      {gameState.players?.find(p => p.uid === user.uid)?.hand?.map((tile) => (
                        <Tile key={tile.id} tile={tile} />
                      )) || <p className="text-slate-500 italic text-sm">手牌为空或尚未开局</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}