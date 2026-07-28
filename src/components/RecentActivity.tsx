import React, { useEffect, useState } from 'react';
import { Check, Star, UserPlus, CheckCircle2, CalendarDays, Repeat, Gift, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';

const TYPE_META: Record<string, { icon: any; bg: string; fg: string }> = {
  checkin:            { icon: Check,        bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  streak_bonus:       { icon: Star,         bg: 'bg-amber-100',   fg: 'text-amber-600' },
  indicacao_criada:   { icon: UserPlus,     bg: 'bg-blue-100',    fg: 'text-blue-600' },
  indicacao_aprovada: { icon: CheckCircle2, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  evento_checkin:     { icon: CalendarDays, bg: 'bg-violet-100',  fg: 'text-violet-600' },
  qcoin_request:      { icon: Repeat,       bg: 'bg-primary/10',  fg: 'text-primary' },
  lancamento_manual:  { icon: Gift,         bg: 'bg-primary/10',  fg: 'text-primary' },
};

const PAGE_SIZE = 4;

function relativeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  return `${diffDays} dias atrás`;
}

function currentYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function RecentActivity({ userId, title = 'Atividade Recente' }: { userId: string | null | undefined; title?: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) { setActivities([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setExpanded(false);
    api.get('/api/activities', { params: { userId, month: currentYm() } })
      .then(res => { if (!cancelled) setActivities(res.data.map((a: any) => ({ ...a, id: a._id || a.id }))); })
      .catch(() => { if (!cancelled) setActivities([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    const onActivity = (payload: any) => {
      if (payload?.userId !== userId) return;
      api.get('/api/activities', { params: { userId, month: currentYm() } })
        .then(res => setActivities(res.data.map((a: any) => ({ ...a, id: a._id || a.id }))))
        .catch(() => {});
    };
    socket.on('activity:new', onActivity);
    return () => { socket.off('activity:new', onActivity); };
  }, [userId]);

  const visible = expanded ? activities : activities.slice(0, PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5">
      <div className="flex items-center gap-1.5 mb-4">
        <Clock size={11} className="text-stone-400" />
        <span className="text-overline font-bold uppercase tracking-widest text-stone-400">{title}</span>
      </div>
      {loading ? (
        <p className="text-xs text-stone-400 leading-relaxed">Carregando...</p>
      ) : activities.length === 0 ? (
        <p className="text-xs text-stone-400 leading-relaxed">Nenhuma atividade recente registrada.</p>
      ) : (
        <>
          <div className="space-y-3">
            {visible.map((a: any) => {
              const meta = TYPE_META[a.tipo] || TYPE_META.checkin;
              const Icon = meta.icon;
              return (
                <div key={a.id} className="flex items-start gap-2.5">
                  <div className={`w-4 h-4 rounded-full ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon size={9} className={meta.fg} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-stone-400">{relativeLabel(a.criadoEm)}</p>
                      <p className="text-xs font-medium text-stone-700 truncate">{a.descricao}</p>
                    </div>
                    <span className="text-xs font-bold text-primary shrink-0">+{a.pontos}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {activities.length > PAGE_SIZE && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-900 transition-colors pt-3 border-t border-stone-50"
            >
              {expanded ? (<>Ver menos<ChevronUp size={13} /></>) : (<>Ver mais ({activities.length - PAGE_SIZE})<ChevronDown size={13} /></>)}
            </button>
          )}
        </>
      )}
    </div>
  );
}
