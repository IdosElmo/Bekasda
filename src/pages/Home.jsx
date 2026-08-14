import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dices, Play, LogIn, ChevronDown, ChevronLeft, Loader2, Swords, History, Trophy, Hourglass } from 'lucide-react';
import { HEBREW_LETTERS, randomLetter, relativeTime } from '../lib/gameLogic.js';
import { backend } from '../lib/backend.js';
import { getSavedName, saveName, setIdentity, getIdentity, getMyRooms, addMyRoom, removeMyRoom } from '../lib/storage.js';
import { getHistory, recordFinishedGame, historyTally } from '../lib/history.js';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState(getSavedName());
  const [letter, setLetter] = useState(randomLetter());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [myGames, setMyGames] = useState(null); // null = still loading
  const [history, setHistory] = useState(getHistory());

  // Load my open rooms; finished ones found here (e.g. the opponent conceded
  // while this tab was closed) get recorded to history and cleaned up.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const codes = getMyRooms();
      const results = await Promise.all(
        codes.map(async (c) => {
          try {
            return { code: c, state: await backend.getRoom(c) };
          } catch {
            return { code: c, state: undefined }; // network trouble — keep for next time
          }
        })
      );
      const active = [];
      for (const { code, state } of results) {
        if (state === undefined) continue;
        if (state === null) {
          removeMyRoom(code);
          continue;
        }
        if (state.room.status === 'finished') {
          const me = backend.mode === 'local' ? null : (getIdentity(code)?.player ?? null);
          recordFinishedGame({ room: state.room, turns: state.turns, me });
          removeMyRoom(code);
          if (backend.mode === 'local' || me != null) backend.markResultSeen({ code, player: me });
          continue;
        }
        active.push(state);
      }
      if (!cancelled) {
        setMyGames(active);
        setHistory(getHistory());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function createGame() {
    const playerName = name.trim() || 'שחקן 1';
    setCreating(true);
    setError('');
    try {
      saveName(playerName);
      const room = await backend.createRoom({ letter, playerName });
      setIdentity(room.code, { player: 1, name: playerName });
      addMyRoom(room.code);
      navigate(`/room/${room.code}`);
    } catch (e) {
      setError(e.message || 'משהו השתבש, נסו שוב');
      setCreating(false);
    }
  }

  function joinGame(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code) navigate(`/room/${code}`);
  }

  return (
    <div className="animate-slide-up space-y-6">
      <section className="rounded-3xl bg-night-800/70 p-6 text-center shadow-xl ring-1 ring-white/10">
        <div className="animate-float mb-2 text-6xl" aria-hidden>🪖</div>
        <h1 className="text-3xl font-black text-white">מה נכנס בקסדה?</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          כל תור אומרים עד 3 דברים שמתחילים באות שנבחרה — ונכנסים בקסדה.
          מי שנתקע בלי מילים... מפסיד! 🎉
        </p>
      </section>

      {myGames?.length > 0 && (
        <section className="rounded-3xl bg-night-800/70 p-5 shadow-xl ring-1 ring-white/10">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <Swords size={18} className="text-mint-400" />
            המשחקים שלי
          </h2>
          <div className="space-y-2">
            {myGames.map(({ room }) => {
              const me = backend.mode === 'local' ? null : (getIdentity(room.code)?.player ?? null);
              const myTurn = room.status === 'playing' && me != null && room.current_turn === me;
              const waiting = room.status === 'waiting';
              const turnName = room.current_turn === 1 ? room.player1_name : room.player2_name;
              return (
                <Link
                  key={room.code}
                  to={`/room/${room.code}`}
                  className="flex items-center gap-3 rounded-2xl bg-night-950/60 p-3 ring-1 ring-white/10 transition hover:bg-white/5 active:scale-[0.98]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mint-400 to-emerald-600 text-2xl font-black text-night-950">
                    {room.letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">
                      {room.player1_name}{room.player2_name ? ` נגד ${room.player2_name}` : ''}
                    </div>
                    <div className="text-xs text-slate-400">{relativeTime(room.updated_at)}</div>
                  </div>
                  {waiting ? (
                    <span className="flex items-center gap-1 rounded-full bg-sun-400/15 px-2.5 py-1 text-xs font-medium text-sun-400">
                      <Hourglass size={11} />
                      ממתין
                    </span>
                  ) : myTurn ? (
                    <span className="animate-pulse-ring rounded-full bg-mint-400 px-2.5 py-1 text-xs font-bold text-night-950">
                      תורך!
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">
                      תור של {turnName}
                    </span>
                  )}
                  <ChevronLeft size={16} className="shrink-0 text-slate-500" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-night-800/70 p-6 shadow-xl ring-1 ring-white/10">
        <h2 className="mb-4 text-lg font-bold text-white">משחק חדש</h2>

        <label className="mb-1 block text-sm text-slate-300" htmlFor="player-name">איך קוראים לך?</label>
        <input
          id="player-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="השם שלך"
          className="mb-4 w-full rounded-2xl bg-night-950/80 px-4 py-3 text-white placeholder-slate-500 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-mint-400"
        />

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mint-400 to-emerald-600 text-4xl font-black text-night-950 shadow-lg">
            {letter}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={() => setLetter(randomLetter())}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 active:scale-95"
            >
              <Dices size={16} />
              אות אקראית
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center justify-center gap-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
            >
              לבחור בעצמי
              <ChevronDown size={14} className={`transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {pickerOpen && (
          <div className="animate-pop-in mb-4 grid grid-cols-8 gap-1.5" role="listbox" aria-label="בחירת אות">
            {HEBREW_LETTERS.map((l) => (
              <button
                key={l}
                type="button"
                role="option"
                aria-selected={l === letter}
                onClick={() => { setLetter(l); setPickerOpen(false); }}
                className={`aspect-square rounded-lg text-lg font-bold transition active:scale-90 ${
                  l === letter
                    ? 'bg-mint-400 text-night-950'
                    : 'bg-night-950/80 text-slate-200 ring-1 ring-white/10 hover:bg-white/10'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={createGame}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-mint-400 to-emerald-500 px-4 py-3.5 text-lg font-bold text-night-950 shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {creating ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
          {creating ? 'יוצרים חדר...' : 'יאללה, מתחילים!'}
        </button>
        {error && <p className="mt-2 text-center text-sm text-rose-400">{error}</p>}
      </section>

      <section className="rounded-3xl bg-night-800/70 p-6 shadow-xl ring-1 ring-white/10">
        <h2 className="mb-1 text-lg font-bold text-white">הוזמנתם למשחק?</h2>
        <p className="mb-3 text-xs text-slate-400">הזינו את קוד החדר שקיבלתם מחבר/ה</p>
        <form onSubmit={joinGame} className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="K7KKV"
            aria-label="קוד חדר"
            maxLength={8}
            dir="ltr"
            className="min-w-0 flex-1 rounded-2xl bg-night-950/80 px-4 py-3 text-center font-mono text-lg tracking-widest text-white placeholder-slate-500 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-mint-400"
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 font-bold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-40"
          >
            <LogIn size={18} />
            הצטרפות
          </button>
        </form>
      </section>

      {history.length > 0 && (
        <section className="rounded-3xl bg-night-800/70 p-5 shadow-xl ring-1 ring-white/10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <History size={18} className="text-sky-300" />
              היסטוריה
            </h2>
            {(() => {
              const { wins, losses } = historyTally();
              return (wins + losses > 0) && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                  <Trophy size={12} className="text-sun-400" />
                  {wins} נצחונות · {losses} הפסדים
                </span>
              );
            })()}
          </div>
          <div className="space-y-1.5">
            {history.slice(0, 10).map((e) => {
              const iWon = e.me != null && e.winner === e.me;
              const iLost = e.me != null && e.winner != null && e.winner !== e.me;
              return (
                <div
                  key={e.code}
                  className="flex items-center gap-3 rounded-2xl bg-night-950/50 px-3 py-2.5 ring-1 ring-white/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg font-black text-slate-300 ring-1 ring-white/10">
                    {e.letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">
                      <span className={e.winner === 1 ? 'font-bold text-mint-400' : ''}>{e.p1}</span>
                      <span className="mx-1.5 font-mono text-slate-400">{e.s1}:{e.s2}</span>
                      <span className={e.winner === 2 ? 'font-bold text-mint-400' : ''}>{e.p2}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{relativeTime(e.at)}</div>
                  </div>
                  {iWon && <span className="rounded-full bg-mint-400/15 px-2.5 py-0.5 text-xs font-bold text-mint-400">ניצחון 🏆</span>}
                  {iLost && <span className="rounded-full bg-rose-400/10 px-2.5 py-0.5 text-xs text-rose-300">הפסד</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
