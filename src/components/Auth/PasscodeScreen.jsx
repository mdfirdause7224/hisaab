import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { isPasscodeSet, checkRateLimit } from '@/lib/crypto';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';

const DOT_COUNT = 4;

export default function PasscodeScreen() {
  const { unlock, loading, error } = useAuth();
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef(null);
  const isNew = !isPasscodeSet();

  useEffect(() => {
    inputRef.current?.focus();
    const limit = checkRateLimit();
    if (!limit.allowed) setCooldown(limit.waitSeconds);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (error) {
      setShake(true);
      setCode('');
      const limit = checkRateLimit();
      if (!limit.allowed) setCooldown(limit.waitSeconds);
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleChange = async (e) => {
    if (cooldown > 0 || loading) return;
    const val = e.target.value.replace(/\D/g, '').slice(0, DOT_COUNT);
    setCode(val);
    if (val.length === DOT_COUNT) {
      const ok = await unlock(val);
      if (ok) setSuccess(true);
    }
  };

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6"
      onClick={() => inputRef.current?.focus()}
    >
      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div key="unlocked" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              <Unlock size={48} className="text-success" />
            </motion.div>
          ) : (
            <motion.div key="locked">
              <Lock size={48} className="text-primary" />
            </motion.div>
          )}
        </AnimatePresence>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">Hisaab</h1>
        <p className="mt-2 text-sm text-text-muted">
          {isNew ? 'Set your 4-digit passcode' : 'Enter your passcode'}
        </p>

        <motion.div
          className="mt-8 flex gap-4"
          animate={shake ? { x: [0, -12, 12, -12, 12, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {Array.from({ length: DOT_COUNT }).map((_, i) => (
            <motion.div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                i < code.length ? 'border-primary bg-primary scale-110' : 'border-border bg-transparent'
              }`}
              animate={i < code.length ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.2 }}
            />
          ))}
        </motion.div>

        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          value={code}
          onChange={handleChange}
          disabled={cooldown > 0 || loading}
          className="absolute opacity-0 w-0 h-0"
          maxLength={DOT_COUNT}
          autoFocus
          aria-label="Passcode input"
        />

        <AnimatePresence>
          {error && (
            <motion.p
              className="mt-4 flex items-center gap-2 text-sm text-expense"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              aria-live="assertive"
            >
              <AlertTriangle size={14} /> {error}
            </motion.p>
          )}
        </AnimatePresence>

        {cooldown > 0 && (
          <p className="mt-3 text-xs text-loan">Try again in {cooldown}s</p>
        )}

        {loading && (
          <p className="mt-4 text-xs text-text-muted animate-pulse">Verifying…</p>
        )}

        <p className="mt-12 max-w-xs text-center text-xs text-text-muted/60">
          {isNew
            ? 'This passcode protects your data. Remember it — there is no recovery without a backup.'
            : 'Losing your passcode may permanently lock your data — export a backup first.'}
        </p>
      </motion.div>
    </div>
  );
}
