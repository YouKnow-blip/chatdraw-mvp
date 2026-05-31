import { motion } from "motion/react";
import { Sparkles, Star, PlusCircle, CheckCircle, Flame, ImageIcon } from "lucide-react";
import { RoundResult } from "../types";

interface ResultsDashboardProps {
  theme: string;
  result: RoundResult | null;
  onNewRound: () => void;
  isStreamer?: boolean;
}

export default function ResultsDashboard({ theme, result, onNewRound, isStreamer = true }: ResultsDashboardProps) {
  if (!result) return null;

  const scoreColorClass = (val: number) => {
    if (val >= 8) return "text-amber-500 font-bold";
    if (val >= 5) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreDescription = (val: number) => {
    if (val >= 9) return "Шедевр Ренессанса!";
    if (val >= 7) return "Достойно Лувра!";
    if (val >= 5) return "Хороший эскиз";
    return "Искусство требует практики!";
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto bg-[#141211] border border-[#c5a880]/15 rounded-2xl p-6 md:p-8 shadow-2xl">
      
      {/* Celebration Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 bg-[#b08149]/10 border border-[#c5a880]/20 text-[#ebd6b7] text-xs px-3.5 py-1.5 rounded-full font-bold uppercase tracking-widest font-mono">
          <Star className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          ВЕРДИКТ СТРИМА И ЦЕНЗОРОВ
        </div>
        <p className="text-xs text-[#846842] uppercase font-mono tracking-wider mt-3">НАЗВАНИЕ СЮЖЕТА:</p>
        <h2 className="text-xl md:text-2xl font-display text-white tracking-wide leading-snug mt-1 italic max-w-2xl mx-auto">
          «{theme || "Случайное веяние чата"}»
        </h2>
      </div>

      {/* Grid containing final Canvas preview & Score card breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        
        {/* Render Canvas Image Preview frame */}
        <div className="painting-frame p-[10px] rounded-xl overflow-hidden relative min-h-[300px] flex justify-center items-center bg-[#070504]">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/80 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold text-[#c5a880] z-10 select-none border border-[#c5a880]/20">
            <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
            ФИНАЛЬНОЕ ПОЛОТНО
          </div>
          
          {result.image ? (
            <motion.img 
              initial={{ scale: 0.3, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 140,
                damping: 14,
                delay: 0.15
              }}
              src={result.image} 
              alt="Финальный шедевр" 
              referrerPolicy="no-referrer"
              className="max-h-[320px] max-w-full rounded border border-stone-900 shadow-2xl object-contain bg-white"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-stone-700 p-6">
              <ImageIcon className="w-12 h-12 stroke-1 text-stone-850 mb-2 animate-pulse" />
              <p className="text-xs font-semibold">Холст пуст</p>
            </div>
          )}
        </div>

        {/* Right side Detailed Score Indicators & Critiques panel */}
        <div className="flex flex-col justify-between bg-black/40 border border-stone-900 rounded-2xl p-6 relative">
          
          {/* Main Giant score gauge */}
          <div className="flex items-center gap-4 border-b border-stone-900 pb-5">
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              {/* Spinning gold light circle layer */}
              <div className="absolute inset-0 rounded-full border-4 border-stone-900" />
              <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin-slow" />
              <span className="text-3xl font-display font-bold text-white tracking-tighter">
                {result.score}
              </span>
            </div>
            
            <div className="text-left">
              <p className="text-[9px] uppercase font-mono tracking-widest text-[#846842] leading-none font-bold">ИТОГОВЫЙ БАЛЛ ЦЕНЗОРОВ</p>
              <h3 className="text-base font-display text-white mt-1.5 flex items-center gap-1">
                {getScoreDescription(result.score)}
                <Flame className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-xs text-stone-400 mt-1">Непредвзятая шкала художественного абсурда</p>
            </div>
          </div>

          {/* Individual bar categories */}
          <div className="space-y-4 my-5">
            
            {/* Theme match rating */}
            <div className="text-left">
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-stone-300 font-sans text-xs">Точность композиции (сюжет)</span>
                <span className={`font-mono font-bold ${scoreColorClass(result.theme_match)}`}>{result.theme_match} / 10</span>
              </div>
              <div className="h-1.5 bg-stone-950 rounded-full overflow-hidden border border-[#c5a880]/10">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${result.theme_match * 10}%` }} 
                  transition={{ duration: 0.8 }}
                  className="h-full bg-amber-500 rounded-full" 
                />
              </div>
            </div>

            {/* Creativity rating */}
            <div className="text-left">
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-stone-300 font-sans text-xs">Творческая искра</span>
                <span className={`font-mono font-bold ${scoreColorClass(result.creativity)}`}>{result.creativity} / 10</span>
              </div>
              <div className="h-1.5 bg-stone-950 rounded-full overflow-hidden border border-[#c5a880]/10">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${result.creativity * 10}%` }} 
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="h-full bg-amber-400 rounded-full" 
                />
              </div>
            </div>

            {/* Details rating */}
            <div className="text-left">
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-stone-300 font-sans text-xs">Внимание к деталям холста</span>
                <span className={`font-mono font-bold ${scoreColorClass(result.details)}`}>{result.details} / 10</span>
              </div>
              <div className="h-1.5 bg-stone-950 rounded-full overflow-hidden border border-[#c5a880]/10">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${result.details * 10}%` }} 
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="h-full bg-amber-300 rounded-full" 
                />
              </div>
            </div>

          </div>

          {/* Written AI Roast / Critique Comment */}
          <div className="bg-[#100c0a] border border-[#c5a880]/10 rounded-xl p-4 text-left shadow-inner">
            <span className="text-[9px] uppercase font-mono tracking-widest text-[#846842] font-bold leading-none block">ВЕРДИКТ ГЛАВНОГО КРИТИКА</span>
            <p className="text-xs text-[#ebd6b7] italic leading-relaxed mt-2 select-all font-serif">
              «{result.funny_comment}»
            </p>
          </div>

          {/* Restart Room buttons */}
          {isStreamer && (
            <div className="mt-5 pt-3 border-t border-stone-900 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onNewRound}
                className="w-full bg-[#fbb03b] hover:bg-amber-400 text-stone-950 font-bold py-3 px-5 rounded-full text-xs uppercase tracking-widest transition-all shadow-md shadow-amber-950/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 stroke-[2.5px]" />
                Создать Новое Полотно
              </motion.button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
