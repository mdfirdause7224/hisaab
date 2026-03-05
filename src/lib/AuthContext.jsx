import { createContext, useContext, useState, useCallback } from 'react';
import { verifyPasscode, setPasscode, isPasscodeSet, checkRateLimit, recordFailedAttempt, resetAttempts, deriveKey, setSessionKey } from './crypto';
import { seedDefaults } from './db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const unlock = useCallback(async (code) => {
    setLoading(true);
    setError('');

    const limit = checkRateLimit();
    if (!limit.allowed) {
      setError(`Too many attempts. Wait ${limit.waitSeconds}s`);
      setLoading(false);
      return false;
    }

    try {
      if (!isPasscodeSet()) {
        await setPasscode(code);
        const key = await deriveKey(code);
        setSessionKey(key);
        await seedDefaults();
        setUnlocked(true);
        return true;
      } else {
        const ok = await verifyPasscode(code);
        if (ok) {
          resetAttempts();
          const key = await deriveKey(code);
          setSessionKey(key);
          await seedDefaults();
          setUnlocked(true);
          return true;
        } else {
          const { attempts, maxAttempts } = recordFailedAttempt();
          const remaining = maxAttempts - attempts;
          setError(remaining > 0 ? `Wrong passcode (${remaining} attempts left)` : 'Wrong passcode');
          return false;
        }
      }
    } catch {
      setError('Verification failed');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const lock = useCallback(() => {
    setSessionKey(null);
    setUnlocked(false);
  }, []);

  const changePasscode = useCallback(async (oldCode, newCode) => {
    const ok = await verifyPasscode(oldCode);
    if (!ok) throw new Error('Current passcode is incorrect');
    await setPasscode(newCode);
    const key = await deriveKey(newCode);
    setSessionKey(key);
  }, []);

  return (
    <AuthContext.Provider value={{ unlocked, loading, error, unlock, lock, changePasscode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
