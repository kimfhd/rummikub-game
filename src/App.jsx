/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect } from 'react';
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
  arrayUnion
} from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  LogOut, 
  Play, 
  Trophy, 
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

// --- Game Constants ---
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

  // 1. Auth Logic (Rule 3: Auth First)
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
        setError("身份验证失败。");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Public Rooms Listener (Rule 1: Path Structure)
  useEffect(() => {
    if (!user) return;
    const roomsCol = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
    const unsubscribe = onSnapshot(roomsCol, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomList);
    }, (err) => {
      console.error("Rooms error:", err);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Game State Listener
  useEffect(() => {
    if (!user || !currentRoomId) {
      setGameState(null);
      return;
    }
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data());
      } else {
        setCurrentRoomId(null);
        setGameState(null);
      }
    }, (err) => {
      console.error("Sync error:", err);
    });
    return () => unsubscribe();
  }, [user, currentRoomId]);

  // Actions
  const createRoom = async () => {
    if (!user) return;
    const roomId = Math.random().toString(36).substring(7).toUpperCase();
    const newRoom = {
      id: roomId,
      hostId: user.uid,
      hostName: `玩家-${user.uid.slice(0, 4)}`,
      players: [{ uid: user.uid, name: `玩家-${user.uid.slice(0, 4)}`, hand: [] }],
      status: 'waiting',
      board: [],
      deck: [],
      turnIndex: 0,
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), newRoom);
      setCurrentRoomId(roomId);
    } catch (err) {
      setError("创建失败: " + err.message);
    }
  };

  const joinRoom = async (roomId) => {
    if (!user || !roomId) return;
    const rid = roomId.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', rid);
    
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setError("房间不存在");
        return;
      }
      const data = snap.data();
      if (data.players.some(p => p.uid === user.uid)) {
        setCurrentRoomId(rid);
        return;
      }
      if (data.players.length >= 4) {
        setError("房间已满");
        return;
      }

      await updateDoc(roomRef, {
        players: arrayUnion({ uid: user.uid, name: `玩家-${user.uid.slice(0, 4)}`, hand: [] })
      });
      setCurrentRoomId(rid);
    } catch (err) {
      setError("无法加入: " + err.message);
    }
  };

  const startGame = async () => {
    if (!gameState || gameState.hostId !== user.uid) return;
    const fullDeck = generateDeck();
    const updatedPlayers = gameState.players.map(p => ({
      ...p,
      hand: fullDeck.splice(0, 14)
    }));

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoomId);
    await updateDoc(roomRef, {
      status: 'playing',
      deck: fullDeck,
      players: updatedPlayers,
      turnIndex: 0
    });
  };

  const drawTile = async () => {
    if (!gameState || !user) return;
    const players = gameState.players || [];
    const turnIndex = gameState.turnIndex || 0;
    const currentPlayer = players[turnIndex];
    
    if (currentPlayer?.uid !== user.uid) return;
    if (!gameState.deck || gameState.deck.length === 0) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoomId);
    const newDeck = [...gameState.deck];
    const tile = newDeck.pop();
    
    const newPlayers = players.map(p => {
      if (p.uid === user.uid) {
        return { ...p, hand: [...(p.hand || []), tile] };
      }
      return p;
    });

    await updateDoc(roomRef, {
      deck: newDeck,
      players: newPlayers,
      turnIndex: (turnIndex + 1) % players.length
    });
  };

  const leaveRoom = async () => {
    if (!currentRoomId || !user) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoomId);
    try {
      if (gameState?.hostId === user.uid) {
        await deleteDoc(roomRef);
      } else if (gameState) {
        const filteredPlayers = gameState.players.filter(p => p.uid !== user.uid);
        await updateDoc(roomRef, { players: filteredPlayers });
      }
      setCurrentRoomId(null);
    } catch (err) {
      setCurrentRoomId(null);
    }
  };

  // Helper Components
  const Tile = ({ tile, size = "md", onClick }) => {
    if (!tile) return null;
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
        className={`${sizeClasses[size]} bg-amber-50 rounded-md border-2 shadow-sm flex flex-col items-center justify-center font-bold cursor-pointer hover:scale-105 transition-transform select-none ${colorMap[tile.color] || 'text-gray-400'}`}
      >
        {isJoker ? '☺' : tile.number}
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
      <RefreshCw className="animate-spin mb-4" size={32} />
      <p>正在初始化环境...</p>
    </div>
  );

  // Safety variables
  const players = gameState?.players || [];
  const currentPlayer = players[gameState?.turnIndex || 0];
  const myData = players.find(p => p.uid === user?.uid);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl shadow-lg">
            <LayoutGrid className="text-slate-900" size={24} />
          </div>
          <h1 className="text-xl font-black">RUMMIKUB PRO</h1>
        </div>
        {user && (
          <div className="text-xs opacity-50 font-mono">USER: {user.uid.slice(0, 8)}</div>
        )}
      </header>

      <main className="max-w-6xl mx-auto">
        {!currentRoomId || !gameState ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">游戏大厅</h2>
                <button onClick={createRoom} className="bg-orange-500 hover:bg-orange-400 px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all">
                  <Plus size={20} /> 创建房间
                </button>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={inputID}
                  onChange={(e) => setInputID(e.target.value)}
                  placeholder="输入 房间ID 加入..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 uppercase"
                />
                <button onClick={() => joinRoom(inputID)} className="bg-slate-800 px-6 rounded-xl font-bold">加入</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-slate-900/30 rounded-3xl border border-dashed border-slate-800 text-slate-500">
                    暂无活跃房间
                  </div>
                ) : (
                  rooms.map(room => (
                    <div key={room.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-mono text-orange-400">#{room.id}</span>
                        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded uppercase font-bold text-slate-400">
                          {room.status === 'playing' ? '进行中' : '等待中'}
                        </span>
                      </div>
                      <h3 className="font-bold mb-3">{room.hostName || '未知玩家'} 的房间</h3>
                      <button 
                        disabled={room.status === 'playing' || (room.players?.length || 0) >= 4}
                        onClick={() => joinRoom(room.id)}
                        className="w-full bg-slate-800 hover:bg-orange-500 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        加入游戏 <ChevronRight size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-indigo-900/20 rounded-3xl p-6 border border-indigo-500/10 h-fit">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Trophy className="text-amber-400" size={20} /> 计分规则
              </h3>
              <ul className="text-sm text-slate-400 space-y-3">
                <li>• 首出需满 30 分</li>
                <li>• 组合：同数异色 或 同色连续</li>
                <li>• 每次出牌后桌上必须都是合法组合</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100vh-160px)]">
            <div className="flex justify-between items-center mb-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <button onClick={leaveRoom} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm">
                <LogOut size={16} /> 退出
              </button>
              
              {gameState.status === 'waiting' ? (
                gameState.hostId === user?.uid && (
                  <button onClick={startGame} className="bg-green-600 px-6 py-2 rounded-full font-bold">开始</button>
                )
              ) : (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase">牌堆</p>
                    <p className="text-lg font-bold text-orange-500">{gameState.deck?.length || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase">当前回合</p>
                    <p className="text-sm font-bold">{currentPlayer?.name || '...'}</p>
                  </div>
                </div>
              )}
            </div>

            {gameState.status === 'waiting' ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Users className="text-slate-700 mb-4 animate-pulse" size={48} />
                <h2 className="text-xl font-bold mb-4">等待玩家... ({players.length}/4)</h2>
                <div className="flex gap-2">
                  {players.map(p => (
                    <div key={p.uid} className="bg-slate-800 px-4 py-2 rounded-lg text-sm">{p.name}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="flex justify-center gap-4 py-2">
                  {players.filter(p => p.uid !== user?.uid).map(p => (
                    <div key={p.uid} className={`px-4 py-2 rounded-xl border text-sm ${currentPlayer?.uid === p.uid ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50'}`}>
                      {p.name}: {p.hand?.length || 0} 张
                    </div>
                  ))}
                </div>

                <div className="flex-1 bg-slate-900/40 rounded-3xl border border-slate-800 p-6 overflow-y-auto">
                  <div className="flex flex-wrap gap-4">
                    {(gameState.board || []).map((set, i) => (
                      <div key={`set-${i}`} className="flex bg-slate-800/50 p-2 rounded-lg gap-1 border border-slate-700">
                        {set.map(tile => <Tile key={tile.id} tile={tile} size="sm" />)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/80 rounded-3xl border border-slate-700 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold">你的手牌 ({myData?.hand?.length || 0})</span>
                    <div className="flex gap-2">
                      <button 
                        disabled={currentPlayer?.uid !== user?.uid} 
                        onClick={drawTile}
                        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-20 px-4 py-1 rounded-full text-sm font-bold"
                      >
                        摸牌
                      </button>
                      <button 
                        disabled={currentPlayer?.uid !== user?.uid}
                        className="bg-orange-500 disabled:opacity-20 px-4 py-1 rounded-full text-sm font-bold"
                      >
                        结束回合
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 min-h-[60px]">
                    {(myData?.hand || []).map(tile => (
                      <Tile key={tile.id} tile={tile} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}