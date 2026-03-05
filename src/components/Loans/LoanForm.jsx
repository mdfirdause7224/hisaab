import { useState, useEffect } from 'react';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { useToast } from '@/lib/toast';
import { addLoan, updateLoan } from '@/lib/db';
import { generateId, cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function LoanForm({ open, onOpenChange, editLoan, onSaved }) {
  const { toast } = useToast();
  const [party, setParty] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [direction, setDirection] = useState('borrowed');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (editLoan) {
      setParty(editLoan.party || '');
      setPrincipal(String(editLoan.principal || ''));
      setInterestRate(String(editLoan.interestRate || ''));
      setTermMonths(String(editLoan.termMonths || ''));
      setStartDate(editLoan.startDate ? format(new Date(editLoan.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setDirection(editLoan.direction || 'borrowed');
    } else {
      setParty(''); setPrincipal(''); setInterestRate(''); setTermMonths('');
      setStartDate(format(new Date(), 'yyyy-MM-dd')); setDirection('borrowed');
    }
    setFormError('');
  }, [editLoan, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!party.trim() || !principal) return;
    setSaving(true);
    setFormError('');
    try {
      const loan = {
        party: party.trim(),
        principal: parseFloat(principal),
        interestRate: parseFloat(interestRate) || 0,
        termMonths: Math.min(Math.max(parseInt(termMonths) || 12, 1), 360),
        startDate: new Date(startDate).toISOString(),
        direction,
        payments: editLoan?.payments || [],
      };
      if (editLoan) {
        await updateLoan(editLoan.id, loan);
        toast({ title: 'Loan updated', variant: 'success' });
      } else {
        await addLoan({ id: generateId(), ...loan });
        toast({ title: 'Loan added', variant: 'success' });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setFormError(err.message || 'Failed to save');
      toast({ title: 'Save failed', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editLoan ? 'Edit Loan' : 'Add Loan'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2" role="radiogroup" aria-label="Loan direction">
          {['borrowed', 'lent'].map(d => (
            <button key={d} type="button" role="radio" aria-checked={direction === d} onClick={() => setDirection(d)}
              className={cn(
                'flex-1 rounded-xl border py-2 text-sm font-medium transition-all cursor-pointer',
                direction === d
                  ? d === 'borrowed' ? 'border-expense/40 bg-expense/10 text-expense' : 'border-income/40 bg-income/10 text-income'
                  : 'border-border text-text-muted hover:bg-surface-hover'
              )}>
              {d === 'borrowed' ? 'Borrowed' : 'Lent'}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="loan-party" className="mb-1 block text-xs text-text-muted">{direction === 'borrowed' ? 'Lender Name' : 'Borrower Name'}</label>
          <Input id="loan-party" placeholder="e.g. Amit" value={party} onChange={e => setParty(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="loan-principal" className="mb-1 block text-xs text-text-muted">Principal Amount</label>
            <Input id="loan-principal" type="number" placeholder="20000" value={principal} onChange={e => setPrincipal(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="loan-rate" className="mb-1 block text-xs text-text-muted">Interest Rate (%)</label>
            <Input id="loan-rate" type="number" step="0.1" placeholder="12" value={interestRate} onChange={e => setInterestRate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="loan-term" className="mb-1 block text-xs text-text-muted">Term (Months)</label>
            <Input id="loan-term" type="number" min="1" max="360" placeholder="12" value={termMonths} onChange={e => setTermMonths(e.target.value)} />
          </div>
          <div>
            <label htmlFor="loan-start" className="mb-1 block text-xs text-text-muted">Start Date</label>
            <Input id="loan-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
        </div>
        {formError && <p className="text-xs text-expense" role="alert">{formError}</p>}
        <Button type="submit" className="w-full" disabled={saving || !party.trim() || !principal}>
          {saving ? 'Saving…' : editLoan ? 'Update Loan' : 'Add Loan'}
        </Button>
      </form>
    </Modal>
  );
}
