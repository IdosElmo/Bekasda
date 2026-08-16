import { Routes, Route, Link } from 'react-router-dom';
import { HardHat, WifiOff, Loader2 } from 'lucide-react';
import Home from './pages/Home.jsx';
import Room from './pages/Room.jsx';
import AuthButton from './components/AuthButton.jsx';
import NotificationsBell from './components/NotificationsBell.jsx';
import { isOnlineMode } from './lib/backend.js';

export default function App() {
  // Mid-OAuth redirect: the URL hash carries tokens that supabase-js is about
  // to consume and clear — show a spinner instead of letting the router 404.
  if (/access_token=|error_description=/.test(window.location.hash)) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-400">
        <Loader2 size={28} className="animate-spin text-mint-400" />
      </div>
    );
  }
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8">
      <header className="flex items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-white">
          <span className="animate-float text-2xl" aria-hidden>🪖</span>
          בקסדה
        </Link>
        {isOnlineMode ? (
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <AuthButton />
          </div>
        ) : (
          <span
            className="flex items-center gap-1 rounded-full bg-sun-400/15 px-3 py-1 text-xs font-medium text-sun-400"
            title="Supabase לא מוגדר — המשחק נשמר רק בדפדפן הזה"
          >
            <WifiOff size={13} />
            מצב מקומי
          </span>
        )}
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:code" element={<Room />} />
          <Route
            path="*"
            element={
              <div className="mt-24 text-center text-slate-400">
                <HardHat className="mx-auto mb-3" size={40} />
                <p>הדף לא נמצא</p>
                <Link to="/" className="mt-2 inline-block text-mint-400 underline">חזרה הביתה</Link>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
