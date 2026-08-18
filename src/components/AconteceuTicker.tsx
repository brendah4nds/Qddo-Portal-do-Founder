import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, CalendarDays, AlertTriangle, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';

const CARD_STEP = 222; // largura do card (210px) + gap (12px)
const AUTOPLAY_SPEED = 30; // px/s

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v?.seconds) return new Date(v.seconds * 1000);
  if (v?.toDate) return v.toDate();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function relativeLabel(v: any): string {
  const d = toDate(v);
  if (!d) return '';
  const diffDays = differenceInCalendarDays(new Date(), d);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  const weeks = Math.round(diffDays / 7);
  if (diffDays < 30) return weeks <= 1 ? 'Há 1 semana' : `Há ${weeks} semanas`;
  const months = Math.round(diffDays / 30);
  return months <= 1 ? 'Há 1 mês' : `Há ${months} meses`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return reduced;
}

interface AconteceuTickerItem {
  id?: string;
  title: string;
  content?: string;
  category: 'evento' | 'aviso' | string;
  imageUrl?: string;
  _displayDate?: any;
  [key: string]: any;
}

function TickerCard({ item, onSelect, dupe }: { item: AconteceuTickerItem; onSelect: (item: any) => void; dupe?: boolean }) {
  const isEvento = item.category === 'evento';
  return (
    <button
      type="button"
      tabIndex={dupe ? -1 : 0}
      aria-hidden={dupe ? true : undefined}
      onClick={() => onSelect(item)}
      className="flex flex-col shrink-0 w-[210px] h-[248px] rounded-lg border border-stone-100 bg-stone-50 hover:border-stone-300 hover:bg-white transition-all overflow-hidden text-left group/card"
    >
      <div className="h-24 w-full shrink-0 relative bg-stone-100">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={cn(
            "w-full h-full flex items-center justify-center",
            isEvento ? "bg-terracota-100 text-primary" : "bg-rose-100 text-rose-700"
          )}>
            {isEvento ? <CalendarDays size={28} /> : <AlertTriangle size={28} />}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 p-3 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={cn(
            "text-overline font-bold uppercase tracking-widest",
            isEvento ? "text-primary" : "text-rose-700"
          )}>
            {isEvento ? 'Evento' : 'Aviso'}
          </span>
          <span className="text-stone-300">·</span>
          <span className="text-overline font-bold uppercase tracking-widest text-stone-400">{relativeLabel(item._displayDate)}</span>
        </div>
        <h5 className="font-bold text-stone-900 text-sm line-clamp-2 mb-1 group-hover/card:text-primary transition-colors">{item.title}</h5>
        {item.content && (
          <p className="text-stone-500 text-xs line-clamp-2 flex-1" dangerouslySetInnerHTML={{ __html: item.content }} />
        )}
        <span className="mt-auto pt-1 text-overline font-bold uppercase tracking-widest text-stone-400 group-hover/card:text-primary transition-colors flex items-center gap-1">
          Ver mais
          <ArrowRight size={11} className="group-hover/card:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </button>
  );
}

export function AconteceuTicker({ items, onSelect }: { items: AconteceuTickerItem[]; onSelect: (item: any) => void }) {
  const reducedMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reducedMotion || paused || !items || items.length === 0) return;
    const el = viewportRef.current;
    if (!el) return;

    let rafId: number;
    let lastTime: number | null = null;

    const step = (time: number) => {
      if (lastTime === null) lastTime = time;
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      el.scrollLeft += AUTOPLAY_SPEED * dt;
      const half = el.scrollWidth / 2;
      if (half > 0 && el.scrollLeft >= half) {
        el.scrollLeft -= half;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [reducedMotion, paused, items]);

  const scrollByStep = useCallback((direction: 1 | -1) => {
    viewportRef.current?.scrollBy({ left: direction * CARD_STEP, behavior: 'smooth' });
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl px-3 py-4 border border-stone-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <History className="text-primary shrink-0" size={18} />
        <h4 className="text-sm font-sans font-semibold text-stone-900">Aconteceu</h4>
        <span className="ml-auto text-overline font-bold uppercase tracking-widest text-stone-400">
          {`Últimos ${items.length}`}
        </span>
      </div>

      <div
        className="relative group/ticker"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <button
          type="button"
          onClick={() => scrollByStep(-1)}
          aria-label="Ver eventos anteriores"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/3 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white border border-stone-200 shadow-sm text-stone-600 opacity-0 group-hover/ticker:opacity-100 focus-visible:opacity-100 hover:text-primary hover:border-stone-300 transition-opacity"
        >
          <ChevronLeft size={16} />
        </button>

        <div
          ref={viewportRef}
          className="aconteceu-ticker-viewport relative overflow-x-auto no-scrollbar"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
            maskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
          }}
        >
          <div className="flex items-stretch gap-3 w-max pb-1">
            {items.map((item, idx) => (
              <TickerCard key={`a-${item.id || idx}`} item={item} onSelect={onSelect} />
            ))}
            {!reducedMotion && items.map((item, idx) => (
              <TickerCard key={`b-${item.id || idx}`} item={item} onSelect={onSelect} dupe />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollByStep(1)}
          aria-label="Ver eventos seguintes"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white border border-stone-200 shadow-sm text-stone-600 opacity-0 group-hover/ticker:opacity-100 focus-visible:opacity-100 hover:text-primary hover:border-stone-300 transition-opacity"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
