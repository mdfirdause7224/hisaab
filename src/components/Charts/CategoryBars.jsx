import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import { CategoryIcon } from '@/lib/categoryIcons';

export default function CategoryBars({ transactions, categories, limit = 5, onCategoryClick }) {
  const catMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  const data = useMemo(() => {
    const totals = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(totals)
      .map(([id, total]) => ({ id, total, ...catMap[id] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }, [transactions, catMap, limit]);

  const max = data[0]?.total || 1;

  if (data.length === 0) return null;

  return (
    <div className="space-y-2.5" role="list" aria-label="Top expense categories">
      {data.map((item, i) => (
        <button key={item.id} onClick={() => onCategoryClick?.(item.id)} className="w-full text-left cursor-pointer group" role="listitem">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-text group-hover:text-primary transition-colors truncate">
              <CategoryIcon name={item.icon} size={12} style={{ color: item.color || '#6366f1' }} />
              {item.title || 'Other'}
            </span>
            <span className="text-xs text-text-muted">{formatCurrency(item.total)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: item.color || '#6366f1' }}
              initial={{ width: 0 }}
              animate={{ width: `${(item.total / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
