import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Sparkles, Tv, Link, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage } from "../types";

interface ChatWidgetProps {
  messages: ChatMessage[];
  onSimulateMsg: () => void;
  onSendMessage?: (text: string) => void;
  onConnectTwitch: (channel: string) => Promise<boolean>;
  twitchChannel: string;
  isTwitchConnected: boolean;
  isCollecting: boolean;
}

export default function ChatWidget({
  messages,
  onSimulateMsg,
  onSendMessage,
  onConnectTwitch,
  twitchChannel,
  isTwitchConnected,
  isCollecting
}: ChatWidgetProps) {
  const [channelInput, setChannelInput] = useState("");
  const [typedMsg, setTypedMsg] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to lowest point when messages arrive
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  const handleTwitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelInput.trim()) return;

    setIsConnecting(true);
    setStatusMsg(null);
    try {
      const ok = await onConnectTwitch(channelInput);
      if (ok) {
        setStatusMsg({ type: "success", text: `Канал #${channelInput} привязан!` });
        setChannelInput("");
      } else {
        setStatusMsg({ type: "error", text: "Ошибка подключения." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Сбой подключения." });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#141211] border border-[#c5a880]/15 rounded-2xl overflow-hidden shadow-xl min-h-[480px]">
      {/* Twitch header status */}
      <div className="p-4 bg-[#1b1816] border-b border-[#c5a880]/10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#c5a880]" />
            <span className="font-display font-bold text-xs text-stone-200 tracking-wider">ЧАТ СТРИМА</span>
          </div>
          
          <div className="flex items-center gap-1 bg-black px-2 py-0.5 rounded-full border border-stone-800 select-none">
            <span className={`w-1.5 h-1.5 rounded-full ${isTwitchConnected ? "bg-amber-500 animate-pulse" : "bg-stone-700"}`} />
            <span className="text-[9px] font-mono text-[#ebd6b7] uppercase tracking-wider font-extrabold">
              {isTwitchConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Connect Twitch Channel panel */}
        {!isTwitchConnected ? (
          <form onSubmit={handleTwitchSubmit} className="flex gap-1.5 mt-1">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Имя канала (sanyok)"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                disabled={isConnecting}
                className="w-full bg-black text-slate-100 border border-[#c5a880]/20 rounded-lg px-2.5 py-1.5 pl-6 text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-700 disabled:opacity-50"
              />
              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-stone-500 text-xs font-mono font-bold select-none">#</span>
            </div>
            <button
              type="submit"
              disabled={isConnecting}
              className="bg-[#b08149] hover:bg-amber-500 text-[#141211] font-bold text-xs rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <Link className="w-3 h-3" />
              Связать
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between bg-amber-950/20 border border-[#c5a880]/20 rounded-lg p-2 mt-1">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <div className="text-left">
                <p className="text-[9px] text-amber-500 uppercase font-mono font-bold tracking-wider leading-none">Канал Подключен</p>
                <p className="text-xs text-[#ebd6b7] font-semibold">{twitchChannel}</p>
              </div>
            </div>
            <button
              onClick={() => onConnectTwitch("")}
              className="text-[9px] uppercase font-mono text-stone-500 hover:text-red-400 transition-colors underline"
            >
              Выйти
            </button>
          </div>
        )}

        <AnimatePresence>
          {statusMsg && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`flex items-center gap-1.5 text-[10px] font-medium p-1 px-2 rounded mt-1 overflow-hidden ${
                statusMsg.type === "success" ? "bg-emerald-950/20 text-emerald-450" : "bg-red-950/20 text-red-450"
              }`}
            >
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{statusMsg.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Message Feed Canvas Wrapper */}
      <div 
        ref={viewportRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/40 flex flex-col min-h-[250px] scrollbar-thin max-h-[500px]"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-650 select-none">
            <MessageSquare className="w-10 h-10 text-stone-850 mb-2 stroke-1" />
            <p className="text-xs font-semibold">Идеи отсутствуют</p>
            <p className="text-[10px] text-stone-550 mt-1 max-w-[170px]">
              {isCollecting 
                ? "Зрители вашего Twitch стрима могут писать любые идеи, они мгновенно появятся здесь!"
                : "После запуска раунда чат начнет наполнять зал идеями!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 mt-auto">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-2 rounded-xl text-left border ${
                  m.isSimulated 
                    ? "bg-amber-950/10 border-[#c5a880]/10" 
                    : "bg-stone-900/10 border-stone-800/50"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span className={`text-xs font-bold leading-none select-all ${
                    m.isSimulated ? "text-amber-500" : "text-stone-300"
                  }`}>
                    @{m.username}
                  </span>
                  <span className="text-[8px] font-mono text-stone-600">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-slate-205 text-stone-200 select-all leading-normal break-words">{m.message}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Typed Message Suggestion For Simulating Users */}
      <div className="p-3 bg-[#181513] border-t border-[#c5a880]/10 shrink-0">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!typedMsg.trim()) return;
          if (onSendMessage) {
            onSendMessage(typedMsg.trim());
          }
          setTypedMsg("");
        }} className="flex gap-1.5 justify-between items-center">
          <input
            type="text"
            value={typedMsg}
            onChange={(e) => setTypedMsg(e.target.value)}
            placeholder={isCollecting ? "Введите слова для сюжета..." : "Раунд не запущен"}
            disabled={!isCollecting}
            className="flex-1 min-w-0 bg-black text-xs text-stone-200 border border-[#c5a880]/20 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-50 placeholder:text-stone-700"
          />
          <button
            type="submit"
            disabled={!isCollecting || !typedMsg.trim()}
            className="bg-[#c5a880] hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-[#c5a880] text-black font-bold h-8 w-8 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0"
            title="Отправить идею"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <p className="text-[9px] text-stone-500 mt-1.5 text-left select-none leading-normal">
          ИИ ОБЯЗАТЕЛЬНО использует слова, которые вы напишете здесь или придут из Twitch, при создании сюжета!
        </p>
      </div>

      {/* Simulator helper footer */}
      <div className="p-3 bg-stone-950/80 border-t border-[#c5a880]/10 flex items-center justify-between gap-2">
        <div className="text-left max-w-[55%]">
          <p className="text-[10px] uppercase font-mono text-stone-450 font-bold leading-tight flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#c5a880]" />
            Тест ЧАТА
          </p>
          <p className="text-[10px] text-stone-600 mt-0.5 leading-snug">
            Вбросить ИИ замену из зала
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onSimulateMsg}
          className="bg-[#c5a880]/10 border border-[#c5a880]/20 text-stone-300 hover:text-white hover:bg-[#c5a880]/20 text-[10px] font-semibold rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition-all"
        >
          <Send className="w-3 h-3" />
          Вброс
        </motion.button>
      </div>
    </div>
  );
}
