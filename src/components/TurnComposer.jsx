import { useState } from 'react';
import { Send, Flag, Loader2, AlertCircle } from 'lucide-react';
import { MAX_WORDS_PER_TURN, validateTurn, validateWord } from '../lib/gameLogic.js';

export default function TurnComposer({ letter, usedWords, onSubmit, onGiveUp, activeName }) {
  const [words, setWords] = useState(['', '', '']);
  const [errors, setErrors] = useState({});
  const [general, setGeneral] = useState('');
  const [sending, setSending] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  function updateWord(i, value) {
    setWords((prev) => prev.map((w, j) => (j === i ? value : w)));
    if (errors[i] || general) {
      setErrors((prev) => { const next = { ...prev }; delete next[i]; return next; });
      setGeneral('');
    }
  }

  function fail(nextErrors, nextGeneral) {
    setErrors(nextErrors ?? {});
    setGeneral(nextGeneral ?? '');
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  async function submit(e) {
    e.preventDefault();
    const result = validateTurn(words, letter, usedWords);
    if (!result.ok) {
      fail(result.errors, result.general);
      return;
    }
    setSending(true);
    try {
      await onSubmit(result.words);
      setWords(['', '', '']);
      setErrors({});
      setGeneral('');
    } catch (err) {
      fail({}, err.message || 'שליחה נכשלה, נסו שוב');
    } finally {
      setSending(false);
    }
  }

  const filledCount = words.filter((w) => w.trim()).length;

  return (
    <form onSubmit={submit} className={`space-y-2.5 ${shake ? 'animate-wiggle' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-mint-400">
          {activeName ? `תור של ${activeName} — ` : 'תורך! '}מה נכנס בקסדה?
        </span>
        <span className="text-xs text-slate-400">{filledCount}/{MAX_WORDS_PER_TURN} מילים</span>
      </div>

      {words.map((word, i) => {
        const trimmed = word.trim();
        const liveOk = trimmed && validateWord(trimmed, letter, usedWords).ok;
        return (
          <div key={i}>
            <div className="relative">
              <input
                value={word}
                onChange={(e) => updateWord(i, e.target.value)}
                placeholder={i === 0 ? `משהו שמתחיל ב"${letter}"...` : 'אפשר עוד אחת (לא חובה)'}
                maxLength={30}
                className={`w-full rounded-2xl bg-night-950/80 px-4 py-3 pl-10 text-white placeholder-slate-500 ring-1 outline-none transition focus:ring-2 ${
                  errors[i]
                    ? 'ring-rose-500/70 focus:ring-rose-400'
                    : liveOk
                      ? 'ring-mint-400/50 focus:ring-mint-400'
                      : 'ring-white/10 focus:ring-mint-400'
                }`}
              />
              {liveOk && !errors[i] && (
                <span className="animate-pop-in absolute left-3 top-1/2 -translate-y-1/2 text-mint-400">✓</span>
              )}
            </div>
            {errors[i] && (
              <p className="mt-1 flex items-center gap-1 text-xs text-rose-400">
                <AlertCircle size={12} />
                {errors[i]}
              </p>
            )}
          </div>
        );
      })}

      {general && (
        <p className="flex items-center gap-1 text-sm text-rose-400">
          <AlertCircle size={14} />
          {general}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={sending || filledCount === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-mint-400 to-emerald-500 px-4 py-3 font-bold text-night-950 shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          שליחה
        </button>
        {confirmGiveUp ? (
          <button
            type="button"
            onClick={() => { setConfirmGiveUp(false); onGiveUp(); }}
            onBlur={() => setConfirmGiveUp(false)}
            className="rounded-2xl bg-rose-500/90 px-4 py-3 text-sm font-bold text-white transition active:scale-95"
          >
            בטוח? כן, נגמרו לי
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmGiveUp(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
          >
            <Flag size={15} />
            אין לי מילים
          </button>
        )}
      </div>
    </form>
  );
}
