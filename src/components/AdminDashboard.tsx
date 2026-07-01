import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Users, CheckSquare, Trophy,
  AlertTriangle, Zap, Activity, ChevronUp, ChevronDown,
  Minus, Flame, BarChart2, Award, History
} from 'lucide-react';
import { format, subDays, startOfDay, startOfMonth, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Founder, Challenge } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | 'all';
type SortKey = 'name' | 'healthScore' | 'streak' | 'checkins' | 'monthCheckins' | 'churnRisk' | 'momentum';
type SortDir = 'asc' | 'desc';
type InsightSeverity = 'critical' | 'warning' | 'positive' | 'predictive';
type Tier = 'S' | 'A' | 'B' | 'C';

interface FounderMetric {
  founder: Founder;
  healthScore: number;
  tier: Tier;
  streak: number;
  periodCheckins: number;
  prevPeriodCheckins: number;
  challengesCreated: number;
  challengesCompleted: number;
  churnRisk: number;
  daysSinceLastActivity: number;
  lastActivity: Date | null;
  momentum: number;
  consistencyRate: number;
  weeklyCheckins: number[];
  monthCheckins: number;
}

interface Insight {
  severity: InsightSeverity;
  title: string;
  body: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const cn = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return null;
}

// Checkins usam `checkinTime` como timestamp principal (igual ao App.tsx).
// Fallback para `date` (string 'yyyy-MM-dd') e depois `createdAt`.
function checkinDate(c: any): Date | null {
  return toDate(c.checkinTime) ?? toDate(c.date) ?? toDate(c.createdAt);
}

function gini(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (2 * (i + 1) - n - 1) * sorted[i];
  return sum / (n * n * mean);
}

function computeStreak(checkins: any[], founderId: string, now: Date): number {
  const days = new Set(
    checkins
      .filter(c => c.userId === founderId)
      .map(c => {
        // prefer c.date (already 'yyyy-MM-dd') to avoid re-parsing
        if (c.date && typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date)) return c.date;
        const d = checkinDate(c); return d ? format(d, 'yyyy-MM-dd') : null;
      })
      .filter(Boolean) as string[]
  );
  let streak = 0;
  let cursor = new Date(now);
  while (true) {
    if (days.has(format(cursor, 'yyyy-MM-dd'))) { streak++; cursor = subDays(cursor, 1); }
    else break;
  }
  return streak;
}

function churnRiskScore(daysSince: number, streak: number): number {
  if (daysSince === 0) return Math.max(2, 8 - streak * 1.5);
  if (daysSince <= 2) return 8 + daysSince * 4;
  if (daysSince <= 7) return 16 + (daysSince - 2) * 9;
  if (daysSince <= 14) return 61 + (daysSince - 7) * 3;
  if (daysSince <= 21) return 82 + (daysSince - 14) * 1.5;
  return Math.min(96, 92 + (daysSince - 21) * 0.2);
}

function tierFromScore(s: number): Tier {
  if (s >= 80) return 'S';
  if (s >= 60) return 'A';
  if (s >= 35) return 'B';
  return 'C';
}

const TIER_COLOR: Record<Tier, string> = {
  S: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  A: 'bg-blue-100 text-blue-700 ring-blue-200',
  B: 'bg-amber-100 text-amber-700 ring-amber-200',
  C: 'bg-red-100 text-red-700 ring-red-200',
};

// ─── Metric Computation ───────────────────────────────────────────────────────

function computeAll(
  founders: Founder[],
  checkins: any[],
  challenges: Challenge[],
  period: Period
) {
  const now = new Date();
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 9999;
  const periodStart = startOfDay(period === 'all' ? new Date(0) : subDays(now, periodDays));
  const prevStart = startOfDay(period === 'all' ? new Date(0) : subDays(now, periodDays * 2));
  const currentMonthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subDays(currentMonthStart, 1));

  const founderMetrics: FounderMetric[] = founders.map(founder => {
    const fid = founder.id;
    const fCheckins = checkins.filter(c => c.userId === fid);

    const periodCheckins = fCheckins.filter(c => {
      const d = checkinDate(c); return d && d >= periodStart;
    }).length;
    const prevPeriodCheckins = fCheckins.filter(c => {
      const d = checkinDate(c); return d && d >= prevStart && d < periodStart;
    }).length;

    const fChallenges = challenges.filter(c => c.founderId === fid);
    const periodCreated = fChallenges.filter(c => { const d = toDate(c.createdAt); return d && d >= periodStart; }).length;
    const periodCompleted = fChallenges.filter(c => {
      const d = toDate(c.completedAt ?? c.createdAt);
      return c.status === 'completed' && d && d >= periodStart;
    }).length;

    const actDates = fCheckins.map(c => checkinDate(c)).filter(Boolean) as Date[];
    const lastActivity = actDates.length ? new Date(Math.max(...actDates.map(d => d.getTime()))) : null;
    const daysSince = lastActivity ? differenceInDays(now, lastActivity) : 999;
    const streak = computeStreak(checkins, fid, now);

    const activeDays = Math.max(1, periodDays);
    const consistencyRate = Math.min(100, (periodCheckins / activeDays) * 100);

    const streakScore = Math.min(100, (streak / Math.min(21, activeDays)) * 100);
    const recencyScore = Math.max(0, 100 - daysSince * 7);
    const challengeScore = Math.min(100, periodCreated * 12 + periodCompleted * 18);
    const qcoinScore = Math.min(100, ((founder.totalPoints ?? 0) / 500) * 100);
    const healthScore = Math.round(
      streakScore * 0.25 + consistencyRate * 0.30 + challengeScore * 0.20 + recencyScore * 0.15 + qcoinScore * 0.10
    );

    const momentum = prevPeriodCheckins > 0
      ? Math.round(((periodCheckins - prevPeriodCheckins) / prevPeriodCheckins) * 100)
      : periodCheckins > 0 ? 100 : 0;

    const weeklyCheckins: number[] = [];
    for (let w = 3; w >= 0; w--) {
      const wStart = startOfDay(subDays(now, (w + 1) * 7));
      const wEnd = startOfDay(subDays(now, w * 7));
      weeklyCheckins.push(fCheckins.filter(c => { const d = checkinDate(c); return d && d >= wStart && d < wEnd; }).length);
    }

    const monthCheckins = fCheckins.filter(c => {
      const d = checkinDate(c); return d && d >= currentMonthStart;
    }).length;

    return {
      founder, healthScore, tier: tierFromScore(healthScore), streak,
      periodCheckins, prevPeriodCheckins, challengesCreated: periodCreated,
      challengesCompleted: periodCompleted,
      churnRisk: Math.round(churnRiskScore(daysSince, streak)),
      daysSinceLastActivity: daysSince, lastActivity, momentum,
      consistencyRate: Math.round(consistencyRate), weeklyCheckins, monthCheckins,
    };
  });

  const totalActive = founderMetrics.filter(m => m.periodCheckins > 0).length;
  const totalCheckins = founderMetrics.reduce((s, m) => s + m.periodCheckins, 0);
  const prevTotalCheckins = founderMetrics.reduce((s, m) => s + m.prevPeriodCheckins, 0);
  const totalCreated = founderMetrics.reduce((s, m) => s + m.challengesCreated, 0);
  const totalCompleted = founderMetrics.reduce((s, m) => s + m.challengesCompleted, 0);
  const completionRate = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;
  const avgStreak = founders.length ? founderMetrics.reduce((s, m) => s + m.streak, 0) / founders.length : 0;
  const giniIndex = gini(founderMetrics.map(m => m.periodCheckins));
  const prevTotalActive = founderMetrics.filter(m => m.prevPeriodCheckins > 0).length;

  const retentionScore = founders.length ? (totalActive / founders.length) * 100 : 0;
  const velocityScore = Math.min(100, founders.length > 0 ? (totalCheckins / founders.length) * 5 : 0);
  const streakScore = Math.min(100, (avgStreak / 21) * 100);
  const distributionScore = (1 - giniIndex) * 100;
  const chs = Math.round(
    retentionScore * 0.35 + velocityScore * 0.25 + completionRate * 0.20 + streakScore * 0.15 + distributionScore * 0.05
  );

  const checkinDelta = prevTotalCheckins > 0
    ? Math.round(((totalCheckins - prevTotalCheckins) / prevTotalCheckins) * 100)
    : totalCheckins > 0 ? 100 : 0;
  const activeDelta = prevTotalActive > 0
    ? Math.round(((totalActive - prevTotalActive) / prevTotalActive) * 100) : 0;

  const velocityTrend: number[] = [];
  for (let w = 7; w >= 0; w--) {
    const wStart = startOfDay(subDays(now, (w + 1) * 7));
    const wEnd = startOfDay(subDays(now, w * 7));
    velocityTrend.push(checkins.filter(c => { const d = checkinDate(c); return d && d >= wStart && d < wEnd; }).length);
  }

  const totalMonthCheckins = founderMetrics.reduce((s, m) => s + m.monthCheckins, 0);
  const prevMonthCheckins = checkins.filter(c => {
    const d = checkinDate(c); return d && d >= prevMonthStart && d < currentMonthStart;
  }).length;
  const monthCheckinsDelta = prevMonthCheckins > 0
    ? Math.round(((totalMonthCheckins - prevMonthCheckins) / prevMonthCheckins) * 100)
    : totalMonthCheckins > 0 ? 100 : 0;

  const insights: Insight[] = generateInsights({
    founderMetrics, chs, checkinDelta, activeDelta,
    completionRate, giniIndex, totalCheckins, prevTotalCheckins,
  });

  return {
    founderMetrics, chs, checkinDelta, activeDelta, totalCheckins,
    prevTotalCheckins, totalActive, completionRate,
    avgStreak: Math.round(avgStreak), giniIndex, velocityTrend, insights,
    atRiskCount: founderMetrics.filter(m => m.churnRisk > 60).length,
    championsCount: founderMetrics.filter(m => m.tier === 'S').length,
    totalMonthCheckins, monthCheckinsDelta,
    currentMonthLabel: format(now, 'MMM', { locale: ptBR }),
  };
}

function generateInsights(data: {
  founderMetrics: FounderMetric[]; chs: number; checkinDelta: number; activeDelta: number;
  completionRate: number; giniIndex: number; totalCheckins: number; prevTotalCheckins: number;
}): Insight[] {
  const { founderMetrics } = data;
  const insights: Insight[] = [];

  const critical = founderMetrics.filter(m => m.churnRisk > 65 && m.daysSinceLastActivity > 0);
  if (critical.length > 0) {
    const names = critical.slice(0, 2).map(m => m.founder.name?.split(' ')[0]).join(', ');
    insights.push({
      severity: 'critical', title: 'Risco de abandono',
      body: critical.length === 1
        ? `${names} está há ${critical[0].daysSinceLastActivity} dias sem atividade.`
        : `${critical.length} founders em risco crítico: ${names}${critical.length > 2 ? ` +${critical.length - 2}` : ''}.`,
    });
  }

  if (data.checkinDelta <= -20) {
    insights.push({
      severity: 'warning', title: 'Queda de engajamento',
      body: `Check-ins caíram ${Math.abs(data.checkinDelta)}% em relação ao período anterior. Avaliar contexto externo.`,
    });
  }

  if (data.giniIndex > 0.5 && data.totalCheckins > 0) {
    const top3 = [...founderMetrics].sort((a, b) => b.periodCheckins - a.periodCheckins).slice(0, 3);
    const topShare = Math.round((top3.reduce((s, m) => s + m.periodCheckins, 0) / data.totalCheckins) * 100);
    insights.push({
      severity: 'warning', title: 'Engajamento concentrado',
      body: `${topShare}% dos check-ins estão em apenas 3 founders. Ampliar a base ativa reduz risco de dependência.`,
    });
  }

  if (data.completionRate < 30 && founderMetrics.some(m => m.challengesCreated > 0)) {
    insights.push({
      severity: 'warning', title: 'Baixa conclusão de desafios',
      body: `Taxa de conclusão em ${data.completionRate}%. Desafios abertos acumulam sem resolução visível.`,
    });
  }

  const bestStreak = founderMetrics.reduce(
    (best, m) => (m.streak > best.streak ? m : best),
    founderMetrics[0] ?? ({ streak: 0, founder: { name: '' } as Founder } as FounderMetric)
  );
  if (bestStreak && bestStreak.streak >= 5) {
    insights.push({
      severity: 'positive', title: 'Melhor streak ativo',
      body: `${bestStreak.founder.name?.split(' ')[0]} em sequência de ${bestStreak.streak} dias consecutivos — maior streak da comunidade.`,
    });
  }

  if (data.checkinDelta >= 20) {
    insights.push({
      severity: 'positive', title: 'Crescimento de engajamento',
      body: `Check-ins cresceram ${data.checkinDelta}% em relação ao período anterior. Comunidade em aceleração.`,
    });
  }

  const recovering = founderMetrics.filter(m => m.momentum > 40 && m.prevPeriodCheckins < m.periodCheckins / 2 && m.prevPeriodCheckins > 0);
  if (recovering.length > 0) {
    insights.push({
      severity: 'positive', title: 'Founder em recuperação',
      body: `${recovering[0].founder.name?.split(' ')[0]} voltou com ${recovering[0].periodCheckins} check-ins após período de baixo engajamento.`,
    });
  }

  const borderline = founderMetrics.filter(m => m.churnRisk > 40 && m.churnRisk <= 65);
  if (borderline.length >= 2) {
    insights.push({
      severity: 'predictive', title: 'Risco emergente',
      body: `${borderline.length} founders em zona amarela. Intervenção agora pode prevenir abandono nas próximas 2 semanas.`,
    });
  }

  return insights.slice(0, 5).sort((a, b) => {
    const p: Record<InsightSeverity, number> = { critical: 0, warning: 1, predictive: 2, positive: 3 };
    return p[a.severity] - p[b.severity];
  });
}

// ─── Canvas: Health Ring ──────────────────────────────────────────────────────

function HealthRing({ score, size = 148 }: { score: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);
    const cx = size / 2, cy = size / 2, R = size * 0.38, lw = size * 0.075;
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#E7E5E4';
    ctx.lineWidth = lw;
    ctx.stroke();
    const endAngle = ((score / 100) * Math.PI * 2) - Math.PI / 2;
    const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    if (score < 40) { grad.addColorStop(0, '#EF4444'); grad.addColorStop(1, '#F97316'); }
    else if (score < 65) { grad.addColorStop(0, '#F97316'); grad.addColorStop(1, '#FBBF24'); }
    else if (score < 80) { grad.addColorStop(0, '#FBBF24'); grad.addColorStop(1, '#34D399'); }
    else { grad.addColorStop(0, '#34D399'); grad.addColorStop(1, '#10B981'); }
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, endAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.fillStyle = '#1C1917';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${size * 0.24}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(String(score), cx, cy - size * 0.05);
    ctx.fillStyle = '#78716C';
    ctx.font = `600 ${size * 0.09}px -apple-system, system-ui, sans-serif`;
    ctx.fillText('HEALTH SCORE', cx, cy + size * 0.14);
  }, [score, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

// ─── Canvas: Sparkline ────────────────────────────────────────────────────────

function Sparkline({ data, w = 52, h = 20 }: { data: number[]; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    if (!data.length) return;
    const max = Math.max(...data, 1);
    const bw = w / data.length;
    data.forEach((v, i) => {
      const bh = Math.max(2, (v / max) * h);
      ctx.fillStyle = v > 0 ? '#C4A882' : '#E7E5E4';
      ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
    });
  }, [data, w, h]);
  return <canvas ref={ref} style={{ width: w, height: h }} />;
}

// ─── Canvas: Velocity Chart ───────────────────────────────────────────────────

function VelocityChart({ data, labels }: { data: number[]; labels: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 480, H = 96;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const pad = { t: 12, b: 24, l: 4, r: 4 };
    const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
    const max = Math.max(...data, 1);
    const step = iW / (data.length - 1);
    ctx.strokeStyle = '#F5F5F4'; ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(frac => {
      ctx.beginPath();
      ctx.moveTo(pad.l, pad.t + iH - frac * iH);
      ctx.lineTo(W - pad.r, pad.t + iH - frac * iH);
      ctx.stroke();
    });
    const pts = data.map((v, i) => ({ x: pad.l + i * step, y: pad.t + iH - (v / max) * iH }));
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + iH);
    grad.addColorStop(0, 'rgba(196,168,130,0.25)');
    grad.addColorStop(1, 'rgba(196,168,130,0)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(mx, pts[i - 1].y, mx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, pad.t + iH);
    ctx.lineTo(pts[0].x, pad.t + iH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(mx, pts[i - 1].y, mx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = '#C4A882'; ctx.lineWidth = 2; ctx.stroke();
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#C4A882'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    ctx.fillStyle = '#A8A29E';
    ctx.font = `500 9px -apple-system, system-ui`;
    ctx.textAlign = 'center';
    labels.forEach((l, i) => ctx.fillText(l, pad.l + i * step, H - 6));
  }, [data, labels]);
  return <canvas ref={ref} style={{ width: '100%', height: 96, display: 'block' }} />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-stone-400 text-xs flex items-center gap-0.5"><Minus size={11} />0%</span>;
  return (
    <span className={cn('text-xs flex items-center gap-0.5 font-medium', value > 0 ? 'text-emerald-600' : 'text-red-500')}>
      {value > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {value > 0 ? '+' : ''}{value}%
    </span>
  );
}

function KPICard({ label, value, sub, delta, icon: Icon }: {
  label: string; value: string | number; sub?: string;
  delta?: number; icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-stone-100 bg-white p-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-overline font-bold uppercase tracking-widest text-stone-400">{label}</span>
        {Icon && <Icon size={14} className="text-stone-300" />}
      </div>
      <div>
        <span className="text-h2 font-black tabular-nums text-stone-900">{value}</span>
        {sub && <span className="text-sm ml-1.5 text-stone-400">{sub}</span>}
      </div>
      {delta !== undefined && <Delta value={delta} />}
    </div>
  );
}

const INSIGHT_META: Record<InsightSeverity, { bar: string; Icon: React.ElementType; label: string }> = {
  critical: { bar: 'bg-red-500', Icon: AlertTriangle, label: 'Crítico' },
  warning: { bar: 'bg-amber-400', Icon: AlertTriangle, label: 'Atenção' },
  predictive: { bar: 'bg-blue-400', Icon: Zap, label: 'Previsão' },
  positive: { bar: 'bg-emerald-400', Icon: TrendingUp, label: 'Positivo' },
};

function InsightCard({ insight }: { insight: Insight }) {
  const { bar, Icon, label } = INSIGHT_META[insight.severity];
  return (
    <div className="bg-white border border-stone-100 rounded-xl p-4 flex gap-3 hover:bg-primary/5 hover:border-primary/20 transition-colors">
      <div className={cn('w-1 rounded-full flex-shrink-0 self-stretch', bar)} />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-stone-400 flex-shrink-0" />
          <span className="text-overline font-bold uppercase tracking-widest text-stone-400">{label}</span>
        </div>
        <p className="text-sm font-semibold text-stone-800 leading-snug">{insight.title}</p>
        <p className="text-sm text-stone-500 leading-relaxed">{insight.body}</p>
      </div>
    </div>
  );
}

function Avatar({ founder, size = 28 }: { founder: Founder; size?: number }) {
  const initial = (founder.name ?? '?').charAt(0).toUpperCase();
  return founder.photoURL ? (
    <img src={founder.photoURL} alt={founder.name} referrerPolicy="no-referrer"
      style={{ width: size, height: size }} className="rounded-full object-cover flex-shrink-0 bg-stone-100" />
  ) : (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-bold text-xs">
      {initial}
    </div>
  );
}

function SortTh({ label, col, current, dir, onSort }: {
  label: string; col: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = current === col;
  return (
    <th className="px-3 py-2.5 text-left cursor-pointer select-none group" onClick={() => onSort(col)}>
      <div className="flex items-center gap-1">
        <span className={cn('text-overline font-bold uppercase tracking-widest transition-colors', active ? 'text-stone-800' : 'text-stone-400 group-hover:text-stone-600')}>
          {label}
        </span>
        {active
          ? dir === 'desc' ? <ChevronDown size={11} className="text-stone-600" /> : <ChevronUp size={11} className="text-stone-600" />
          : <Minus size={11} className="text-stone-300" />}
      </div>
    </th>
  );
}

// ─── Monthly Points History ───────────────────────────────────────────────────

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return format(new Date(y, m - 1, 1), "MMM'/'yy", { locale: ptBR });
}

function PointsHistory({ founders }: { founders: Founder[] }) {
  const [expanded, setExpanded] = useState(true);
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allMonths = Array.from(
    new Set(
      founders.flatMap(f => Object.keys((f as any).monthlyPoints ?? {}))
    )
  ).sort().reverse();

  const [sortKey, setSortKey] = useState<string>(currentYM);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const HISTORY_PAGE = 10;

  if (allMonths.length === 0) return null;

  const sorted = [...founders].sort((a, b) => {
    if (sortKey === 'total') return ((b as any).totalPoints ?? 0) - ((a as any).totalPoints ?? 0);
    const aP = (a as any).monthlyPoints ?? {};
    const bP = (b as any).monthlyPoints ?? {};
    return (bP[sortKey] ?? 0) - (aP[sortKey] ?? 0);
  });

  return (
    <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden hover:border-primary/20 transition-colors">
      <button
        className="w-full px-5 py-4 border-b border-stone-50 flex items-center justify-between hover:bg-primary/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <History size={12} className="text-stone-400" />
          <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Histórico de Pontuação Mensal</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-50 bg-stone-50/40">
                <th className="px-3 py-2.5 text-left sticky left-0 bg-stone-50/90 z-10 min-w-[200px]">
                  <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Founder</span>
                </th>
                {allMonths.map(m => (
                  <th key={m} className="px-3 py-2.5 text-center min-w-[80px]">
                    <button
                      onClick={() => setSortKey(m)}
                      className={cn(
                        'inline-flex items-center gap-1 text-overline font-bold uppercase tracking-widest transition-colors hover:text-primary',
                        m === sortKey ? 'text-primary' : m === currentYM ? 'text-primary/60' : 'text-stone-400'
                      )}
                    >
                      {formatMonthLabel(m)}
                      {m === sortKey && <ChevronDown size={10} />}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right min-w-[80px]">
                  <button
                    onClick={() => setSortKey('total')}
                    className={cn(
                      'inline-flex items-center gap-1 text-overline font-bold uppercase tracking-widest transition-colors hover:text-primary',
                      sortKey === 'total' ? 'text-primary' : 'text-stone-400'
                    )}
                  >
                    Total
                    {sortKey === 'total' && <ChevronDown size={10} />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {(historyExpanded ? sorted : sorted.slice(0, HISTORY_PAGE)).map((founder, idx) => {
                const mp: Record<string, number> = (founder as any).monthlyPoints ?? {};
                const total: number = (founder as any).totalPoints ?? 0;
                return (
                  <tr key={founder.id} className={cn('border-b border-stone-50 hover:bg-primary/5 transition-colors', idx % 2 !== 0 ? 'bg-stone-50/20' : 'bg-white')}>
                    <td className="px-3 py-3 sticky left-0 z-10 bg-inherit transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Avatar founder={founder} size={28} />
                        <div>
                          <p className="text-sm font-semibold text-stone-800 leading-none">{founder.name}</p>
                          <p className="text-xs text-stone-400 mt-0.5">@{(founder as any).username ?? ''}</p>
                        </div>
                      </div>
                    </td>
                    {allMonths.map(m => {
                      const pts = mp[m] ?? 0;
                      return (
                        <td key={m} className="px-3 py-3 text-center">
                          <span className={cn(
                            'text-sm font-bold tabular-nums',
                            pts > 0 ? m === sortKey ? 'text-primary' : 'text-stone-800' : 'text-stone-300'
                          )}>
                            {pts > 0 ? pts : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right">
                      <span className={cn('text-sm font-bold tabular-nums', sortKey === 'total' ? 'text-primary' : 'text-stone-500')}>{total}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200 bg-stone-50">
                <td className="px-3 py-3 sticky left-0 bg-stone-50 z-10">
                  <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Comunidade</span>
                </td>
                {allMonths.map(m => {
                  const sum = sorted.reduce((s, f) => s + (((f as any).monthlyPoints ?? {})[m] ?? 0), 0);
                  return (
                    <td key={m} className="px-3 py-3 text-center">
                      <span className={cn('text-sm font-bold tabular-nums', m === sortKey ? 'text-primary' : 'text-stone-600')}>
                        {sum > 0 ? sum : '—'}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right">
                  <span className={cn('text-sm font-bold tabular-nums', sortKey === 'total' ? 'text-primary' : 'text-stone-600')}>
                    {sorted.reduce((s, f) => s + ((f as any).totalPoints ?? 0), 0)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {sorted.length > HISTORY_PAGE && (
        <div className="border-t border-stone-50 px-5 py-3 flex items-center justify-center">
          <button
            onClick={() => setHistoryExpanded(e => !e)}
            className="flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-800 transition-colors"
          >
            {historyExpanded ? (
              <><ChevronUp size={14} />Ver menos</>
            ) : (
              <><ChevronDown size={14} />Ver mais ({sorted.length - HISTORY_PAGE} founders)</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  founders: Founder[];
  checkins: any[];
  challenges: Challenge[];
}

export function AdminDashboard({ founders, checkins, challenges }: Props) {
  const [period, setPeriod] = useState<Period>('30d');
  const [sortKey, setSortKey] = useState<SortKey>('healthScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all');
  const [matrixExpanded, setMatrixExpanded] = useState(false);

  const MATRIX_PAGE = 10;

  const m = useMemo(() => computeAll(founders, checkins, challenges, period), [founders, checkins, challenges, period]);

  const sorted = useMemo(() => {
    const base = tierFilter === 'all' ? m.founderMetrics : m.founderMetrics.filter(f => f.tier === tierFilter);
    return [...base].sort((a, b) => {
      const av = sortKey === 'name' ? a.founder.name : (a as any)[sortKey] as number;
      const bv = sortKey === 'name' ? b.founder.name : (b as any)[sortKey] as number;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [m.founderMetrics, sortKey, sortDir, tierFilter]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(k); setSortDir('desc'); }
    setMatrixExpanded(false);
  };

  const now = new Date();
  const velocityLabels = Array.from({ length: 8 }, (_, i) => {
    const d = subDays(now, (7 - i) * 7);
    return format(d, 'dd/MM', { locale: ptBR });
  });

  const PERIOD_LABELS: Record<Period, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '3 meses', all: 'Tudo' };

  const tierCounts = { S: 0, A: 0, B: 0, C: 0 } as Record<Tier, number>;
  m.founderMetrics.forEach(f => tierCounts[f.tier]++);

  const chsLabel = m.chs >= 75 ? 'Saudável' : m.chs >= 50 ? 'Atenção' : 'Crítico';
  const chsLabelColor = m.chs >= 75 ? 'text-emerald-600' : m.chs >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-h1 font-sans mb-1">Intelligence Dashboard</h2>
          <p className="text-stone-500 text-sm">Atualizado em {format(now, "d 'de' MMM, HH:mm", { locale: ptBR })}</p>
        </div>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1 self-start">
          {(['7d', '30d', '90d', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                period === p ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Community Health + Vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
        <div className="bg-white border border-stone-100 rounded-2xl p-5 flex flex-col items-center gap-3 min-w-[196px]">
          <HealthRing score={m.chs} size={148} />
          <div className="text-center">
            <div className={cn('text-sm font-bold', chsLabelColor)}>Comunidade {chsLabel}</div>
            <div className="text-xs text-stone-400 mt-0.5">{founders.length} founders · {m.totalActive} ativos</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPICard label="Check-ins" value={m.totalCheckins} delta={m.checkinDelta} icon={CheckSquare} />
          <KPICard label="Founders ativos" value={m.totalActive} sub={`de ${founders.length}`} delta={m.activeDelta} icon={Users} />
          <KPICard label="Conclusão desafios" value={`${m.completionRate}%`} icon={Trophy} />
          <KPICard label="Streak médio" value={`${m.avgStreak}d`} icon={Flame} />
          <KPICard label="Em risco" value={m.atRiskCount} sub="founders" icon={AlertTriangle} />
          <KPICard label={`Check-ins ${m.currentMonthLabel}`} value={m.totalMonthCheckins} delta={m.monthCheckinsDelta} icon={Award} />
        </div>
      </div>

      {/* Insights */}
      {m.insights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={12} className="text-stone-400" />
            <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Insights automáticos</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {m.insights.map((insight, i) => <InsightCard key={i} insight={insight} />)}
          </div>
        </div>
      )}

      {/* Velocity Trend */}
      <div className="bg-white border border-stone-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-stone-400" />
              <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Velocidade de check-ins</span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">Últimas 8 semanas</p>
          </div>
          <div className="text-right">
            <span className="text-h2 font-black text-stone-900 tabular-nums">{m.velocityTrend[m.velocityTrend.length - 1]}</span>
            <span className="text-sm text-stone-400 ml-1.5">esta semana</span>
          </div>
        </div>
        <VelocityChart data={m.velocityTrend} labels={velocityLabels} />
      </div>

      {/* Founder Matrix */}
      <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden hover:border-primary/20 transition-colors">
        <div className="px-5 py-4 border-b border-stone-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={12} className="text-stone-400" />
            <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Matriz de founders</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'S', 'A', 'B', 'C'] as const).map(t => (
              <button key={t} onClick={() => { setTierFilter(t); setMatrixExpanded(false); }}
                className={cn('px-3 py-1.5 rounded-md text-overline font-bold uppercase tracking-wide transition-all',
                  tierFilter === t
                    ? t === 'all' ? 'bg-stone-900 text-white' : cn('ring-1', TIER_COLOR[t as Tier])
                    : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50')}>
                {t === 'all' ? `Todos (${founders.length})` : `${t} · ${tierCounts[t as Tier]}`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-50 bg-stone-50/40">
                <SortTh label="Founder" col="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 text-left"><span className="text-overline font-bold uppercase tracking-widest text-stone-400">Tier</span></th>
                <SortTh label="Health" col="healthScore" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Streak" col="streak" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Check-ins" col="checkins" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Este mês" col="monthCheckins" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 text-left"><span className="text-overline font-bold uppercase tracking-widest text-stone-400">4 semanas</span></th>
                <SortTh label="Momentum" col="momentum" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Churn" col="churnRisk" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 text-left"><span className="text-overline font-bold uppercase tracking-widest text-stone-400">Última ativ.</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-stone-400">Nenhum dado para o período.</td></tr>
              )}
              {(matrixExpanded ? sorted : sorted.slice(0, MATRIX_PAGE)).map((fm, idx) => {
                const churnColor = fm.churnRisk > 65 ? 'text-red-600 font-bold' : fm.churnRisk > 40 ? 'text-amber-600 font-semibold' : 'text-stone-400';
                return (
                  <tr key={fm.founder.id} className={cn('border-b border-stone-50 hover:bg-primary/5 transition-colors', idx % 2 !== 0 && 'bg-stone-50/20')}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar founder={fm.founder} size={28} />
                        <div>
                          <p className="text-sm font-semibold text-stone-800 leading-none">{fm.founder.name}</p>
                          {fm.founder.company?.name && <p className="text-xs text-stone-400 mt-0.5 leading-none">{fm.founder.company.name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-black ring-1', TIER_COLOR[fm.tier])}>
                        {fm.tier}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', fm.healthScore >= 75 ? 'bg-emerald-400' : fm.healthScore >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                            style={{ width: `${fm.healthScore}%` }} />
                        </div>
                        <span className="text-xs font-bold text-stone-600 tabular-nums">{fm.healthScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {fm.streak >= 3 && <Flame size={10} className="text-orange-400" />}
                        <span className={cn('text-sm font-semibold tabular-nums', fm.streak >= 7 ? 'text-orange-500' : fm.streak >= 3 ? 'text-amber-500' : 'text-stone-400')}>
                          {fm.streak}d
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-sm font-bold tabular-nums', fm.periodCheckins > 0 ? 'text-stone-800' : 'text-stone-300')}>
                        {fm.periodCheckins}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-sm font-bold tabular-nums', fm.monthCheckins > 0 ? 'text-stone-800' : 'text-stone-300')}>
                        {fm.monthCheckins}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Sparkline data={fm.weeklyCheckins} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-0.5">
                        {fm.momentum > 0 ? <TrendingUp size={10} className="text-emerald-500" />
                          : fm.momentum < 0 ? <TrendingDown size={10} className="text-red-400" />
                          : <Minus size={10} className="text-stone-300" />}
                        <span className={cn('text-xs font-semibold tabular-nums', fm.momentum > 0 ? 'text-emerald-600' : fm.momentum < 0 ? 'text-red-500' : 'text-stone-300')}>
                          {fm.momentum > 0 ? '+' : ''}{fm.momentum}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-sm tabular-nums', churnColor)}>{fm.churnRisk}%</span>
                    </td>
                    <td className="px-3 py-3">
                      {fm.lastActivity
                        ? <div className="flex flex-col leading-tight">
                            <span className="text-xs text-stone-700 font-medium">
                              {fm.daysSinceLastActivity === 0 ? 'Hoje' : fm.daysSinceLastActivity === 1 ? 'Ontem' : format(fm.lastActivity, "d MMM", { locale: ptBR })}
                            </span>
                            {fm.daysSinceLastActivity > 1 && (
                              <span className="text-[10px] text-stone-400">{fm.daysSinceLastActivity}d atrás</span>
                            )}
                          </div>
                        : <span className="text-xs text-stone-300">Nunca</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sorted.length > MATRIX_PAGE && (
          <div className="border-t border-stone-50 px-5 py-3 flex items-center justify-center">
            <button
              onClick={() => setMatrixExpanded(e => !e)}
              className="flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-800 transition-colors"
            >
              {matrixExpanded ? (
                <>
                  <ChevronUp size={14} />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  Ver mais ({sorted.length - MATRIX_PAGE} founders)
                </>
              )}
            </button>
          </div>
        )}

        <div className="px-5 py-3 border-t border-stone-50 flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs text-stone-400">Health = streak(25%) + consistência(30%) + desafios(20%) + recência(15%) + QCoins(10%)</span>
          <span className="text-xs text-stone-400 hidden sm:inline">·</span>
          <span className="text-xs text-stone-400">Churn = risco de abandono por inatividade e streak</span>
        </div>
      </div>

      {/* Monthly Points History */}
      <PointsHistory founders={founders} />

    </div>
  );
}
