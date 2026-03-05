import { useState, useEffect } from 'react';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { useToast } from '@/lib/toast';
import { addLoan, updateLoan, addTransaction } from '@/lib/db';
import { generateId, cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function LoanForm({ open, onOpenChange, editLoan, onSaved }) {
  const { toast } = useToast();
  const [loanName, setLoanName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [reason, setReason] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loanType, setLoanType] = useState('new'); // 'old' or 'new'
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (editLoan) {
      setLoanName(editLoan.party || '');
      setPrincipal(String(editLoan.principal || ''));
      setEmiAmount(String(editLoan.emiAmount || ''));
      setReason(editLoan.reason || '');
      setTermMonths(String(editLoan.termMonths || ''));
      setStartDate(editLoan.startDate ? format(new Date(editLoan.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setLoanType(editLoan.loanType || 'new');
    } else {
      setLoanName(''); setPrincipal(''); setEmiAmount(''); setReason(''); setTermMonths('');
      setStartDate(format(new Date(), 'yyyy-MM-dd')); setLoanType('new');
    }
    setFormError('');
  }, [editLoan, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate all required fields
    if (!loanName.trim() || !principal || !emiAmount || !termMonths) {
      setFormError('All fields are required');
      return;
    }
    setSaving(true);
    setFormError('');
    
    try {
      const principalNum = parseFloat(principal);
      const emiNum = parseFloat(emiAmount);
      const monthsNum = parseInt(termMonths);
      
      // Calculate loan details
      const totalRepayment = emiNum * monthsNum;
      const totalInterest = totalRepayment - principalNum;
      const interestRate = monthsNum > 0 ? (totalInterest / principalNum) * 100 : 0;
      
      const loan = {
        party: loanName.trim(),
        principal: principalNum,
        emiAmount: emiNum,
        interestRate: interestRate, // Calculated internally
        reason: reason.trim(),
        termMonths: monthsNum,
        startDate: new Date(startDate).toISOString(),
        createdAt: new Date().toISOString(), // Add creation timestamp
        loanType, // 'old' or 'new'
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
        <div className="flex gap-2" role="radiogroup" aria-label="Loan type">
          {['old', 'new'].map(type => (
            <button key={type} type="button" role="radio" aria-checked={loanType === type} onClick={() => setLoanType(type)}
              className={cn(
                'flex-1 rounded-xl border py-2 text-sm font-medium transition-all cursor-pointer',
                loanType === type
                  ? type === 'new' ? 'border-income/40 bg-income/10 text-income' : 'border-text-muted/40 bg-surface-hover text-text-muted'
                  : 'border-border text-text-muted hover:bg-surface-hover'
              )}>
              {type === 'new' ? 'New Loan' : 'Old Loan'}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="loan-name" className="mb-1 block text-xs text-text-muted">Loan Name</label>
          <Input id="loan-name" value={loanName} onChange={e => setLoanName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="loan-principal" className="mb-1 block text-xs text-text-muted">Principal Amount</label>
            <Input id="loan-principal" type="number" value={principal} onChange={e => setPrincipal(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="loan-emi" className="mb-1 block text-xs text-text-muted">EMI Amount</label>
            <Input id="loan-emi" type="number" step="0.01" value={emiAmount} onChange={e => setEmiAmount(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="loan-term" className="mb-1 block text-xs text-text-muted">Loan Duration (Months)</label>
            <Input id="loan-term" type="number" min="1" value={termMonths} onChange={e => setTermMonths(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="loan-start" className="mb-1 block text-xs text-text-muted">Start Date</label>
            <Input id="loan-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full" required />
          </div>
        </div>
        <div>
          <label htmlFor="loan-reason" className="mb-1 block text-xs text-text-muted">Reason for Loan</label>
          <Input id="loan-reason" value={reason} onChange={e => setReason(e.target.value)} required />
        </div>
        {formError && <p className="text-xs text-expense" role="alert">{formError}</p>}
        <Button type="submit" className="w-full" disabled={saving || !loanName.trim() || !principal || !emiAmount || !termMonths}>
          {saving ? 'Saving…' : editLoan ? 'Update Loan' : 'Add Loan'}
        </Button>
      </form>
    </Modal>
  );
}
