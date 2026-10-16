import React, {FormEvent, useEffect, useId, useRef, useState} from 'react';
import {ArrowRight, Send, X} from 'lucide-react';
import {findHomepageFaqAnswer, homepageFaqEntries, unknownHomepageFaqAnswer} from '../lib/homepageFaq';

type Message = {id: number; from: 'assistant' | 'user'; text: string; source?: 'assistant' | 'local'};
type Props = {onGetStarted: () => void};

const welcome = 'Hi! I can answer questions about QPOS features, pricing, the 20-day free trial, proposals, inventory, restaurants and reports.';

export const HomepageFaqChat: React.FC<Props> = ({onGetStarted}) => {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{id: 1, from: 'assistant', text: welcome}]);
  const [answering, setAnswering] = useState(false);
  const nextId = useRef(2);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open, isMobile]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({top: transcriptRef.current.scrollHeight, behavior: 'smooth'});
  }, [messages]);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  };

  const ask = async (question: string) => {
    const clean = question.trim();
    if (!clean || answering) return;
    const userMessage = {id: nextId.current++, from: 'user' as const, text: clean};
    setMessages(current => [...current, userMessage]);
    setInput('');
    setAnswering(true);
    let responseMessage: Message;
    try {
      const response = await fetch('/api/faq-assistant', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question: clean}),
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.answer !== 'string' || !payload.answer.trim()) throw new Error('Assistant unavailable');
      responseMessage = {id: nextId.current++, from: 'assistant', text: payload.answer.trim(), source: 'assistant'};
    } catch {
      const local = findHomepageFaqAnswer(clean);
      responseMessage = {id: nextId.current++, from: 'assistant', text: local?.answer ?? unknownHomepageFaqAnswer, source: 'local'};
    }
    setMessages(current => [...current, responseMessage]);
    setAnswering(false);
  };

  const submit = (event: FormEvent) => {event.preventDefault(); ask(input);};

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab' || !isMobile) return;
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
    ) as HTMLElement[];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <aside aria-label="QPOS FAQ assistant">
    {open && <button type="button" aria-label="Close QPOS assistant backdrop" onClick={close} className="fixed inset-0 z-[119] bg-black/65 backdrop-blur-[2px] sm:hidden"/>}
    {open && <section ref={panelRef} id={panelId} role="dialog" aria-modal={isMobile} aria-labelledby={`${panelId}-title`} onKeyDown={handlePanelKeyDown} className="fixed inset-x-3 bottom-24 z-[120] flex max-h-[min(30rem,calc(100vh-7rem))] flex-col overflow-hidden border border-[#ffb900]/25 bg-[#090b0f] shadow-[0_30px_100px_rgba(0,0,0,.72)] sm:inset-x-auto sm:right-6 sm:max-h-[min(36rem,calc(100vh-7rem))] sm:w-[24rem]">
      <header className="flex items-center justify-between border-b border-[#ffb900]/15 bg-[#0d1015] px-4 py-3.5">
        <div className="flex items-center gap-3"><img src="/icons/qpos-marketing-logo.svg" alt="" aria-hidden="true" className="h-9 w-9 shrink-0"/><div><h2 id={`${panelId}-title`} className="text-sm font-extrabold">Ask QPOS</h2><p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#ffb900]">QPOS product assistant</p></div></div>
        <button type="button" onClick={close} aria-label="Close QPOS assistant" className="grid h-9 w-9 place-items-center text-white/55 hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb900]"><X className="h-4 w-4"/></button>
      </header>
      <div ref={transcriptRef} aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map(message => <div key={message.id} className={`flex ${message.from==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[88%] px-3.5 py-3 text-xs leading-5 ${message.from==='user'?'bg-[#ffb900] font-semibold text-[#08090b]':'border border-white/[.09] bg-white/[.04] text-white/75'}`}><p>{message.text}</p>{message.source==='local'&&<span className="mt-1.5 block text-[9px] font-semibold text-white/45">Local answer · assistant unavailable</span>}</div></div>)}
        {answering&&<div className="flex justify-start" role="status"><p className="rounded-2xl rounded-bl-md border border-white/[.08] bg-white/[.04] px-3.5 py-3 text-xs text-white/50">Checking QPOS information…</p></div>}
        {messages.length === 1 && <div className="pt-1"><p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-white/45">Suggested questions</p><div className="flex flex-wrap gap-2">{homepageFaqEntries.slice(0,4).map(entry => <button key={entry.id} type="button" onClick={()=>ask(entry.question)} className="border border-[#ffb900]/25 bg-[#ffb900]/[.05] px-3 py-2 text-left text-[10px] font-bold leading-4 text-[#ffb900] hover:bg-[#ffb900]/[.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb900]">{entry.question}</button>)}</div></div>}
      </div>
      <div className="border-t border-white/[.08] p-3"><form onSubmit={submit} className="flex gap-2"><label htmlFor={`${panelId}-input`} className="sr-only">Ask a question about QPOS</label><input ref={inputRef} id={`${panelId}-input`} value={input} onChange={event=>setInput(event.target.value)} maxLength={180} disabled={answering} placeholder="Ask about pricing, GST, inventory…" className="min-w-0 flex-1 border border-white/10 bg-white/[.04] px-3.5 py-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-[#ffb900]/50 focus:ring-2 focus:ring-[#ffb900]/15 disabled:opacity-60"/><button type="submit" disabled={answering||!input.trim()} aria-label="Send question" className="grid h-10 w-10 shrink-0 place-items-center bg-[#ffb900] text-[#08090b] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Send className="h-4 w-4"/></button></form><div className="mt-2 flex items-center justify-between"><a href="https://neospec.co.in" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-white/45 hover:text-white">Contact Neospec</a><button type="button" onClick={onGetStarted} className="flex items-center gap-1 text-[10px] font-black text-[#ffb900] hover:text-[#ffc933]">Start free trial <ArrowRight className="h-3 w-3"/></button></div></div>
    </section>}
    <button ref={launcherRef} type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls={panelId} aria-label={open?'Close QPOS FAQ assistant':'Open QPOS FAQ assistant'} title="Ask QPOS" className={`fixed bottom-3 right-3 z-[121] h-12 w-12 items-center justify-center bg-[#ffb900] p-0 font-black text-[#08090b] shadow-[0_14px_38px_rgba(255,185,0,.2)] transition hover:-translate-y-1 hover:bg-[#ffc933] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:bottom-5 sm:right-6 sm:h-14 sm:w-auto sm:gap-2 sm:px-3 ${open?'hidden sm:flex':'flex'}`}><img src="/icons/qpos-marketing-logo.svg" alt="" aria-hidden="true" className="h-7 w-7 shrink-0"/><span className="hidden text-xs uppercase tracking-wide sm:inline">Ask QPOS</span></button>
  </aside>;
};
