import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Eye, EyeOff } from 'lucide-react';

export function PassphraseModal({ open, onOpenChange, title, description, confirmLabel = 'Confirm', onConfirm }) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const needsConfirm = title?.toLowerCase().includes('export') || title?.toLowerCase().includes('set');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (passphrase.length < 4) { setError('Min 4 characters'); return; }
    if (needsConfirm && passphrase !== confirm) { setError('Passphrases do not match'); return; }
    onConfirm(passphrase);
    setPassphrase('');
    setConfirm('');
  };

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) { setPassphrase(''); setConfirm(''); setError(''); } onOpenChange(v); }} title={title}>
      {description && <p className="text-xs text-text-muted mb-4">{description}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="pp-input" className="mb-1 block text-xs text-text-muted">Passphrase</label>
          <div className="relative">
            <Input
              id="pp-input"
              type={showPass ? 'text' : 'password'}
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              placeholder="Enter passphrase"
              autoFocus
              required
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text cursor-pointer" aria-label="Toggle visibility">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {needsConfirm && (
          <div>
            <label htmlFor="pp-confirm" className="mb-1 block text-xs text-text-muted">Confirm passphrase</label>
            <Input id="pp-confirm" type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter passphrase" required />
          </div>
        )}
        {error && <p className="text-xs text-expense">{error}</p>}
        <Button type="submit" className="w-full">{confirmLabel}</Button>
      </form>
    </Modal>
  );
}
