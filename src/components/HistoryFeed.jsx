import { Flag, HandMetal, MessageSquareText } from 'lucide-react';
import { relativeTime } from '../lib/gameLogic.js';

function TurnBubble({ turn, playerName, mine }) {
  if (turn.action !== 'words') {
    const label = turn.action === 'concede'
      ? `${playerName} נכנע/ה 🏳️`
      : `${playerName} לא מצא/ה עוד מילים 😅`;
    return (
      <div className="animate-slide-up flex items-center justify-center gap-2 py-1 text-xs text-slate-400">
        <Flag size={12} />
        {label}
      </div>
    );
  }
  return (
    <div className={`animate-slide-up flex ${mine ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow ${
          mine
            ? 'rounded-br-md bg-mint-400/15 ring-1 ring-mint-400/30'
            : 'rounded-bl-md bg-white/8 ring-1 ring-white/10'
        }`}
      >
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className={`text-xs font-bold ${mine ? 'text-mint-400' : 'text-sky-300'}`}>{playerName}</span>
          <span className="text-[10px] text-slate-500">{relativeTime(turn.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {turn.words.map((w, i) => (
            <span
              key={i}
              className="animate-pop-in rounded-full bg-night-950/70 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/10"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HistoryFeed({ turns, room, myPlayer }) {
  if (turns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-400">
        <MessageSquareText size={28} className="opacity-50" />
        עוד לא נאמרו מילים.
        <span className="flex items-center gap-1">
          {room.player1_name} פותח/ת! <HandMetal size={14} />
        </span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {turns.map((turn, i) => (
        <TurnBubble
          key={turn.id ?? i}
          turn={turn}
          playerName={turn.player === 1 ? room.player1_name : room.player2_name}
          mine={myPlayer != null && turn.player === myPlayer}
        />
      ))}
    </div>
  );
}
