import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, addMonths } from 'date-fns';
import { Plus, Pencil, Trash2, CreditCard, ChevronDown, ChevronUp, Landmark } from 'lucide-react';
import { useLoans } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { deleteLoan } from '@/lib/db';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/UI/Button';
import { Card } from '@/components/UI/Card';
import { Badge } from '@/components/UI/Badge';
import { EmptyState } from '@/components/UI/EmptyState';
import { ConfirmDialog } from '@/components/UI/ConfirmDialog';
import LoanForm from './LoanForm';
import PaymentForm from './PaymentForm';

function AmortizationSchedule({ loan }) {
  const schedule = useMemo(() => {
    const months = Math.min(Math.max(loan.termMonths || 12, 1), 360);
    const rate = (loan.interestRate || 0) / 100 / 12;
    const p = loan.principal;
    const emi = rate > 0
      ? (p * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1)
      : p / months;

    let balance = p;
    const rows = [];
    for (let i = 1; i <= months; i++) {
      const interest = balance * rate;
      const principalPart = emi - interest;
      balance = Math.max(0, balance - principalPart);
      rows.push({ month: i, date: format(addMonths(parseISO(loan.startDate), i), 'MMM yyyy'), emi, interest, principal: principalPart, balance });
    }
    return { emi, rows };
  }, [loan]);

  return (
    <div className="mt-3 max-h-48 overflow-y-auto">
      <div className="mb-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary font-medium">
        EMI: {formatCurrency(schedule.emi)}/month
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-muted">
            <th className="text-left pb-1">#</th>
            <th className="text-left pb-1">Date</th>
            <th className="text-right pb-1">EMI</th>
            <th className="text-right pb-1">Balance</th>
          </tr>
        </thead>
        <tbody>
          {schedule.rows.map(row => (
            <tr key={row.month} className="border-t border-border/50">
              <td className="py-1 text-text-muted">{row.month}</td>
              <td className="py-1">{row.date}</td>
              <td className="py-1 text-right">{formatCurrency(row.emi)}</td>
              <td className="py-1 text-right text-text-muted">{formatCurrency(row.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LoanListPage() {
  const { loans, refresh } = useLoans();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editLoan, setEditLoan] = useState(null);
  const [payLoan, setPayLoan] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteLoan(deleteTarget);
        toast({ title: 'Loan deleted', variant: 'success' });
        refresh();
      } catch (err) {
        toast({ title: 'Delete failed', description: err.message, variant: 'error' });
      }
      setDeleteTarget(null);
    }
  };

  return (
    <div className="pb-24 px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Loans</h1>
        <Button size="sm" onClick={() => { setEditLoan(null); setFormOpen(true); }}>
          <Plus size={16} /> Add Loan
        </Button>
      </div>

      {loans.length === 0 && (
        <EmptyState icon={Landmark} title="No loans" description="Track borrowed and lent money here" />
      )}

      <AnimatePresence>
        {loans.map((loan) => {
          const totalPaid = (loan.payments || []).reduce((s, p) => s + p.amount, 0);
          const remaining = loan.principal - totalPaid;
          const progress = loan.principal > 0 ? (totalPaid / loan.principal) * 100 : 0;
          const isExpanded = expanded === loan.id;

          return (
            <motion.div key={loan.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3">
              <Card>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{loan.party}</span>
                      <Badge variant={loan.direction === 'lent' ? 'income' : 'expense'}>
                        {loan.direction === 'lent' ? 'Lent' : 'Borrowed'}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted">
                      {formatCurrency(loan.principal)} · {loan.interestRate || 0}% · {loan.termMonths || 12} months
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-loan">{formatCurrency(remaining)}</p>
                    <p className="text-[10px] text-text-muted">remaining</p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full rounded-full bg-surface-hover overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                  <motion.div className="h-full rounded-full bg-income" initial={{ width: 0 }} animate={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 0.6 }} />
                </div>
                <p className="mt-1 text-[10px] text-text-muted">{progress.toFixed(0)}% paid</p>

                {(loan.payments || []).length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-text-muted mb-1">Recent payments:</p>
                    {(loan.payments || []).slice(-3).map((p) => (
                      <div key={p.id} className="flex justify-between text-xs py-0.5">
                        <span className="text-text-muted">{format(parseISO(p.date), 'd MMM yyyy')}</span>
                        <span className="text-income">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setExpanded(isExpanded ? null : loan.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {isExpanded ? 'Hide schedule' : 'Amortization schedule'}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <AmortizationSchedule loan={loan} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPayLoan(loan)}>
                    <CreditCard size={14} /> Pay
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditLoan(loan); setFormOpen(true); }} aria-label="Edit loan">
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(loan.id)} className="text-danger hover:text-danger" aria-label="Delete loan">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <LoanForm open={formOpen} onOpenChange={setFormOpen} editLoan={editLoan} onSaved={refresh} />
      <PaymentForm open={!!payLoan} onOpenChange={() => setPayLoan(null)} loan={payLoan} onSaved={refresh} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete loan" description="This will permanently remove this loan and all payment records." onConfirm={handleDelete} />
    </div>
  );
}
