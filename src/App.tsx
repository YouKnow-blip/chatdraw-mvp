import React, { useState, useEffect } from "react";
import { 
  Palette, Compass, Clock, Play, User, LogOut, Check, Copy, Activity, History, Sparkles, AlertCircle, Tv, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Room, RoomState } from "./types";
import Canvas from "./components/Canvas";
import ResultsDashboard from "./components/ResultsDashboard";
import ChatWidget from "./components/ChatWidget";

// Our beautiful custom-generated Renaissance portrait asset static path
const portraitUrl = "/src/assets/images/renaissance_portrait_1780241269523.png";

export default function App() {
  // App navigation state
  const [room, setRoom] = useState<Room | null>(null);
  const [streamerName, setStreamerName] = useState("");
  const [customChannel, setCustomChannel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Local rule presets
  const [collectTime, setCollectTime] = useState(30); // 30s standard
  const [drawTime, setDrawTime] = useState(300);     // 5 mins default

  // Submitting statuses
  const [isSubmittingDrawing, setIsSubmittingDrawing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Twitch credentials environment state
  const [isTwitchConfigured, setIsTwitchConfigured] = useState(false);
  const [twitchUser, setTwitchUser] = useState<{ username: string; avatarUrl: string } | null>(null);
  const [isStreamer, setIsStreamer] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ checked: boolean; working: boolean; error: string }>({ checked: false, working: false, error: "" });

  // Parse room code and check url parameters on component startup
  useEffect(() => {
    // 1. Fetch Twitch Configuration details from server
    fetch("/api/twitch/config")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.isTwitchConfigured) {
          setIsTwitchConfigured(true);
        }
      })
      .catch((e) => console.error("Error loading server twitch config:", e));

    // Fetch Groq status
    fetch("/api/groq/status")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setGroqStatus(json.data);
        }
      })
      .catch((e) => console.error("Error loading server groq status:", e));

    // 2. Scan for Twitch redirection callbacks
    const params = new URLSearchParams(window.location.search);
    const loginStatus = params.get("twitch_login");

    if (loginStatus === "success") {
      const username = params.get("username") || "";
      const avatar = params.get("avatar") || "";
      if (username) {
        const userObj = { username, avatarUrl: avatar };
        setTwitchUser(userObj);
        localStorage.setItem("twitch_username", username);
        localStorage.setItem("twitch_avatar", avatar);
        setStreamerName(username);
        setCustomChannel(username);
      }
      // Clean query variables from url while retaining anchor hash
      const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    } else {
      // Check local cache
      const savedUser = localStorage.getItem("twitch_username");
      const savedAvatar = localStorage.getItem("twitch_avatar");
      if (savedUser) {
        setTwitchUser({ username: savedUser, avatarUrl: savedAvatar || "" });
        setStreamerName(savedUser);
        setCustomChannel(savedUser);
      }
    }

    // 3. Setup Spectator Sync state if Room code exists inside url hash
    const hash = window.location.hash.replace("#", "").toUpperCase();
    if (hash && hash.length === 6) {
      fetchRoomState(hash).then((roomData) => {
        if (roomData) {
          const streamRole = sessionStorage.getItem(`isStreamer_${hash}`);
          if (streamRole === "true") {
            setIsStreamer(true);
          } else {
            setIsStreamer(false);
          }
        }
      });
    }
  }, []);

  // Sync state loop: polling details every 1.5 seconds when inside room
  useEffect(() => {
    if (!room) return;

    const interval = setInterval(() => {
      fetchRoomState(room.code);
    }, 1500);

    return () => clearInterval(interval);
  }, [room?.code]);

  const fetchRoomState = async (code: string) => {
    try {
      const resp = await fetch(`/api/rooms/${code}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.data) {
          // Sync live timers and state with server details
          setRoom(json.data);
          // Set hash quietly to support sharing
          if (window.location.hash !== `#${code}`) {
            window.location.hash = code;
          }
          return json.data;
        }
      } else {
        if (resp.status === 404) {
          window.location.hash = "";
          setRoom(null);
        }
      }
    } catch (err) {
      console.error("Error fetching room sync:", err);
    }
    return null;
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamerName.trim()) {
      setErrorBanner("Пожалуйста, введите имя стримера или имя Twitch канала.");
      return;
    }

    const cleanTwitchChannel = (customChannel || streamerName).toLowerCase().replace(/[^a-z0-9_]/g, "").trim();
    if (!cleanTwitchChannel) {
      setErrorBanner("Пожалуйста, укажите корректное английское имя вашего Twitch-канала (например: sanyok_doodler) в поле 'Имя вашего Twitch-канала'.");
      return;
    }

    setIsCreating(true);
    setErrorBanner(null);
    try {
      const resp = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: streamerName.trim(),
          twitchChannel: cleanTwitchChannel,
          avatarUrl: twitchUser?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${streamerName.trim()}`
        })
      });

      const json = await resp.json();
      if (json.success && json.data) {
        setRoom(json.data);
        setIsStreamer(true);
        sessionStorage.setItem(`isStreamer_${json.data.code}`, "true");
        window.location.hash = json.data.code;
      } else {
        setErrorBanner(json.error || "Ошибка при создании комнаты");
      }
    } catch (err) {
      setErrorBanner("Не удалось соединиться с сервером.");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartCollecting = async () => {
    if (!room) return;
    setErrorBanner(null);
    try {
      const resp = await fetch(`/api/rooms/${room.code}/start-collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectDuration: collectTime,
          drawingDuration: drawTime
        })
      });
      const json = await resp.json();
      if (json.success && json.data) {
        setRoom(json.data);
      }
    } catch {
      setErrorBanner("Не удалось запустить сбор.");
    }
  };

  const handleStopCollecting = async () => {
    if (!room) return;
    setErrorBanner(null);
    try {
      const resp = await fetch(`/api/rooms/${room.code}/stop-collect`, {
        method: "POST"
      });
      const json = await resp.json();
      if (json.success && json.data) {
        setRoom(json.data);
      } else {
        setErrorBanner(json.error || "Не удалось завершить сбор идей.");
      }
    } catch {
      setErrorBanner("Ошибка отправки запроса генерации.");
    }
  };

  const handleSimulateChatMessage = async () => {
    if (!room) return;
    try {
      await fetch(`/api/rooms/${room.code}/chat/simulate`, {
        method: "POST"
      });
    } catch (err) {
      console.error("Sim error", err);
    }
  };

  const handleSendCustomMessage = async (text: string) => {
    if (!room) return;
    try {
      await fetch(`/api/rooms/${room.code}/chat/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, username: streamerName || "Художник" })
      });
    } catch (err) {
      console.error("Custom msg error", err);
    }
  };

  const handleConnectTwitch = async (channelName: string): Promise<boolean> => {
    if (!room) return false;
    try {
      const resp = await fetch(`/api/rooms/${room.code}/twitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelName })
      });
      const json = await resp.json();
      if (json.success && json.data) {
        setRoom(json.data);
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const handleDrawingUpdate = async (base64Png: string) => {
    if (!room || !isStreamer) return;
    try {
      await fetch(`/api/rooms/${room.code}/drawing-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Png })
      });
    } catch (err) {
      console.error("Failed to sync drawing view:", err);
    }
  };

  const handleSaveAndReview = async (base64Png: string) => {
    if (!room) return;
    setIsSubmittingDrawing(true);
    setErrorBanner(null);
    try {
      const resp = await fetch(`/api/rooms/${room.code}/submit-drawing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Png })
      });
      const json = await resp.json();
      if (json.success && json.data) {
        setRoom(json.data);
      } else {
        setErrorBanner(json.error || "Не удалось отправить рисунок.");
      }
    } catch {
      setErrorBanner("Превышено время запроса или сетевая ошибка.");
    } finally {
      setIsSubmittingDrawing(false);
    }
  };

  const handleResetToLobby = async () => {
    if (!room) return;
    try {
      const resp = await fetch(`/api/rooms/${room.code}/reset`, {
        method: "POST"
      });
      const json = await resp.json();
      if (json.success && json.data) {
        setRoom(json.data);
      }
    } catch {
      setErrorBanner("Ошибка сброса состояния.");
    }
  };

  const handleLeaveRoom = () => {
    setRoom(null);
    window.location.hash = "";
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/#${room?.code}`;
    navigator.clipboard.writeText(inviteUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleTwitchOAuthStart = () => {
    window.location.href = "/api/twitch/login";
  };

  const handleLogoutTwitch = () => {
    setTwitchUser(null);
    localStorage.removeItem("twitch_username");
    localStorage.removeItem("twitch_avatar");
    setStreamerName("");
    setCustomChannel("");
  };

  return (
    <div className="min-h-screen bg-renaissance-black text-slate-100 flex flex-col font-sans antialiased selection:bg-amber-550/25 selection:text-white">
      
      {/* Top Header navbar banner */}
      <header className="border-b border-renaissance-gold/15 bg-renaissance-black/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleLeaveRoom}>
            <div className="bg-[#b08149] p-2 rounded-xl text-black shadow-lg shadow-[#b08149]/10 flex items-center justify-center">
              <Palette className="w-5 h-5 text-[#fdebbf] animate-pulse" />
            </div>
            <div className="text-left">
              <h1 className="text-sm font-display tracking-widest text-[#fdebbf] uppercase">
                YOUKNOWSKI <span className="text-[#c5a880] lowercase font-serif italic">Renaissance</span>
              </h1>
              <p className="text-[9px] font-mono text-[#846842] font-bold tracking-widest leading-none">ГАЛЕРЕЯ ЭФИРА • ИИ ШОУ</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {room ? (
              <>
                <div onClick={handleCopyLink} className="hidden sm:flex items-center gap-2 bg-renaissance-dark border border-renaissance-gold/20 rounded-lg px-3 py-1.5 cursor-pointer hover:border-renaissance-gold/40 transition-all select-none">
                  <span className="text-xs font-mono text-[#c5a880]">ПРИГЛАСИТЬ ЗРИТЕЛЕЙ: КОД {room.code}</span>
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#846842]" />}
                </div>

                <div className="flex items-center gap-2 bg-renaissance-dark border border-renaissance-gold/20 rounded-lg px-3 py-1.5">
                  {room.avatarUrl ? (
                    <img src={room.avatarUrl} alt={room.ownerId} className="w-4 h-4 rounded-full border border-renaissance-gold/30" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-renaissance-gold" />
                  )}
                  <span className="text-xs font-semibold text-slate-200">
                    {room.ownerId} {isStreamer ? "(Художник)" : "(Цензор чата)"}
                  </span>
                </div>

                <button
                  onClick={handleLeaveRoom}
                  className="p-2 border border-renaissance-gold/10 text-slate-400 hover:text-red-400 hover:border-red-900/50 rounded-lg transition-all bg-renaissance-dark"
                  title="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                {groqStatus.checked && (
                  <div className={`flex items-center gap-2 border px-3 py-1 text-xs font-mono font-bold rounded-full select-none ${
                    groqStatus.working
                      ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                      : "bg-red-950/20 border-red-500/20 text-red-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${groqStatus.working ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                    GROQ API: {groqStatus.working ? "АКТИВЕН" : "ОШИБКА РЕГИСТРАЦИИ"}
                  </div>
                )}
                <div className="flex items-center gap-2 bg-[#b08149]/10 border border-[#c5a880]/20 px-3 py-1 text-xs font-mono font-bold text-[#c5a880] rounded-full select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  ОНЛАЙН СВЯЗЬ АКТИВНА
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container workspace */}
      <main className="flex-1 flex flex-col justify-start">
        <AnimatePresence mode="wait">
          
          {/* STATE A: LANDING PAGE LOBBY - Create a Room */}
          {!room ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-5xl mx-auto w-full px-4 py-8 md:py-16 flex flex-col items-center justify-center text-slate-100"
            >
              {/* Classical Layout with Two Columns: Portrait Reference on Left, Control Form on Right */}
              <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center justify-center mt-2">
                
                {/* Reference Column Left */}
                <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
                  {/* Subtle Top Text markers exactly like concept */}
                  <div className="w-full flex justify-between items-center text-[11px] uppercase tracking-widest font-mono text-[#846842] mb-3 select-none">
                    <span>концепция</span>
                    <span>№1</span>
                  </div>

                  {/* Elegant Golden Picture Frame (Painting structure) */}
                  <div className="painting-frame p-[12px] rounded-2xl w-full max-w-sm overflow-hidden transform transition-all hover:scale-[1.01]">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-md border border-[#c5a880]/30">
                      <img 
                        src={portraitUrl} 
                        alt="Renaissance Art" 
                        className="w-full h-full object-cover filter brightness-[0.88] contrast-[1.05]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6 text-left">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-[#c5a880] font-bold">СОВМЕСТНОЕ ТВОРЧЕСТВО</span>
                        <h4 className="text-xl font-display text-white tracking-wide mt-1">Ренессанс</h4>
                        <p className="text-[11px] text-slate-350 leading-relaxed mt-1 italic font-serif">
                          Превращайте поток мыслей ваших зрителей в классические полотна с помощью искусственного интеллекта.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration Input Column Right */}
                <div className="lg:col-span-6 flex flex-col text-left space-y-6">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#c5a880] font-extrabold bg-[#c5a880]/10 px-3 py-1 rounded-full border border-[#c5a880]/25">
                      ИИ Стрим-Шоу Стримеров
                    </span>
                    <h2 className="text-4xl md:text-5xl font-display text-white tracking-wide mt-3 leading-tight font-light">
                      <span className="font-serif italic text-renaissance-gold-light pr-1">Y</span>OUKNOWSKI <br />
                      <span className="text-renaissance-accent">Живой Кисти</span>
                    </h2>
                    <p className="text-sm text-slate-350 mt-3 leading-relaxed max-w-md font-sans">
                      Ваш чат Twitch предлагает безумные слова и идеи, а искусственный интеллект формулирует из них художественную задачу для вас на холсте.
                    </p>
                  </div>

                  {errorBanner && (
                    <div className="bg-red-950/40 border border-red-900/40 p-3.5 rounded-xl text-xs font-semibold text-red-400 mb-2">
                      {errorBanner}
                    </div>
                  )}

                  <div className="bg-renaissance-dark border border-renaissance-gold/15 rounded-2xl p-6 shadow-2xl space-y-5">
                    
                    {/* Simplified Direct Launch Option first class */}
                    <form onSubmit={handleCreateRoom} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-mono tracking-wider font-extrabold text-[#c5a880] uppercase mb-1.5">
                          1. Ваше имя или Никнейм художника:
                        </label>
                        <input
                          type="text"
                          placeholder="Например: Мастер Леонардо"
                          value={streamerName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStreamerName(val);
                            const latinOnly = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
                            setCustomChannel(latinOnly);
                          }}
                          required
                          className="w-full bg-[#100c0a] border border-[#c5a880]/20 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono tracking-wider font-extrabold text-[#c5a880] uppercase mb-1.5">
                          2. Имя вашего Twitch-канала:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Например: sanek_doodler"
                            value={customChannel}
                            onChange={(e) => {
                              const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                              setCustomChannel(cleaned);
                            }}
                            className="w-full bg-[#100c0a] border border-[#c5a880]/20 rounded-xl px-4 py-2.5 pl-8 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-700 font-mono"
                          />
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#846842] text-sm select-none font-semibold">#</span>
                        </div>
                        <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                          Сервер подключит IRC WebSocket напрямую к чату указанного Twitch канала live, без дополнительных верификаций!
                        </p>
                      </div>

                      {twitchUser ? (
                        <div className="bg-[#100c0a] border border-[#c5a880]/30 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <p className="text-xs text-slate-350">
                              Авторизовано: <strong className="text-[#ebd6b7]">@{twitchUser.username}</strong>
                            </p>
                          </div>
                          <button 
                            type="button" 
                            onClick={handleLogoutTwitch} 
                            className="text-[10px] text-red-400 hover:underline"
                          >
                            Сбросить
                          </button>
                        </div>
                      ) : (
                        isTwitchConfigured && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={handleTwitchOAuthStart}
                              className="w-full bg-purple-950/15 border border-purple-500/20 text-purple-350 hover:text-white hover:bg-purple-900/20 py-2.5 rounded-xl transition-all font-mono text-xs flex items-center justify-center gap-2"
                            >
                              <Tv className="w-4 h-4" />
                              Альтернативный вход по Twitch OAuth
                            </button>
                          </div>
                        )
                      )}

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isCreating}
                        className="w-full bg-renaissance-gold-vivid hover:bg-amber-400 text-stone-950 font-bold py-3.5 rounded-full transition-all shadow-xl shadow-amber-950/20 flex items-center justify-center gap-2 text-sm mt-4 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-stone-950 stroke-stone-950 shrink-0" />
                        {isCreating ? "Инициализация Галереи..." : "Перейти на Эфир & Начать Сбор"}
                      </motion.button>
                    </form>

                  </div>
                </div>

              </div>
            </motion.div>
          ) : (
              
              /* STATE B: ACTIVE ROOM DASHBOARD LAYOUT */
              <motion.div
                key="active-dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch"
              >
                
                {/* LEFT & CENTER MAIN STAGE - Workspace depending on Round State */}
                <div className="lg:col-span-3 flex flex-col gap-6 h-full min-h-[500px]">
                  
                  {/* 1. STATE: LOBBY */}
                  {room.activeRound.state === RoomState.LOBBY && (
                    <div className="gallery-card rounded-2xl p-6 md:p-8 flex-1 flex flex-col justify-between shadow-xl">
                      
                      <div className="my-auto space-y-6">
                        <div className="text-center max-w-xl mx-auto">
                          <div className="inline-flex p-4 bg-[#b08149]/10 border border-[#c5a880]/20 text-[#c5a880] rounded-full mb-4">
                            <Compass className="w-8 h-8 text-[#c5a880]" />
                          </div>
                          <h2 className="text-2xl font-display text-white tracking-wide">
                            {isStreamer ? "Настройка Художественного Сеанса" : "Ожидание Старта Стримером..."}
                          </h2>
                          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            {isStreamer 
                              ? "Выберите тайминг для сбора безумных слов от зрителей и хронометраж на создание полноценного ИИ-шедевра. Раскройте свой талант без остатка!"
                              : "Художник калибрует кисть и подстраивает длительность таймера раундов. Скоро начнется настоящий ИИ-перформанс!"}
                          </p>
                        </div>

                        {/* Controls grid parameters */}
                        {isStreamer && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-lg mx-auto bg-black/40 p-5 rounded-2xl border border-[#c5a880]/15">
                            
                            {/* 1. Idea duration select */}
                            <div className="text-left">
                              <label className="block text-[10px] font-mono tracking-wider font-extrabold text-[#c5a880] uppercase mb-2">Активный Сбор Идей от чата:</label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[15, 30, 60].map((t) => (
                                  <button
                                    key={t}
                                    onClick={() => setCollectTime(t)}
                                    className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                                      collectTime === t
                                        ? "bg-[#b08149] border-[#c5a880] text-black"
                                        : "border-stone-800 bg-stone-950 text-stone-400 hover:text-white"
                                    }`}
                                  >
                                    {t} сек
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 2. Drawing duration select */}
                            <div className="text-left">
                              <label className="block text-[10px] font-mono tracking-wider font-extrabold text-[#c5a880] uppercase mb-2">Таймер Наброска Холста:</label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[60, 300, 600].map((t) => (
                                  <button
                                    key={t}
                                    onClick={() => setDrawTime(t)}
                                    className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                                      drawTime === t
                                        ? "bg-[#b08149] border-[#c5a880] text-black"
                                        : "border-stone-800 bg-stone-950 text-stone-400 hover:text-white"
                                    }`}
                                  >
                                    {t === 60 ? "1 мин" : t === 300 ? "5 мин" : "10 мин"}
                                  </button>
                                ))}
                              </div>
                            </div>

                          </div>
                        )}
                      </div>

                      {/* Launch trigger action bottom bar */}
                      {isStreamer && (
                        <div className="border-t border-[#c5a880]/10 pt-5 mt-4 max-w-md mx-auto w-full">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleStartCollecting}
                            className="w-full bg-renaissance-gold-vivid hover:bg-amber-400 text-stone-950 font-bold py-4 rounded-full transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                          >
                            <Play className="w-4.5 h-4.5 fill-stone-950 stroke-stone-950 shrink-0" />
                            ЗАПУСТИТЬ ОНЛАЙН СБОР ИДЕЙ
                          </motion.button>
                        </div>
                      )}

                    </div>
                  )}

                  {/* 2. STATE: COLLECTING */}
                  {room.activeRound.state === RoomState.COLLECTING && (
                    <div className="gallery-card rounded-2xl p-6 md:p-8 flex-1 flex flex-col justify-between text-center relative overflow-hidden shadow-xl">
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-renaissance-gold-vivid animate-pulse" />
                      
                      <div className="my-auto space-y-6">
                        <div className="mx-auto w-24 h-24 bg-[#b08149]/10 border border-[#c5a880]/30 rounded-full flex items-center justify-center relative shadow-lg">
                          <Clock className="w-10 h-10 text-renaissance-gold animate-pulse" />
                          <div className="absolute inset-0 border-2 border-[#c5a880]/40 rounded-full animate-ping" />
                        </div>

                        <div>
                          <h2 className="text-2xl font-display text-white tracking-wide">Собираем сумасшедшие идеи...</h2>
                          <p className="text-xs text-stone-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                            Чат трансляции может писать абсолютно любые слова и сюжеты. Чем больше странных идей, тем красочнее будет тема рисунка!
                          </p>
                        </div>

                        {/* Large prominent timer counter */}
                        <div className="bg-[#100c0a] max-w-xs mx-auto p-4 rounded-xl border border-[#c5a880]/15 shadow-inner">
                          <p className="text-[10px] font-mono tracking-widest text-[#846842] uppercase leading-none">ДО ГЕНЕРАЦИИ ТЕМЫ</p>
                          <p className="text-4xl font-mono font-bold text-renaissance-gold-vivid tracking-tight mt-1.5">{room.activeRound.timeLeft} сек</p>
                        </div>

                        {/* Suggestions preview */}
                        <div className="max-w-md mx-auto text-left bg-black/40 rounded-xl p-3.5 border border-[#c5a880]/10">
                          <span className="text-[10px] text-renaissance-gold uppercase font-mono font-bold tracking-wider">Последние зацепки на входе:</span>
                          <div className="space-y-1.5 mt-2 text-xs text-slate-300">
                            {room.activeRound.chatMessages.length === 0 ? (
                              <p className="text-stone-600 italic mt-1">Ждём активности в чате Twitch...</p>
                            ) : (
                              room.activeRound.chatMessages.slice(-3).map((m) => (
                                <div key={m.id} className="whitespace-nowrap overflow-hidden text-ellipsis border-b border-stone-900/40 pb-1">
                                  <span className="text-renaissance-gold font-bold">@{m.username}: </span>
                                  <span>{m.message}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Complete button manually bypass */}
                      {isStreamer && (
                        <div className="border-t border-[#c5a880]/10 pt-5 mt-4 max-w-sm mx-auto w-full">
                          <button
                            onClick={handleStopCollecting}
                            className="w-full bg-[#171412] hover:bg-[#201a16] text-[#c5a880] border border-[#c5a880]/30 font-bold py-3.5 rounded-full transition-all cursor-pointer text-xs uppercase tracking-wider"
                          >
                            Завершить досрочно & Создать Тему ИИ
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                  {/* 3. STATE: JUDGING */}
                  {room.activeRound.state === RoomState.JUDGING && (
                    <div className="gallery-card rounded-2xl p-6 md:p-12 flex-1 flex flex-col items-center justify-center text-center shadow-xl">
                      <div className="relative w-24 h-24 bg-[#b08149]/15 rounded-full flex items-center justify-center p-4 border border-[#c5a880]/20 mb-5 shadow-lg">
                        <Sparkles className="w-12 h-12 text-[#c5a880] animate-spin" />
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#c5a880]/40 animate-spin-slow" />
                      </div>
                      <h2 className="text-2xl font-display text-white tracking-wide">ИИ формулирует Творческий Заказ...</h2>
                      <p className="text-xs text-stone-400 max-w-sm mt-2 leading-relaxed">
                        Мы забираем входящие сообщения вашего Twitch-чата, фильтруем их и пакуем в уморительную словесную концепцию для вашего холста.
                      </p>
                    </div>
                  )}

                  {/* 4. STATE: DRAWING */}
                  {room.activeRound.state === RoomState.DRAWING && (
                    <div className="flex flex-col gap-4 flex-1">
                      
                      {/* Tiny stats overlay bar */}
                      <div className="gallery-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
                        <div className="text-left max-w-[70%]">
                          <p className="text-[10px] font-mono tracking-widest text-[#c5a880] uppercase font-bold">ЗАДАЧА СИДЯЩЕМУ ХУДОЖНИКУ</p>
                          <h2 className="text-base md:text-lg font-display text-white tracking-wide leading-snug mt-1 italic">
                            «{room.activeRound.theme}»
                          </h2>
                        </div>

                        {/* Remaining drawing clock */}
                        <div className="bg-[#100c0a] px-4 py-2 rounded-lg border border-[#c5a880]/15 flex items-center gap-2 select-none min-w-[110px] justify-center">
                          <Clock className={`w-4 h-4 text-renaissance-gold-vivid ${room.activeRound.timeLeft <= 15 ? "animate-ping text-red-400" : ""}`} />
                          <span className={`font-mono font-extrabold text-sm ${room.activeRound.timeLeft <= 15 ? "text-red-400 font-bold" : "text-white"}`}>
                            {formatTime(room.activeRound.timeLeft)}
                          </span>
                        </div>
                      </div>

                      {/* Core drawing Canvas frame vs broadcast spectator panel */}
                      <div className="flex-1">
                        {isStreamer ? (
                          <Canvas 
                            onSave={handleSaveAndReview} 
                            isSubmitting={isSubmittingDrawing} 
                            themeText={room.activeRound.theme}
                            onDrawingUpdate={handleDrawingUpdate}
                          />
                        ) : (
                          <div className="flex flex-col gap-4 w-full h-full bg-stone-900/20 border border-stone-800 rounded-2xl p-6 shadow-xl text-center items-center justify-center relative overflow-hidden min-h-[460px]">
                            
                            {/* Live Framed TV Display */}
                            <div className="absolute top-4 left-4 flex items-center gap-2 bg-renaissance-gold/15 border border-[#c5a880]/30 px-3 py-1.5 text-[10px] font-mono font-extrabold text-[#c5a880] rounded-full select-none animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              СЕРВЕРНАЯ ТРАНСЛЯЦИЯ ХОЛСТА СТРИМЕРА
                            </div>
                            
                            <div className="my-auto max-w-xl w-full space-y-5">
                              {room.activeRound.currentDrawing ? (
                                <div className="painting-frame p-[10px] rounded-xl overflow-hidden shadow-inner aspect-video flex items-center justify-center bg-white">
                                  <img
                                    src={room.activeRound.currentDrawing}
                                    alt="Live Sketch"
                                    className="max-h-full max-w-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ) : (
                                <div className="border border-dashed border-stone-800 rounded-2xl aspect-video flex flex-col items-center justify-center p-8 bg-black/40">
                                  <Palette className="w-12 h-12 text-stone-700 animate-spin mb-3" />
                                  <p className="text-xs text-stone-400">Стример собирается с мыслями перед первым штрихом...</p>
                                </div>
                              )}

                              <p className="text-xs text-stone-400 leading-relaxed font-mono">
                                Спектаторский Эфир • Пишите свои шедевры и слова прямо в чате стримера на Twitch!
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* 5. STATE: RESULTS */}
                  {room.activeRound.state === RoomState.RESULTS && (
                    <div className="flex-grow flex flex-col justify-center">
                      <ResultsDashboard 
                        theme={room.activeRound.theme}
                        result={room.activeRound.result}
                        onNewRound={handleResetToLobby}
                        isStreamer={isStreamer}
                      />
                    </div>
                  )}

                </div>

                {/* RIGHT SIDE LIVESTREAM CHAT SIDEBAR PANEL */}
                <div className="lg:col-span-1 h-full min-h-[400px]">
                  <ChatWidget 
                    messages={room.activeRound.chatMessages}
                    onSimulateMsg={handleSimulateChatMessage}
                    onSendMessage={handleSendCustomMessage}
                    onConnectTwitch={handleConnectTwitch}
                    twitchChannel={room.twitchChannel}
                    isTwitchConnected={room.isTwitchConnected}
                    isCollecting={room.activeRound.state === RoomState.COLLECTING}
                  />
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        
        {/* FOOTER & ROUND MASTERPIECE HISTORY PANEL VIEW */}
        {room && room.pastRounds && room.pastRounds.length > 0 && (
          <footer className="border-t border-[#c5a880]/10 bg-black/30 py-10 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 mb-6">
                <History className="w-5 h-5 text-renaissance-gold" />
                <h3 className="font-display text-sm text-[#fdebbf] uppercase tracking-wider">Экспозиция Прошлых Полотен в Зале ({room.pastRounds.length})</h3>
              </div>

              {/* horizontal gallery previews */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {room.pastRounds.map((old, k) => (
                  <div key={old.id || k} className="gallery-card rounded-xl p-3.5 flex flex-col justify-between hover:border-[#c5a880]/50 transition-all text-left group">
                    <div className="relative aspect-video w-full rounded-md overflow-hidden bg-white mb-3 flex items-center justify-center border border-stone-900 group-hover:scale-[1.02] transition-transform">
                      <img 
                        src={old.result?.image} 
                        alt={old.theme} 
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain filter brightness-[0.98]"
                      />
                      
                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-renaissance-gold border border-renaissance-gold/30">
                        ★ {old.result?.score}/10
                      </div>
                    </div>

                    <p className="text-[9px] font-bold text-renaissance-gold uppercase font-mono tracking-widest leading-none">ТЕМА РАУНДА:</p>
                    <p className="text-xs text-slate-200 mt-1.5 font-semibold leading-relaxed truncate max-w-full" title={old.theme}>
                      {old.theme}
                    </p>
                    
                    {old.result?.funny_comment && (
                      <div className="bg-[#100c0a] rounded p-2 mt-2 text-[10px] text-stone-400 italic font-medium max-w-full line-clamp-2">
                        «{old.result.funny_comment}»
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </footer>
        )}

      </main>
    </div>
  );
}
