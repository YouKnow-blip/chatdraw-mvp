import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Room, RoomState, ChatMessage, Round } from "./src/types";
import WebSocket from "ws";

const app = express();
const PORT = 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";
let groqStatus = { checked: false, working: false, error: "" };

async function testGroqKey() {
  if (!GROQ_API_KEY) {
    groqStatus = { checked: true, working: false, error: "Missing key" };
    console.log("🔴 Groq key check: No key configured.");
    return;
  }
  console.log("Checking if Groq API key is valid...");
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "test status query, reply with exactly 'OK'" }],
        max_tokens: 10
      })
    });
    
    if (response.ok) {
      console.log("====================================================");
      console.log("🟢 GROQ API KEY IS VALID AND WORKING!");
      console.log("====================================================");
      groqStatus = { checked: true, working: true, error: "" };
    } else {
      const txt = await response.text();
      console.error("====================================================");
      console.error(`🔴 GROQ API KEY ERROR (${response.status}):`, txt);
      console.error("====================================================");
      groqStatus = { checked: true, working: false, error: `Error ${response.status}: ${txt}` };
    }
  } catch (err) {
    console.error("====================================================");
    console.error("🔴 GROQ API SEVERE OFFLINE EXCEPTION:", err);
    console.error("====================================================");
    groqStatus = { checked: true, working: false, error: String(err) };
  }
}

// Invoke check immediately
testGroqKey();

// Body parsing limits expanded to handle base64 image canvas uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// In-memory data store
const rooms: Record<string, Room> = {};

// Active Twitch Chat Connections (channelName -> WebSocket standard connection to Twitch IRC)
const twitchConnections: Record<string, WebSocket> = {};

// Initialize Gemini SDK Client dynamically on demand
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (error) {
    console.error("Failed to dynamically initialize Gemini Client:", error);
    return null;
  }
}

// Word filter list for safe generations
const FORBIDDEN_WORDS = [
  "nsfw", "porn", "xxx", "sex", "politics", "politic", "nazi",
  "hitler", "killu", "murder", "suicide", "abuse", "rape", "cock",
  "bitch", "cunt", "faggot", "dick"
];

function sanitizeMessage(text: string): string {
  let cleaned = text;
  for (const word of FORBIDDEN_WORDS) {
    const regex = new RegExp(word, "gi");
    cleaned = cleaned.replace(regex, "***");
  }
  return cleaned;
}

// Generate room code helper
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create initial round helper
function createNewRound(duration: number = 60, collectDuration: number = 30): Round {
  return {
    id: "round_" + Date.now(),
    theme: "",
    duration,
    collectDuration,
    state: RoomState.LOBBY,
    timeLeft: collectDuration,
    chatMessages: [],
    result: null,
    createdAt: new Date().toISOString()
  };
}

// AI Theme Generator Core
async function generateTopicFromChat(messages: string[]): Promise<string> {
  const cleanMessages = (messages || [])
    .map(m => m.trim())
    .filter(m => m.length > 0 && !m.startsWith("/"));

  const hasChat = cleanMessages.length > 0;
  const contentInput = hasChat 
    ? cleanMessages.slice(-50).join("\n") 
    : "";

  // Additional randomized keywords for ultimate variety and inspiration
  const randomKeywordsList = [
    "киберпанк", "сюрреализм", "викторианский", "ретро-футуризм", "алхимия",
    "микроскоп", "подводный", "летающий", "кристальный", "шоколадный",
    "паровой двигатель", "магический свиток", "дворцовый бал", "профессорские очки",
    "межгалактический", "рыцарские латы", "корона времени", "загадочный портал", 
    "японский сад", "древняя магия", "надувной плот", "неоновый неон", "космический вокзал",
    "подземное царство", "парящие острова", "карнавальный костюм", "лазерная арфа",
    "древняя пирамида", "поющая медуза", "кибер-самурай", "светящийся гриб"
  ];
  
  // Choose random mood seeds to inject variety
  const moods = [
    "абсурдный", "эпический", "уютный", "безумный", "сюрреалистичный", 
    "милый", "технологичный", "средневековый", "праздничный", "загадочный",
    "кибернетический", "винтажный", "парадоксальный", "меланхоличный"
  ];

  const shuffledKeywords = [...randomKeywordsList].sort(() => 0.5 - Math.random()).slice(0, 4).join(", ");
  const chosenMood = moods[Math.floor(Math.random() * moods.length)];
  const randomSalt = Math.floor(Math.random() * 100000);

  let systemInstruction = "";
  let promptText = "";

  if (hasChat) {
    // If there ARE messages in chat, force AI to build the plot directly using those words!
    systemInstruction = `Ты — забавный и креативный ИИ-генератор тем для рисования на стримах Twitch.
Твоя ПЕРВОСТЕПЕННАЯ и СТРОЖАЙШАЯ задача — взять слова из сообщений зрителей в чате и сгенерировать ОДНУ безумно забавную, но КРАЙНЕ КОРОТКУЮ тему (строго от 3 до 7 слов!) на русском языке.
ПРАВИЛО №1: Ты ОБЯЗАН использовать слова или идеи, которые зрители написали в чате. Сделай так, чтобы зрители сразу узнали свои идеи! Комбинируй их забавно.
Установка настроения: ${chosenMood}.
Уникальное семя: ${randomSalt}.

Требования к теме:
- Длина: СТРОГО от 3 до 7 слов на русском языке! Никаких длинных предложений! Сюжет должен быть максимально компактным и угарным.
- Структура: Должен быть забавный персонаж, действие и окружение.
- Пример: "Капибара кушает пиццу в космосе" (5 слов) или "Гусь программирует на мухоморе" (5 слов).
- Игнорируй оскорбления, спам, мат и NSFW (заменяй их приличными вещами, например милыми зверями).
- Верни ТОЛЬКО готовую тему рисунка БЕЗ кавычек, БЕЗ преамбулы, БЕЗ пояснений и БЕЗ смайлов.`;

    promptText = `Вот реальные сообщения из чата (составь из них СВЕРХКОРОТКИЙ сюжет строго до 7 слов)::\n${contentInput}\n\nПожалуйста, составь из этих сообщений одну емкую тему в настроении "${chosenMood}".`;
  } else {
    // Fallback if chat is empty
    systemInstruction = `Ты — забавный и креативный ИИ-генератор тем для рисования на стримах Twitch.
В чате пока нет сообщений, поэтому твоя задача — сгенерировать абсолютно случайную, безумную, безумно смешную и КРАЙНЕ КОРОТКУЮ тему рисования (строго от 3 до 7 слов!) на русском языке.
Используй для вдохновения эти случайные мотивы: [${shuffledKeywords}].
Установка настроения: ${chosenMood}.
Уникальное семя: ${randomSalt}.

Требования к теме:
- Длина: СТРОГО от 3 до 7 слов на русском языке! Не пиши длинные предложения.
- Структура: Обязательно персонаж (например: утка, енот, капибара), смешное действие и окружение.
- Пример: "Енот варит пиво под водой" (5 слов) или "Хомяк летит на банане" (5 слов).
- Верни ТОЛЬКО саму готовую тему рисунка (3-7 слов) БЕЗ кавычек, БЕЗ преамбулы и БЕЗ пояснений.`;

    promptText = `В чате пусто. Сгенерируй одну короткую, забавную и полностью случайную тему для рисунка. Уникальный ID запроса: ${randomSalt}. Настроение темы: ${chosenMood}.`;
  }

  // 1. Prioritize Gemini API if configured via dynamic client
  const geminiClient = getGeminiClient();
  if (geminiClient) {
    try {
      console.log("Attempting to call Gemini API for drawing theme...");
      const response = await geminiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.98
        }
      });
      const theme = response.text?.replace(/^["']|["']$/g, "").trim();
      if (theme) {
        console.log(`Successfully generated theme via primary Gemini API: "${theme}"`);
        return theme;
      }
    } catch (err) {
      console.error("Gemini API error during theme generation, attempting Groq fallback...", err);
    }
  }

  // 2. Fallback to Groq API if available (making themes super short as well)
  if (GROQ_API_KEY) {
    try {
      console.log("Attempting to call Groq API for drawing theme fallback...");
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: promptText }
          ],
          temperature: 0.95,
          max_tokens: 40
        })
      });

      if (response.ok) {
        const resultJson = await response.json();
        const theme = resultJson.choices?.[0]?.message?.content?.trim();
        if (theme) {
          console.log(`Successfully generated theme via Groq Fallback: "${theme}"`);
          return theme;
        }
      } else {
        console.error(`Groq API returned status: ${response.status} - ${response.statusText}`);
      }
    } catch (err) {
      console.error("Groq API fallback error", err);
    }
  }

  // 3. Fallback to offline randomized logic (always super short: 3-5 words)
  const backupCharacters = [
    "Капибара", "Инопланетный кот", "Ленивый гусь", "Енот-программист", 
    "Самурайский хомяк", "Космический дельфин", "Дракон-гурман", "Белка-алхимик", 
    "Шпионский жираф", "Няшная панда", "Детективный утконос", "Астронавт-корги"
  ];
  const backupActions = [
    "управляет болидом", "кушает бургер", "танцует брейк", 
    "играет на гитаре", "сражается с лапшой", "варит зелье", 
    "рисует автопортрет", "строит замок", "смотрит в телескоп"
  ];
  const backupEnvironments = [
    "в космосе", "на башне", "в симуляции", 
    "в пустыне", "на вулкане", "в библиотеке", 
    "в океане", "на облаке", "на заводе"
  ];
  
  const char = backupCharacters[Math.floor(Math.random() * backupCharacters.length)];
  const act = backupActions[Math.floor(Math.random() * backupActions.length)];
  const env = backupEnvironments[Math.floor(Math.random() * backupEnvironments.length)];
  
  const fallbackResult = `${char} ${act} ${env}`;
  console.log(`Generated randomized fallback theme: "${fallbackResult}"`);
  return fallbackResult;
}

// AI Image Analyzer Core - Completely offline, reliable, hilarious local reviews
async function analyzeImageResult(theme: string, base64Image: string): Promise<{
  theme_match: number;
  creativity: number;
  details: number;
  funny_comment: string;
  score: number;
  image?: string;
}> {
  console.log(`Room: Reviewing drawing instantly without AI for theme -> "${theme}"`);
  
  const customComments = [
    // Requested exact phrases
    "ебать говно окей",
    "вот это дерьмище",
    "очень круто вроде",
    "фу бля ебать красиво",
    "ты реальный художник",
    // Additional hilarious Russian streamer/Twitch style slang comments
    "ну и мазня (в самом лучшем смысле)",
    "ебать шедевр, Пикассо курит в сторонке",
    "художник от слова худо, конечно... но забавно)",
    "блять это просто сожгите нахуй или повесьте в Лувре",
    "глаза кровоточат, но душевно пиздец",
    "я бы такое за сто баксов купил, но только пьяным",
    "выглядит максимально всрато, но безумно стильно",
    "чистый кайф, за душу берёт лапками",
    "ну такоооое... сойдёт под пиво и сухарики",
    "это шедевр, бля буду! 10 из 10!",
    "достойно галереи современного искусства на свалке",
    "кто вообще разрешил тебе рисовать? это гениально!",
    "ну и пиздец, это точно шедевр века!"
  ];

  const chosenComment = customComments[Math.floor(Math.random() * customComments.length)];
  
  // Choose random fun scores
  const val1 = Math.floor(Math.random() * 9) + 2; // 2 to 10
  const val2 = Math.floor(Math.random() * 9) + 2;
  const val3 = Math.floor(Math.random() * 9) + 2;
  const averageResult = Math.round((val1 + val2 + val3) / 3 * 10) / 10;

  return {
    theme_match: val1,
    creativity: val2,
    details: val3,
    funny_comment: chosenComment,
    score: averageResult
  };
}

// Global active loop interval to manage space/timers (runs every second)
setInterval(() => {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    const round = room.activeRound;
    
    if (round && (round.state === RoomState.COLLECTING || round.state === RoomState.DRAWING)) {
      if (round.timeLeft > 0) {
        round.timeLeft -= 1;
      } else {
        // Automatically advance periods if countdown finishes!
        if (round.state === RoomState.COLLECTING) {
          // Trigger theme generation automatically
          round.state = RoomState.JUDGING;
          const msgTexts = round.chatMessages.map(m => m.message);
          
          generateTopicFromChat(msgTexts).then(generatedTheme => {
            round.theme = generatedTheme;
            round.state = RoomState.DRAWING;
            round.timeLeft = round.duration;
            console.log(`[Timer] Room ${code} advanced to DRAWING. Theme: ${generatedTheme}`);
          });
        } else if (round.state === RoomState.DRAWING) {
          // Stop drawing automatically, wait for streamer to click submit or force JUDGING
          round.state = RoomState.RESULTS;
          console.log(`[Timer] Room ${code} completed DRAWING stage. Awaiting draw PNG review.`);
        }
      }
    }
  }
}, 1000);

// Set up Twitch IRC Public Anonymous Chat Listener
function setupTwitchIRCListener(channel: string) {
  const channelName = channel.toLowerCase().replace("#", "").trim();
  if (!channelName) return;

  // If already listening, don't initiate duplicate
  if (twitchConnections[channelName]) {
    console.log(`Already connected to Twitch channel: #${channelName}`);
    return;
  }

  try {
    console.log(`Connecting to Twitch IRC over WebSocket for channel: #${channelName}`);
    const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

    ws.on("open", () => {
      console.log(`Twitch Web Connection established for #${channelName}`);
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands\r\n");
      // Use standard Twitch anonymous nicknames
      const anonNick = `justinfan${Math.floor(10000 + Math.random() * 89999)}`;
      ws.send(`NICK ${anonNick}\r\n`);
      ws.send(`JOIN #${channelName}\r\n`);
    });

    ws.on("message", (data) => {
      const payload = data.toString();
      const lines = payload.split("\r\n");
      
      for (const line of lines) {
        if (!line) continue;
        
        // Heartbeat ping-pong to stay connected
        if (line.startsWith("PING")) {
          ws.send("PONG :tmi.twitch.tv\r\n");
          continue;
        }

        // Parse IRC channel PRIVMSG
        if (line.includes(" PRIVMSG ")) {
          const msgIndex = line.indexOf(" PRIVMSG ");
          if (msgIndex !== -1) {
            const prefixAndTags = line.substring(0, msgIndex);
            const rest = line.substring(msgIndex + 9); // " PRIVMSG " is 9 chars
            
            const colonIndex = rest.indexOf(" :");
            if (colonIndex !== -1) {
              const channelWithHash = rest.substring(0, colonIndex).trim();
              const chatMessageText = rest.substring(colonIndex + 2);
              
              let displayName = "";
              
              // 1. Try to find display-name in tags
              const displayNameMatch = prefixAndTags.match(/display-name=([^; ]+)/);
              if (displayNameMatch) {
                displayName = decodeURIComponent(displayNameMatch[1]);
              }
              
              // 2. If no display-name, find username between last ':' and '!' in prefixAndTags
              if (!displayName) {
                const exclamIndex = prefixAndTags.indexOf("!");
                if (exclamIndex !== -1) {
                  const lastColonIndex = prefixAndTags.lastIndexOf(":", exclamIndex);
                  if (lastColonIndex !== -1) {
                    displayName = prefixAndTags.substring(lastColonIndex + 1, exclamIndex);
                  } else if (prefixAndTags.startsWith(":")) {
                    displayName = prefixAndTags.substring(1, exclamIndex);
                  } else {
                    displayName = prefixAndTags.substring(0, exclamIndex);
                  }
                }
              }
              
              if (!displayName) {
                // Failsafe backup
                if (prefixAndTags.startsWith(":")) {
                  displayName = prefixAndTags.substring(1).split("!")[0];
                } else {
                  displayName = prefixAndTags.split("!")[0] || "User";
                }
              }

              const sanitized = sanitizeMessage(chatMessageText);
              const cleanMessage: ChatMessage = {
                id: "tw_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                username: displayName.trim(),
                message: sanitized,
                createdAt: new Date().toISOString()
              };

              console.log(`[Twitch Msg Routing] #${channelName} -> @${displayName}: ${chatMessageText}`);

              // Route line-by-line message to all rooms listening to this channel
              for (const room of Object.values(rooms)) {
                if (room.twitchChannel && room.twitchChannel.toLowerCase().replace("#", "").trim() === channelName) {
                  room.activeRound.chatMessages.push(cleanMessage);
                  if (room.activeRound.chatMessages.length > 200) {
                    room.activeRound.chatMessages.shift();
                  }
                }
              }
            }
          }
        }
      }
    });

    ws.on("close", () => {
      console.log(`Twitch connection for #${channelName} closed.`);
      delete twitchConnections[channelName];
    });

    ws.on("error", (err) => {
      console.error(`Twitch socket error for #${channelName}:`, err);
    });

    twitchConnections[channelName] = ws;
  } catch (e) {
    console.error(`Failed to establish Twitch connection for #${channelName}`, e);
  }
}

// API Routes setup

// 1. Create a Room
app.post("/api/rooms", (req, res) => {
  const ownerId = req.body.ownerId || "StreamerHost";
  const twitchChannel = req.body.twitchChannel || "";
  const code = generateRoomCode();
  
  const newRoom: Room = {
    code,
    ownerId,
    twitchChannel,
    isTwitchConnected: !!twitchChannel,
    activeRound: createNewRound(60, 30),
    pastRounds: []
  };

  rooms[code] = newRoom;
  console.log(`Room created: ${code} by ${ownerId}`);

  // Auto connect anonymous Twitch chat IRC if streamer entered a Twitch Name
  if (twitchChannel) {
    setupTwitchIRCListener(twitchChannel);
  }

  res.json({ success: true, data: newRoom });
});

// 2. Fetch specific Room State
app.get("/api/rooms/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ success: false, error: "Комната не найдена." });
  }
  
  // Ensure Twitch IRC connection is active and healing on room fetch
  if (room.twitchChannel) {
    setupTwitchIRCListener(room.twitchChannel);
  }

  res.json({ success: true, data: room });
});

// 3. Connect twitch channel to existing room
app.post("/api/rooms/:code/twitch", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ success: false, error: "Комната не найдена." });
  }

  const twitchChannel = req.body.channel || "";
  if (!twitchChannel) {
    return res.status(400).json({ success: false, error: "Имя канала не может быть пустым." });
  }

  room.twitchChannel = twitchChannel;
  room.isTwitchConnected = true;

  // Connect IRC Listener
  setupTwitchIRCListener(twitchChannel);

  res.json({ success: true, data: room });
});

// 4. Start Gathering ideas
app.post("/api/rooms/:code/start-collect", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ success: false, error: "Комната не найдена." });
  }

  const collectDuration = parseInt(req.body.collectDuration) || 30;
  const drawingDuration = parseInt(req.body.drawingDuration) || 60;

  // Clear or overwrite active round
  room.activeRound = createNewRound(drawingDuration, collectDuration);
  room.activeRound.state = RoomState.COLLECTING;
  room.activeRound.timeLeft = collectDuration;

  console.log(`Room ${code}: started collecting ideas for ${collectDuration}s`);
  res.json({ success: true, data: room });
});

// 5. Complete Gathering / Generate Theme
app.post("/api/rooms/:code/stop-collect", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ success: false, error: "Комната не найдена." });
  }

  const round = room.activeRound;
  round.state = RoomState.JUDGING; // temporary transition state

  const chatTexts = round.chatMessages.map(m => m.message);
  try {
    const generatedTheme = await generateTopicFromChat(chatTexts);
    round.theme = generatedTheme;
    round.state = RoomState.DRAWING;
    round.timeLeft = round.duration;

    console.log(`Room ${code}: theme generated -> "${generatedTheme}"`);
    res.json({ success: true, data: room });
  } catch (error) {
    round.state = RoomState.LOBBY;
    res.status(500).json({ success: false, error: "Не удалось сгенерировать тему." });
  }
});

// 6. Start Painting/Drawing Countdown manually
app.post("/api/rooms/:code/start-drawing", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ success: false, error: "Комната не найдена." });
  }

  const round = room.activeRound;
  if (!round.theme) {
    return res.status(400).json({ success: false, error: "Сначала нужно сгенерировать тему!" });
  }

  round.state = RoomState.DRAWING;
  round.timeLeft = round.duration;

  console.log(`Room ${code}: Streamer started drawing process manually`);
  res.json({ success: true, data: room });
});

// 7. Inject Simulated Chat Idea or custom message
app.post("/api/rooms/:code/chat/simulate", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(400).json({ success: false, error: "Комната не найдена." });
  }

  const customMessage = req.body.message;
  const customUsername = req.body.username;

  let user = "";
  let text = "";
  const isCustom = !!customMessage;

  if (isCustom) {
    text = customMessage.trim();
    user = (customUsername || "Игрок").trim();
  } else {
    const mockUsers = ["ArtFanatic", "Gamer3000", "LaughterCutter", "TwitchLegend", "CozyViewer", "MemeLord", "Doodler", "PaintSlayer"];
    const mockIdeas = [
      "Космическая капибара танцует на пицце!",
      "Гусь программирует на реакте посреди океана из чая",
      "Кот в маске ниндзя крадет печеньки в банке",
      "Пингвин катается на банане по пустыне Сахара",
      "Ленивец ставит рекорд по спидрану на джойстике из сыра",
      "Грустный динозавр пытается надуть мыльный пузырь на Юпитере",
      "Робот кушает макароны в средневековом замке",
      "Самурай-хомяк катается на скейтборде в радужных облаках"
    ];
    user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    text = mockIdeas[Math.floor(Math.random() * mockIdeas.length)];
  }

  const simMsg: ChatMessage = {
    id: "sim_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    username: user,
    message: text,
    createdAt: new Date().toISOString(),
    isSimulated: !isCustom
  };

  room.activeRound.chatMessages.push(simMsg);
  // Keep clean bounds
  if (room.activeRound.chatMessages.length > 200) {
    room.activeRound.chatMessages.shift();
  }

  res.json({ success: true, data: simMsg });
});

// 8. Submit Final Drawing for AI Scorer Review
app.post("/api/rooms/:code/submit-drawing", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ success: false, error: "Комната не найдена." });
  }

  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ success: false, error: "Отсутствует изображение рисунка." });
  }

  const round = room.activeRound;
  round.state = RoomState.JUDGING;

  try {
    console.log(`Room ${code}: evaluating drawing via AI for theme -> "${round.theme}"`);
    const scoreResult = await analyzeImageResult(round.theme, imageBase64);
    
    // Attach drawing base64 for history display
    scoreResult.image = imageBase64;
    
    round.result = scoreResult;
    round.state = RoomState.RESULTS;

    // Save this finished round to the room's past history list
    room.pastRounds.unshift({ ...round });

    console.log(`Room ${code}: evaluation complete. Score: ${scoreResult.score}/10`);
    res.json({ success: true, data: room });
  } catch (error) {
    console.error("Error evaluating drawing:", error);
    round.state = RoomState.DRAWING; // revert to let them try submitting again
    res.status(500).json({ success: false, error: "Не удалось оценить рисунок. Попробуйте еще раз." });
  }
});

// 9. Reset room back to lobby
app.post("/api/rooms/:code/reset", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ success: false, error: "Комната не найдена." });
  }

  // Preserve chat list, just put room status back to Lobby
  const currentHistory = [...room.pastRounds];
  room.activeRound = createNewRound(60, 30);
  console.log(`Room ${code}: reset back to Lobby stage`);
  
  res.json({ success: true, data: room });
});

// 10. Twitch OAuth configuration and flow endpoints
app.get("/api/groq/status", (req, res) => {
  res.json({
    success: true,
    data: groqStatus
  });
});

app.get("/api/twitch/config", (req, res) => {
  const isTwitchConfigured = !!process.env.TWITCH_CLIENT_ID && !!process.env.TWITCH_CLIENT_SECRET;
  res.json({
    success: true,
    isTwitchConfigured
  });
});

app.get("/api/twitch/login", (req, res) => {
  const client_id = process.env.TWITCH_CLIENT_ID;
  if (!client_id) {
    return res.status(400).json({ success: false, error: "Twitch Client ID не настроен в .env." });
  }

  const app_url = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const redirect_uri = `${app_url}/api/twitch/callback`;
  const state = String(req.query.state || "lobby");

  // Requesting user info profile visibility scope
  const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=user:read:email&state=${state}`;
  res.redirect(twitchAuthUrl);
});

app.get("/api/twitch/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect("/?twitch_login=error&error=no_code_provided");
  }

  const client_id = process.env.TWITCH_CLIENT_ID;
  const client_secret = process.env.TWITCH_CLIENT_SECRET;
  const app_url = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const redirect_uri = `${app_url}/api/twitch/callback`;

  try {
    // Exchange authorize code for access token
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: client_id || "",
        client_secret: client_secret || "",
        code: String(code),
        grant_type: "authorization_code",
        redirect_uri: redirect_uri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Twitch token exchange failure:", errorText);
      return res.redirect(`/?twitch_login=error&error=token_failed`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Fetch authorized user details from Twitch API
    const userResponse = await fetch("https://api.twitch.tv/helix/users", {
      method: "GET",
      headers: {
        "Client-ID": client_id || "",
        "Authorization": `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("Twitch helix user info failure:", errorText);
      return res.redirect(`/?twitch_login=error&error=profile_failed`);
    }

    const responseData = await userResponse.json() as { data: Array<{ login: string; profile_image_url: string }> };
    const userData = responseData.data?.[0];
    if (!userData) {
      return res.redirect(`/?twitch_login=error&error=no_user_found`);
    }

    const username = userData.login;
    const avatar = userData.profile_image_url;

    // Return to client app with temporary successful login url parameters
    res.redirect(`/?twitch_login=success&username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`);
  } catch (error) {
    console.error("Uncaught exception in Twitch login callback:", error);
    res.redirect(`/?twitch_login=error&error=callback_exception`);
  }
});

// Endpoint for spectators to fetch/stream the ongoing canvas drawing live
app.post("/api/rooms/:code/drawing-sync", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ success: false, error: "Комната не найдена." });
  }

  const { imageBase64 } = req.body;
  room.activeRound.currentDrawing = imageBase64;
  res.json({ success: true, data: room });
});

app.get("/api/twitch/auth-mock", (req, res) => {
  const mockUser = req.query.username || "CoolStreamer_" + Math.floor(Math.random() * 100);
  res.json({
    success: true,
    twitchId: "tw_" + Math.floor(Math.random() * 8999999 + 1000000),
    username: mockUser,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUser}`
  });
});

// Vite & Static file configurations
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`===============================================`);
    console.log(`ChatDraw Challenge server successfully started!`);
    console.log(`Running on http://0.0.0.0:${PORT}`);
    console.log(`===============================================`);
  });
}

startServer();
