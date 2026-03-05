import { useState } from 'react';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { useToast } from '@/lib/toast';
import { updateLoan, addTransaction } from '@/lib/db';
import { generateId, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export default function PaymentForm({ open, onOpenChange, loan, onSaved }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  if (!loan) return null;

  const totalPaid = (loan.payments || []).reduce((s, p) => s + p.amount, 0);
  const remaining = loan.principal - totalPaid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    setFormError('');

    const payAmount = parseFloat(amount);
    if (payAmount > remaining) {
      setFormError(`Amount exceeds remaining balance (${formatCurrency(remaining)})`);
      return;
    }
    if (payAmount <= 0) {
      setFormError('Amount must be positive');
      return;
    }

    setSaving(true);
    try {
      // Update loan with new payment
      const payments = [...(loan.payments || []), {
        id: generateId(),
        amount: payAmount,
        date: new Date(date).toISOString(),
      }];
      await updateLoan(loan.id, { payments });

      // Create expense transaction for the loan payment
      const paymentTransaction = {
        id: generateId(),
        type: 'expense',
        amount: payAmount,
        categoryId: 'cat_other', // Use 'Other' category for loan payments
        note: `Loan payment to ${loan.party}`,
        date: new Date(date).toISOString(),
        tags: ['loan-payment'],
        recurrence: 'none',
      };
      await addTransaction(paymentTransaction);

      toast({ title: 'Payment recorded', description: formatCurrency(payAmount), variant: 'success' });
      onSaved?.();
      onOpenChange(false);
      setAmount('');
    } catch (err) {
      setFormError(err.message || 'Failed to save');
      toast({ title: 'Save failed', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Record Payment">
      <div className="mb-4 rounded-xl bg-surface-hover p-3">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Remaining</span>
          <span className="font-semibold text-loan">{formatCurrency(remaining)}</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="pay-amount" className="mb-1 block text-xs text-text-muted">Payment Amount</label>
          <Input id="pay-amount" type="number" step="0.01" max={remaining} placeholder="2000" value={amount} onChange={e => setAmount(e.target.value)} autoFocus required />
        </div>
        <div>
          <label htmlFor="pay-date" className="mb-1 block text-xs text-text-muted">Date</label>
          <Input id="pay-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {formError && <p className="text-xs text-expense" role="alert">{formError}</p>}
        <Button type="submit" className="w-full" disabled={saving || !amount}>
          {saving ? 'Saving…' : 'Record Payment'}
        </Button>
      </form>
    </Modal>
  );
}
