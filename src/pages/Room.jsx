import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Hourglass, PartyPopper, Home as HomeIcon, Eye, LogIn, HardHat, UserPlus } from 'lucide-react';
import { backend } from '../lib/backend.js';
import { getIdentity, setIdentity, getSavedName, saveName, addMyRoom, removeMyRoom } from '../lib/storage.js';
import { useAuth, effectivePlayerId } from '../lib/auth.js';
import { recordFinishedGame } from '../lib/history.js';
import { usedWordsSet, scoreFor, relativeTime } from '../lib/gameLogic.js';
import ScoreBoard from '../components/ScoreBoard.jsx';
import HistoryFeed from '../components/HistoryFeed.jsx';
import TurnComposer from '../components/TurnComposer.jsx';
import ShareInvite from '../components/ShareInvite.jsx';

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-3xl bg-night-800/70 p-5 shadow-xl ring-1 ring-white/10 ${className}`}>
      {children}
    </div>
  );
}

export default function Room() {
  const { code: rawCode } = useParams();
  const code = (rawCode ?? '').toUpperCase();
  const [state, setState] = useState(null); // { room, turns }
  const [loading, setLoading] = useState(true);
  const [identity, setIdentityState] = useState(() => getIdentity(code));
  const [joinName, setJoinName] = useState(getSavedName());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const feedEndRef = useRef(null);
  const { user } = useAuth();

  const refresh = useCallback((next) => setState(next), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initial = await backend.getRoom(code);
        if (!cancelled) setState(initial);
      } catch {
        /* handled by the not-found state below */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const unsubscribe = backend.subscribe(code, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [code, refresh]);

  const room = state?.room;
  const turns = state?.turns ?? [];
  // In local (pass-and-play) mode both players share this browser, so the
  // device always acts as whoever's turn it is.
  const isLocal = backend.mode === 'local';
  const myPlayer = isLocal ? (room?.current_turn ?? null) : (identity?.player ?? null);
  const myTurn = room?.status === 'playing' && myPlayer != null && room.current_turn === myPlayer;

  // Tab title nudges the player when it's their move.
  useEffect(() => {
    document.title = myTurn ? '🔔 תורך! — בקסדה' : 'בקסדה 🪖';
    return () => { document.title = 'בקסדה 🪖'; };
  }, [myTurn]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns.length]);

  // Online mode keeps finished rooms in the DB — they ARE the history.
  // Local pass-and-play still records to localStorage history and cleans up
  // the room (the finished screen stays up: subscribe ignores missing rooms).
  useEffect(() => {
    if (!isLocal || !room || room.status !== 'finished') return;
    recordFinishedGame({ room, turns, me: null });
    removeMyRoom(code);
    backend.deleteRoom(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status]);

  async function handleJoin(e) {
    e.preventDefault();
    const name = joinName.trim() || 'שחקן 2';
    setJoining(true);
    setError('');
    try {
      saveName(name);
      await backend.joinRoom(code, name, effectivePlayerId(user));
      if (!isLocal) {
        const id = { player: 2, name };
        setIdentity(code, id);
        setIdentityState(id);
      }
      addMyRoom(code);
      const fresh = await backend.getRoom(code);
      if (fresh) setState(fresh);
    } catch (err) {
      setError(err.message || 'ההצטרפות נכשלה');
    } finally {
      setJoining(false);
    }
  }

  async function handleSubmitWords(words) {
    await backend.submitTurn({ code, player: myPlayer, words });
    const fresh = await backend.getRoom(code);
    if (fresh) setState(fresh);
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 1400);
  }

  async function handleGiveUp() {
    try {
      await backend.endGame({ code, player: myPlayer, action: 'pass' });
      const fresh = await backend.getRoom(code);
      if (fresh) setState(fresh);
    } catch (err) {
      setError(err.message || 'משהו השתבש');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 pt-24 text-slate-400">
        <Loader2 size={32} className="animate-spin text-mint-400" />
        טוענים את החדר...
      </div>
    );
  }

  if (!room) {
    return (
      <Card className="animate-slide-up mt-12 text-center">
        <HardHat size={40} className="mx-auto mb-3 text-slate-400" />
        <h2 className="text-xl font-bold text-white">החדר {code} לא נמצא</h2>
        <p className="mt-2 text-sm text-slate-400">
          אולי הקוד שגוי, או שהחדר נוצר בדפדפן אחר במצב מקומי.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-mint-400 px-5 py-2.5 font-bold text-night-950 transition active:scale-95"
        >
          <HomeIcon size={16} />
          למשחק חדש
        </Link>
      </Card>
    );
  }

  // A visitor with no identity (online mode): join as player 2, or watch if full.
  if (!identity && !isLocal) {
    if (!room.player2_name) {
      return (
        <div className="animate-slide-up space-y-4">
          <Card className="text-center">
            <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-mint-400 to-emerald-600 text-5xl font-black text-night-950 shadow-lg">
              {room.letter}
            </div>
            <h2 className="text-xl font-bold text-white">
              {room.player1_name} מזמין/ה אותך לשחק!
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              עד 3 מילים בתור, כולן מתחילות ב"{room.letter}" — ונכנסות בקסדה 🪖
            </p>
          </Card>
          <Card>
            <form onSubmit={handleJoin} className="space-y-3">
              <label className="block text-sm text-slate-300" htmlFor="join-name">איך קוראים לך?</label>
              <input
                id="join-name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={20}
                placeholder="השם שלך"
                className="w-full rounded-2xl bg-night-950/80 px-4 py-3 text-white placeholder-slate-500 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-mint-400"
              />
              <button
                type="submit"
                disabled={joining}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-mint-400 to-emerald-500 px-4 py-3 font-bold text-night-950 shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {joining ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                מצטרפ/ת למשחק
              </button>
              {error && <p className="text-center text-sm text-rose-400">{error}</p>}
            </form>
          </Card>
        </div>
      );
    }
    // Room is full — spectator mode.
    return (
      <div className="animate-slide-up space-y-4">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
          <Eye size={15} />
          צופים במשחק
        </div>
        <ScoreBoard room={room} scores={{ 1: scoreFor(turns, 1), 2: scoreFor(turns, 2) }} myPlayer={null} />
        <Card><HistoryFeed turns={turns} room={room} myPlayer={null} /></Card>
      </div>
    );
  }

  const scores = { 1: scoreFor(turns, 1), 2: scoreFor(turns, 2) };
  const opponentName = myPlayer === 1 ? room.player2_name : room.player1_name;
  const lastActivity = turns.length > 0 ? turns[turns.length - 1].created_at : room.updated_at;

  return (
    <div className="animate-slide-up space-y-4 pb-4">
      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="animate-pop-in text-7xl">🎉</div>
        </div>
      )}

      <ScoreBoard room={room} scores={scores} myPlayer={isLocal ? null : myPlayer} />

      {room.status === 'waiting' && (
        isLocal ? (
          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-white">
              <UserPlus size={18} className="text-mint-400" />
              מי משחק מולך?
            </h2>
            <p className="mb-3 text-xs text-slate-400">
              מצב מקומי: משחקים יחד על אותו מכשיר ומעבירים אותו בין תורות.
            </p>
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={20}
                placeholder="שם השחקן השני"
                className="min-w-0 flex-1 rounded-2xl bg-night-950/80 px-4 py-3 text-white placeholder-slate-500 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-mint-400"
              />
              <button
                type="submit"
                disabled={joining}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-mint-400 to-emerald-500 px-4 font-bold text-night-950 transition active:scale-95 disabled:opacity-60"
              >
                {joining ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                מתחילים
              </button>
            </form>
            {error && <p className="mt-2 text-center text-sm text-rose-400">{error}</p>}
          </Card>
        ) : (
          <Card className="text-center">
            <Hourglass size={26} className="mx-auto mb-2 animate-float text-sun-400" />
            <h2 className="text-lg font-bold text-white">מחכים לשחקן שני...</h2>
            <p className="mb-4 mt-1 text-sm text-slate-300">
              שלחו את הקישור לחבר/ה — המשחק יתחיל ברגע שיצטרפו.
            </p>
            <ShareInvite code={code} letter={room.letter} />
          </Card>
        )
      )}

      {room.status === 'finished' && (
        <Card className="animate-pop-in text-center">
          <PartyPopper size={32} className="mx-auto mb-2 text-sun-400" />
          <h2 className="text-2xl font-black text-white">
            {!isLocal && room.winner === myPlayer
              ? 'ניצחת! 🏆'
              : room.winner
                ? `${room.winner === 1 ? room.player1_name : room.player2_name} ניצח/ה! 🏆`
                : 'המשחק נגמר'}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {room.win_reason === 'concede' ? 'בעקבות כניעה' : 'כי נגמרו המילים'} · {scores[1]} : {scores[2]} מילים
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-mint-400 to-emerald-500 px-6 py-3 font-bold text-night-950 shadow-lg transition active:scale-95"
          >
            <PartyPopper size={18} />
            משחק חדש
          </Link>
        </Card>
      )}

      <Card>
        <h3 className="mb-3 text-sm font-bold text-slate-300">מה נאמר עד עכשיו</h3>
        <div className="max-h-[45dvh] overflow-y-auto pl-1">
          <HistoryFeed turns={turns} room={room} myPlayer={isLocal ? 1 : myPlayer} />
          <div ref={feedEndRef} />
        </div>
      </Card>

      {room.status === 'playing' && (
        myTurn ? (
          <Card>
            <TurnComposer
              letter={room.letter}
              usedWords={usedWordsSet(turns)}
              onSubmit={handleSubmitWords}
              onGiveUp={handleGiveUp}
              activeName={isLocal ? (room.current_turn === 1 ? room.player1_name : room.player2_name) : null}
            />
          </Card>
        ) : (
          <Card className="text-center">
            <Hourglass size={22} className="mx-auto mb-1.5 animate-float text-sun-400" />
            <p className="font-bold text-white">עכשיו תור של {opponentName}</p>
            <p className="mt-1 text-xs text-slate-400">
              פעילות אחרונה: {relativeTime(lastActivity)} · אפשר לסגור ולחזור מאוחר יותר, הכל נשמר
            </p>
          </Card>
        )
      )}

      {error && room.status !== 'waiting' && (
        <p className="text-center text-sm text-rose-400">{error}</p>
      )}
    </div>
  );
}
