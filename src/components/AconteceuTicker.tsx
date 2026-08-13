import React, { useEffect, useState } from 'react';
import { History, CalendarDays, AlertTriangle, ArrowRight } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';

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
  category: 'evento' | 'aviso' | string;
  imageUrl?: string;
  _displayDate?: any;
  [key: string]: any;
}

function TickerCard({ item, onSelect, dupe }: { item: AconteceuTickerItem; onSelect: (item: any) => void; dupe?: boolean }) {
  return (
    <button
      type="button"
      tabIndex={dupe ? -1 : 0}
      aria-hidden={dupe ? true : undefined}
      onClick={() => onSelect(item)}
      className="flex items-center gap-3 pr-4 pl-3 py-2 rounded-lg border border-stone-100 bg-stone-50 hover:border-stone-300 hover:bg-white transition-all shrink-0 text-left group/card"
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
      ) : (
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          item.category === 'evento' ? "bg-terracota-100 text-primary" : "bg-rose-100 text-rose-700"
        )}>
          {item.category === 'evento' ? <CalendarDays size={18} /> : <AlertTriangle size={18} />}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-overline font-bold uppercase tracking-widest",
            item.category === 'evento' ? "text-primary" : "text-rose-700"
          )}>
            {item.category === 'evento' ? 'Evento' : 'Aviso'}
          </span>
          <span className="text-stone-300">·</span>
          <span className="text-overline font-bold uppercase tracking-widest text-stone-400">{relativeLabel(item._displayDate)}</span>
        </div>
        <p className="text-sm font-bold text-stone-900 truncate max-w-[180px] group-hover/card:text-primary transition-colors">{item.title}</p>
      </div>
      <ArrowRight size={14} className="text-stone-300 group-hover/card:text-primary group-hover/card:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

export function AconteceuTicker({ items, onSelect }: { items: AconteceuTickerItem[]; onSelect: (item: any) => void }) {
  const reducedMotion = useReducedMotion();

  if (!items || items.length === 0) return null;

  const duration = Math.max(items.length * 6, 18);

  return (
    <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="flex items-center gap-2 px-3 sm:px-4 pt-3 sm:py-0 bg-stone-50 sm:border-r border-stone-100 shrink-0">
          <History size={16} className="text-primary" />
          <span className="text-sm font-sans font-semibold text-stone-900 whitespace-nowrap">Aconteceu</span>
        </div>

        <div
          className="aconteceu-ticker-viewport relative overflow-hidden py-3 px-3 flex-1 min-w-0"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
            maskImage: 'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
          }}
        >
          {reducedMotion ? (
            <div className="flex items-stretch gap-3 overflow-x-auto custom-scrollbar">
              {items.map((item, idx) => (
                <TickerCard key={item.id || idx} item={item} onSelect={onSelect} />
              ))}
            </div>
          ) : (
            <div
              className="aconteceu-ticker-track flex items-stretch gap-3 w-max"
              style={{ ['--ticker-duration' as any]: `${duration}s` }}
            >
              {items.map((item, idx) => (
                <TickerCard key={`a-${item.id || idx}`} item={item} onSelect={onSelect} />
              ))}
              {items.map((item, idx) => (
                <TickerCard key={`b-${item.id || idx}`} item={item} onSelect={onSelect} dupe />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
