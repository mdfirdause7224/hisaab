import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import { format, parseISO, subMonths, isAfter, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { useTransactions, useCategories } from '@/lib/hooks';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/UI/Card';
import { TrendingUp, PieChart as PieIcon, BarChart3 } from 'lucide-react';

const COLORS = ['#818cf8', '#34d399', '#f87171', '#fbbf24', '#22d3ee', '#a855f7', '#ec4899', '#f97316'];

export default function AnalyticsPage() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const [period, setPeriod] = useState(6);

  const catMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const start = subMonths(startOfMonth(now), period - 1);
    const months = eachMonthOfInterval({ start, end: now });

    return months.map(month => {
      const key = format(month, 'yyyy-MM');
      const label = format(month, 'MMM');
      let income = 0, expense = 0;
      transactions.forEach(tx => {
        if (format(parseISO(tx.date), 'yyyy-MM') === key) {
          if (tx.type === 'income') income += tx.amount;
          if (tx.type === 'expense') expense += tx.amount;
        }
      });
      return { month: label, income, expense, net: income - expense };
    });
  }, [transactions, period]);

  const categoryBreakdown = useMemo(() => {
    const cutoff = subMonths(new Date(), period);
    const totals = {};
    transactions.forEach(tx => {
      if (tx.type === 'expense' && isAfter(parseISO(tx.date), cutoff)) {
        totals[tx.categoryId] = (totals[tx.categoryId] || 0) + tx.amount;
      }
    });
    return Object.entries(totals)
      .map(([id, value]) => ({ id, name: catMap[id]?.title || 'Other', value, color: catMap[id]?.color || '#818cf8' }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, catMap, period]);

  const categoryTrends = useMemo(() => {
    const now = new Date();
    const start = subMonths(startOfMonth(now), period - 1);
    const months = eachMonthOfInterval({ start, end: now });
    const topCats = categoryBreakdown.slice(0, 4).map(c => c.id);

    return months.map(month => {
      const key = format(month, 'yyyy-MM');
      const point = { month: format(month, 'MMM') };
      topCats.forEach(catId => { point[catMap[catId]?.title || catId] = 0; });
      transactions.forEach(tx => {
        if (tx.type === 'expense' && format(parseISO(tx.date), 'yyyy-MM') === key && topCats.includes(tx.categoryId)) {
          point[catMap[tx.categoryId]?.title || tx.categoryId] += tx.amount;
        }
      });
      return point;
    });
  }, [transactions, catMap, categoryBreakdown, period]);

  const forecastData = useMemo(() => {
    if (monthlyData.length < 2) return [];
    const avgIncome = monthlyData.reduce((s, m) => s + m.income, 0) / monthlyData.length;
    const avgExpense = monthlyData.reduce((s, m) => s + m.expense, 0) / monthlyData.length;
    const forecast = [];
    let balance = monthlyData.reduce((s, m) => s + m.net, 0);
    for (let i = 1; i <= 3; i++) {
      balance += avgIncome - avgExpense;
      forecast.push({ month: `+${i}mo`, projected: Math.round(balance), income: Math.round(avgIncome), expense: Math.round(avgExpense) });
    }
    return forecast;
  }, [monthlyData]);

  const topCatNames = categoryBreakdown.slice(0, 4).map(c => catMap[c.id]?.title || c.id);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-border bg-surface p-3 shadow-xl text-xs">
        <p className="font-medium text-text mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color || p.fill }}>
            {p.dataKey}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="pb-24 px-4 pt-4">
      <h1 className="text-xl font-bold mb-3">Analytics</h1>

      <div className="flex gap-1.5 mb-4" role="radiogroup" aria-label="Period">
        {[3, 6, 12].map(p => (
          <button key={p} role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer', period === p ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:bg-surface-hover')}>
            {p}M
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" /> Income vs Expenses
          </CardTitle>
        </CardHeader>
        <div role="img" aria-label="Bar chart comparing income and expenses by month">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#cbd5e1', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="income" fill="#34d399" radius={[4, 4, 0, 0]} animationDuration={600} />
              <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieIcon size={16} className="text-accent" /> Expense Breakdown
          </CardTitle>
        </CardHeader>
        {categoryBreakdown.length > 0 ? (
          <div className="flex items-center gap-4">
            <div role="img" aria-label="Pie chart of expense categories">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" animationDuration={600} stroke="none">
                    {categoryBreakdown.map((entry, i) => (
                      <Cell key={entry.id} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {categoryBreakdown.slice(0, 6).map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 truncate text-text-muted">{cat.name}</span>
                  <span className="font-medium">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted text-center py-8">No expense data</p>
        )}
      </Card>

      {topCatNames.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Category Trends</CardTitle>
          </CardHeader>
          <div role="img" aria-label="Line chart showing category spending trends">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={categoryTrends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#cbd5e1', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                {topCatNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} animationDuration={600} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {forecastData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={16} className="text-income" /> Cashflow Forecast
            </CardTitle>
          </CardHeader>
          <p className="text-xs text-text-muted mb-3">Based on your average income and expenses</p>
          <div role="img" aria-label="Bar chart showing projected cashflow">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={forecastData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#cbd5e1', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="projected" fill="#818cf8" radius={[4, 4, 0, 0]} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
