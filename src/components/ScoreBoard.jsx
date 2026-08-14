import { Crown } from 'lucide-react';

function PlayerCard({ name, score, active, isMe, winner }) {
  return (
    <div
      className={`relative flex-1 rounded-2xl px-3 py-2.5 text-center ring-1 transition ${
        active
          ? 'bg-mint-400/15 ring-mint-400/60 animate-pulse-ring'
          : 'bg-night-950/60 ring-white/10'
      }`}
    >
      {winner && <Crown size={16} className="absolute -top-2 right-2 text-sun-400" />}
      <div className="truncate text-sm font-bold text-white">
        {name ?? 'ממתינים...'}
        {isMe && <span className="mr-1 text-xs font-normal text-mint-400">(אני)</span>}
      </div>
      <div className="text-xl font-black text-mint-400">{score}</div>
      <div className="text-[10px] text-slate-400">מילים</div>
    </div>
  );
}

export default function ScoreBoard({ room, scores, myPlayer }) {
  const playing = room.status === 'playing';
  return (
    <div className="flex items-stretch gap-2">
      <PlayerCard
        name={room.player1_name}
        score={scores[1]}
        active={playing && room.current_turn === 1}
        isMe={myPlayer === 1}
        winner={room.winner === 1}
      />
      <div className="flex flex-col items-center justify-center px-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mint-400 to-emerald-600 text-3xl font-black text-night-950 shadow-lg">
          {room.letter}
        </div>
        <div className="mt-1 text-[10px] text-slate-400">האות שלנו</div>
      </div>
      <PlayerCard
        name={room.player2_name}
        score={scores[2]}
        active={playing && room.current_turn === 2}
        isMe={myPlayer === 2}
        winner={room.winner === 2}
      />
    </div>
  );
}
