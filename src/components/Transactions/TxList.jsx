import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Pencil, Trash2, Search, Receipt, Repeat } from 'lucide-react';
import { useTransactions, useCategories, useLoans } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { deleteTransaction } from '@/lib/db';
import { formatCurrency, cn } from '@/lib/utils';
import { CategoryIcon } from '@/lib/categoryIcons';
import { Input } from '@/components/UI/Input';
import { Badge } from '@/components/UI/Badge';
import { Fab } from '@/components/UI/Fab';
import { EmptyState } from '@/components/UI/EmptyState';
import { ConfirmDialog } from '@/components/UI/ConfirmDialog';
import TxForm from './TxForm';
import { useSearchParams } from 'react-router-dom';

function groupByDay(transactions) {
  const groups = {};
  for (const tx of transactions) {
    const key = format(parseISO(tx.date), 'yyyy-MM-dd');
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function dayLabel(dateStr) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, d MMM yyyy');
}

export default function TxListPage() {
  const { transactions, refresh } = useTransactions();
  const { categories } = useCategories();
  const { loans } = useLoans();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialCat = searchParams.get('category') || '';
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState(initialCat);
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const catMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    let list = transactions;
    
    // Add new loans as transactions
    const loanTransactions = loans
      .filter(loan => loan.loanType === 'new')
      .map(loan => {
        // Use the loan's actual creation time or current time if not available
        const loanDateTime = loan.createdAt || loan.startDate || new Date().toISOString();
        
        return {
          id: `loan_${loan.id}`,
          type: 'income', // Treat borrowed loans as income
          amount: loan.principal,
          categoryId: 'cat_other',
          note: `Loan received: ${loan.party}`,
          date: loanDateTime,
          tags: ['new-loan'],
          recurrence: 'none',
          isLoanTransaction: true, // Flag to identify loan transactions
          loanId: loan.id
        };
      });
    
    // Combine regular transactions with loan transactions
    list = [...list, ...loanTransactions];
    
    // Apply filters
    if (filterType !== 'all') {
      if (filterType === 'loan') {
        // Show only loan transactions
        list = list.filter(t => t.isLoanTransaction);
      } else {
        // Show regular transactions of the selected type
        list = list.filter(t => !t.isLoanTransaction && t.type === filterType);
      }
    }
    if (filterCat) list = list.filter(t => t.categoryId === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.note?.toLowerCase().includes(q) ||
        catMap[t.categoryId]?.title.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [transactions, loans, filterType, filterCat, search, catMap]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteTransaction(deleteTarget);
        toast({ title: 'Transaction deleted', variant: 'success' });
        refresh();
      } catch (err) {
        toast({ title: 'Delete failed', description: err.message, variant: 'error' });
      }
      setDeleteTarget(null);
    }
  };

  const handleEdit = (tx) => {
    setEditTx(tx);
    setFormOpen(true);
  };

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold mb-3">Transactions</h1>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search notes, categories, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search transactions"
            data-search-input
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Filter by type">
            {['all', 'income', 'expense', 'loan'].map(t => (
              <button
                key={t}
                role="radio"
                aria-checked={filterType === t}
                onClick={() => setFilterType(t)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  filterType === t ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:bg-surface-hover'
                )}
              >
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {filterCat && (
            <button onClick={() => setFilterCat('')} className="rounded-lg px-2.5 py-1.5 text-xs font-medium bg-primary/20 text-primary cursor-pointer">
              ✕ {catMap[filterCat]?.title || 'Category'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4">
        {groups.length === 0 && (
          <EmptyState icon={Receipt} title="No transactions yet" description="Tap + to add your first expense" />
        )}

        <AnimatePresence>
          {groups.map(([day, txs]) => {
            // Calculate day total: income + borrowed loans - expenses
            // Loans are now included as transactions, so no need for separate calculation
            const dayTotal = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
            
            return (
              <motion.div key={day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-text-muted">{dayLabel(day)}</span>
                  <span className={cn('text-xs font-semibold', dayTotal >= 0 ? 'text-income' : 'text-expense')}>
                    {formatCurrency(dayTotal)}
                  </span>
                </div>
                <div className="space-y-2">
                  {txs.map((tx) => {
                    const cat = catMap[tx.categoryId];
                    const isLoanTx = tx.isLoanTransaction;
                    
                    return (
                      <motion.div key={tx.id} layout className={cn(
                        'flex items-center gap-3 rounded-xl border bg-surface p-3 group',
                        isLoanTx ? 'border-loan/30 bg-loan/5' : 'border-border'
                      )}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: (cat?.color || '#6366f1') + '20' }}>
                          <CategoryIcon name={cat?.icon} size={18} style={{ color: cat?.color || '#6366f1' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{cat?.title || 'Other'}</span>
                            <Badge variant={isLoanTx ? 'loan' : tx.type}>
                              {isLoanTx ? 'Loan' : tx.type}
                            </Badge>
                            {tx.recurrence && tx.recurrence !== 'none' && (
                              <Repeat size={10} className="text-text-muted" title={`Repeats ${tx.recurrence}`} />
                            )}
                          </div>
                          {tx.note && <p className="text-xs text-text-muted truncate">{tx.note}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            'text-sm font-semibold',
                            isLoanTx ? 'text-loan' : tx.type === 'income' ? 'text-income' : tx.type === 'expense' ? 'text-expense' : 'text-loan'
                          )}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>
                          <p className="text-[10px] text-text-muted">{format(parseISO(tx.date), 'h:mm a')}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(tx)} className="rounded-lg p-1.5 bg-surface-hover text-text cursor-pointer" aria-label={`Edit ${cat?.title || ''} transaction`}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget(tx.id)} className="rounded-lg p-1.5 bg-danger/10 text-danger cursor-pointer" aria-label={`Delete ${cat?.title || ''} transaction`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Fab onClick={() => { setEditTx(null); setFormOpen(true); }} />
      <TxForm open={formOpen} onOpenChange={setFormOpen} editTx={editTx} onSaved={refresh} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete transaction" description="This action cannot be undone." onConfirm={handleDelete} />
    </div>
  );
}
