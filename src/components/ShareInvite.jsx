import { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';

export default function ShareInvite({ code, letter }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}#/room/${code}`;
  const inviteText = `🪖 בוא/י לשחק איתי "בקסדה"! האות שלנו: ${letter}\n${link}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API can be unavailable (http, old browsers) — fallback prompt.
      window.prompt('העתיקו את הקישור:', link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-night-950/80 px-4 py-3 ring-1 ring-white/10">
        <div className="text-xs text-slate-400">קוד החדר</div>
        <div dir="ltr" className="text-center font-mono text-2xl font-bold tracking-[0.3em] text-white">{code}</div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyLink}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-3 font-bold transition active:scale-95 ${
            copied ? 'bg-mint-400 text-night-950' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? 'הועתק!' : 'העתקת קישור'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366]/90 px-3 py-3 font-bold text-white transition hover:bg-[#25D366] active:scale-95"
        >
          <MessageCircle size={18} />
          וואטסאפ
        </a>
      </div>
    </div>
  );
}
