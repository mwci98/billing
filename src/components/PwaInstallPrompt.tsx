import { Download, Share, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'qpos-pwa-install-dismissed-until';

function isDismissed() {
  return Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent) || (userAgent.includes('macintosh') && 'ontouchend' in document);
    const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent);

    if (isIos && isSafari) {
      setShowIosHint(true);
      setHidden(false);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setShowIosHint(false);
      setHidden(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 1000 * 60 * 60 * 24 * 14));
    setHidden(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') setHidden(true);
  };

  if (hidden || (!installEvent && !showIosHint)) return null;

  return (
    <aside className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md rounded-2xl border border-emerald-400/25 bg-[#141416]/95 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:bottom-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install suggestion"
        className="absolute right-3 top-3 rounded-lg p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-[#07110d] shadow-lg shadow-emerald-500/20">
          <Smartphone className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold">Install QPOS</p>
          {showIosHint ? (
            <p className="mt-1 text-xs leading-5 text-white/65">
              In Safari, tap <Share className="mx-0.5 inline h-3.5 w-3.5" /> <strong className="text-white/90">Share</strong>, then choose <strong className="text-white/90">Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-white/65">Add QPOS to your device for faster, full-screen access.</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/65 transition hover:text-white">
          Not now
        </button>
        {installEvent ? (
          <button type="button" onClick={() => void install()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-[#07110d] transition hover:bg-emerald-400">
            <Download className="h-3.5 w-3.5" /> Install app
          </button>
        ) : null}
      </div>
    </aside>
  );
}
