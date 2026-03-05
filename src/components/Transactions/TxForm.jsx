import { useState, useEffect } from 'react';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { useCategories } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { addTransaction, updateTransaction } from '@/lib/db';
import { generateId, cn } from '@/lib/utils';
import { CategoryIcon } from '@/lib/categoryIcons';
import { format } from 'date-fns';

const TYPES = [
  { value: 'income', label: 'Income', color: 'text-income border-income/40 bg-income/10' },
  { value: 'expense', label: 'Expense', color: 'text-expense border-expense/40 bg-expense/10' },
  { value: 'loan', label: 'Loan', color: 'text-loan border-loan/40 bg-loan/10' },
];

const RECURRENCES = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function TxForm({ open, onOpenChange, editTx, onSaved }) {
  const { categories } = useCategories();
  const { toast } = useToast();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [tags, setTags] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [receiptFile, setReceiptFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (editTx) {
      setType(editTx.type);
      setAmount(String(editTx.amount));
      setCategoryId(editTx.categoryId || '');
      setNote(editTx.note || '');
      setDate(format(new Date(editTx.date), "yyyy-MM-dd'T'HH:mm"));
      setTags(editTx.tags?.join(', ') || '');
      setRecurrence(editTx.recurrence || 'none');
    } else {
      setType('expense');
      setAmount('');
      setCategoryId('');
      setNote('');
      setDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setTags('');
      setRecurrence('none');
      setReceiptFile(null);
    }
    setFormError('');
  }, [editTx, open]);

  const handleAmountChange = (e) => {
    const val = e.target.value;
    if (val.startsWith('-')) {
      setType('expense');
      setAmount(val.slice(1));
    } else {
      setAmount(val);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    setSaving(true);
    setFormError('');
    try {
      const tx = {
        type,
        amount: parseFloat(amount),
        categoryId: categoryId || 'cat_other',
        date: new Date(date).toISOString(),
        note: note.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        currency: 'INR',
        recurrence,
      };

      if (receiptFile) {
        const buffer = await receiptFile.arrayBuffer();
        const blobId = `blob_${generateId()}`;
        const { db } = await import('@/lib/db');
        await db.blobs.add({ id: blobId, type: receiptFile.type, data: buffer, name: receiptFile.name });
        tx.receiptBlobId = blobId;
      }

      if (editTx) {
        await updateTransaction(editTx.id, tx);
        toast({ title: 'Transaction updated', variant: 'success' });
      } else {
        await addTransaction({ id: generateId(), ...tx });
        toast({ title: 'Transaction added', description: `${type} · ${amount}`, variant: 'success' });
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
    <Modal open={open} onOpenChange={onOpenChange} title={editTx ? 'Edit Transaction' : 'Add Transaction'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2" role="radiogroup" aria-label="Transaction type">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                'flex-1 rounded-xl border py-2 text-sm font-medium transition-all cursor-pointer',
                type === t.value ? t.color : 'border-border text-text-muted hover:bg-surface-hover'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="tx-amount" className="mb-1 block text-xs text-text-muted">Amount</label>
          <Input
            id="tx-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountChange}
            autoFocus
            required
            className="text-xl font-semibold"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-muted">Category</label>
          <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto" role="radiogroup" aria-label="Category">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="radio"
                aria-checked={categoryId === cat.id}
                onClick={() => setCategoryId(cat.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] transition-all cursor-pointer',
                  categoryId === cat.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-muted hover:bg-surface-hover'
                )}
              >
                <CategoryIcon name={cat.icon} size={14} style={{ color: cat.color }} />
                <span className="truncate w-full text-center">{cat.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="tx-date" className="mb-1 block text-xs text-text-muted">Date & Time</label>
          <Input id="tx-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <label htmlFor="tx-recurrence" className="mb-1 block text-xs text-text-muted">Repeat</label>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Recurrence">
            {RECURRENCES.map(r => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={recurrence === r.value}
                onClick={() => setRecurrence(r.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  recurrence === r.value ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted hover:text-text'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="tx-note" className="mb-1 block text-xs text-text-muted">Note</label>
          <Input id="tx-note" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div>
          <label htmlFor="tx-tags" className="mb-1 block text-xs text-text-muted">Tags (comma separated)</label>
          <Input id="tx-tags" placeholder="e.g. dinner, office" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        <div>
          <label htmlFor="tx-receipt" className="mb-1 block text-xs text-text-muted">Receipt (optional)</label>
          <input
            id="tx-receipt"
            type="file"
            accept="image/*"
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-xs file:text-text file:cursor-pointer"
          />
        </div>

        {formError && <p className="text-xs text-expense" role="alert">{formError}</p>}

        <Button type="submit" className="w-full" disabled={saving || !amount}>
          {saving ? 'Saving…' : editTx ? 'Update' : 'Add Transaction'}
        </Button>
      </form>
    </Modal>
  );
}
