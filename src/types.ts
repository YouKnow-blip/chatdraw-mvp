/**
 * ChatDraw Challenge types and interfaces
 */

export enum RoomState {
  LOBBY = "LOBBY",
  COLLECTING = "COLLECTING",
  DRAWING = "DRAWING",
  JUDGING = "JUDGING",
  RESULTS = "RESULTS"
}

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  createdAt: string;
  isSimulated?: boolean;
}

export interface RoundResult {
  theme_match: number;       // 0 to 10
  creativity: number;        // 0 to 10
  details: number;           // 0 to 10
  funny_comment: string;     // AI roast/comment
  score: number;             // average score
  image?: string;            // base64 png
}

export interface Round {
  id: string;
  theme: string;
  duration: number;          // in seconds: 60, 300, 600 (1, 5, 10 mins)
  collectDuration: number;   // in seconds: default 30
  state: RoomState;
  timeLeft: number;          // active countdown
  chatMessages: ChatMessage[];
  currentDrawing?: string;    // Real-time canvas preview for spectators (base64 PNG data URL)
  result: RoundResult | null;
  createdAt: string;
}

export interface Room {
  code: string;
  ownerId: string;           // twitch username or session id
  twitchChannel: string;     // Connected Twitch channel name (if any)
  isTwitchConnected: boolean;
  avatarUrl?: string;        // streamer logo
  activeRound: Round;
  pastRounds: Round[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
