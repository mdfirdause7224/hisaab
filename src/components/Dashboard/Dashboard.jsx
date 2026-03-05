import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { isToday, parseISO, isThisMonth } from 'date-fns';
import { TrendingUp, TrendingDown, Wallet, Calendar, Landmark, ArrowRight } from 'lucide-react';
import { useTransactions, useCategories, useLoans } from '@/lib/hooks';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/UI/Card';
import { Badge } from '@/components/UI/Badge';
import { Fab } from '@/components/UI/Fab';
import { EmptyState } from '@/components/UI/EmptyState';
import CashflowChart from '@/components/Charts/CashflowChart';
import CategoryBars from '@/components/Charts/CategoryBars';
import TxForm from '@/components/Transactions/TxForm';

function AnimatedNumber({ value }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="tabular-nums"
    >
      {formatCurrency(value)}
    </motion.span>
  );
}

function KpiChip({ icon: Icon, label, value, color }) {
  return (
    <motion.div
      className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Icon size={16} className={color} />
      <div>
        <p className="text-[10px] text-text-muted">{label}</p>
        <p className={`text-sm font-semibold ${color}`}>{formatCurrency(value)}</p>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { transactions, refresh } = useTransactions();
  const { categories } = useCategories();
  const { loans } = useLoans();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  const stats = useMemo(() => {
    let totalIncome = 0, totalExpense = 0, todaySpend = 0, monthSpend = 0;
    transactions.forEach(tx => {
      const d = parseISO(tx.date);
      if (tx.type === 'income') totalIncome += tx.amount;
      if (tx.type === 'expense') {
        totalExpense += tx.amount;
        if (isToday(d)) todaySpend += tx.amount;
        if (isThisMonth(d)) monthSpend += tx.amount;
      }
    });
    const totalLoanOwed = loans.reduce((s, l) => {
      const paid = (l.payments || []).reduce((ps, p) => ps + p.amount, 0);
      return s + (l.direction === 'lent' ? 0 : (l.principal - paid));
    }, 0);
    return { balance: totalIncome - totalExpense - totalLoanOwed, todaySpend, monthSpend, totalLoanOwed, totalIncome, totalExpense };
  }, [transactions, loans]);

  const nextLoan = useMemo(() => {
    const upcoming = loans.filter(l => {
      const paid = (l.payments || []).reduce((s, p) => s + p.amount, 0);
      return paid < l.principal;
    });
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [loans]);

  const handleCategoryClick = (catId) => {
    navigate(`/transactions?category=${catId}`);
  };

  return (
    <div className="pb-24 px-4 pt-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <Badge variant="muted">{new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</Badge>
        </div>

        <Card className="mt-4 bg-gradient-to-br from-primary/20 via-surface to-surface border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={18} className="text-primary" />
            <span className="text-xs text-text-muted">Available Balance</span>
          </div>
          <p className="text-3xl font-bold tracking-tight">
            <AnimatedNumber value={stats.balance} />
          </p>
        </Card>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <KpiChip icon={TrendingDown} label="Today" value={stats.todaySpend} color="text-expense" />
          <KpiChip icon={Calendar} label="This Month" value={stats.monthSpend} color="text-expense" />
          <KpiChip icon={TrendingUp} label="Income" value={stats.totalIncome} color="text-income" />
        </div>
      </motion.div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Cashflow</CardTitle>
        </CardHeader>
        {transactions.length > 0 ? (
          <CashflowChart transactions={transactions} />
        ) : (
          <EmptyState title="No data yet" description="Add transactions to see your cashflow" />
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Top Expenses</CardTitle>
          <button onClick={() => navigate('/transactions')} className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer">
            View all <ArrowRight size={12} />
          </button>
        </CardHeader>
        <CategoryBars transactions={transactions} categories={categories} onCategoryClick={handleCategoryClick} />
        {transactions.filter(t => t.type === 'expense').length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No expenses recorded</p>
        )}
      </Card>

      {(loans.length > 0 || nextLoan) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark size={16} className="text-loan" /> Loans
            </CardTitle>
            <button onClick={() => navigate('/loans')} className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer">
              Details <ArrowRight size={12} />
            </button>
          </CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted">Total Owed</p>
              <p className="text-lg font-semibold text-loan">{formatCurrency(stats.totalLoanOwed)}</p>
            </div>
            {nextLoan && (
              <div className="text-right">
                <p className="text-xs text-text-muted">Next: {nextLoan.party}</p>
                <p className="text-sm font-medium text-text">{formatCurrency(nextLoan.principal / (nextLoan.termMonths || 1))}/mo</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Fab onClick={() => setFormOpen(true)} />
      <TxForm open={formOpen} onOpenChange={setFormOpen} onSaved={refresh} />
    </div>
  );
}
