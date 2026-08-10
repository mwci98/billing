import React from 'react';

export const SplashScreen: React.FC = () => (
  <div className="fixed inset-0 z-[200] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#07110D] px-6 text-white" role="status" aria-label="Loading QPOS">
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00BC7D]/15 blur-[110px]" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:32px_32px]" />
    </div>

    <div className="relative flex w-full max-w-xs flex-col items-center text-center animate-[fade-in_.45s_ease-out]">
      <div className="relative">
        <div className="absolute inset-[-1.25rem] rounded-[2rem] bg-[#00BC7D]/20 blur-2xl animate-pulse" />
        <img src="/icons/qpos-logo.svg" alt="QPOS" className="relative h-24 w-24 object-contain sm:h-28 sm:w-28" />
      </div>
      <h1 className="mt-7 text-3xl font-black tracking-[-0.05em] sm:text-4xl">QPOS</h1>
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#00BC7D]">A product of Neospec</p>
      <div className="mt-12 h-1 w-36 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 rounded-full bg-[#00BC7D] animate-[splash-progress_.9s_ease-in-out_infinite]" />
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Preparing your workspace</p>
    </div>
  </div>
);
