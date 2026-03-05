import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';

const RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

export default function CashflowChart({ transactions }) {
  const [range, setRange] = useState(30);

  const data = useMemo(() => {
    const now = new Date();
    const start = subDays(now, range);
    const days = eachDayOfInterval({ start, end: now });

    const dailyMap = {};
    transactions.forEach((tx) => {
      const d = format(startOfDay(parseISO(tx.date)), 'yyyy-MM-dd');
      if (!dailyMap[d]) dailyMap[d] = { income: 0, expense: 0 };
      if (tx.type === 'income') dailyMap[d].income += tx.amount;
      else if (tx.type === 'expense') dailyMap[d].expense += tx.amount;
    });

    let cumulative = 0;
    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const income = dailyMap[key]?.income || 0;
      const expense = dailyMap[key]?.expense || 0;
      cumulative += income - expense;
      return { date: key, label: format(day, range <= 7 ? 'EEE' : 'd MMM'), income, expense, balance: cumulative };
    });
  }, [transactions, range]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-border bg-surface p-3 shadow-xl text-xs">
        <p className="font-medium text-text mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 flex gap-1.5" role="radiogroup" aria-label="Chart range">
        {RANGES.map(({ label, days }) => (
          <button
            key={days}
            role="radio"
            aria-checked={range === days}
            onClick={() => setRange(days)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
              range === days ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted hover:text-text'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="img" aria-label={`Cashflow chart showing balance over ${range} days`}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="label" tick={{ fill: '#cbd5e1', fontSize: 10 }} tickLine={false} axisLine={false} interval={range <= 7 ? 0 : 'preserveStartEnd'} />
            <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="balance" stroke="#818cf8" fill="url(#balGrad)" strokeWidth={2} animationDuration={800} dot={false} activeDot={{ r: 4, fill: '#818cf8' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
