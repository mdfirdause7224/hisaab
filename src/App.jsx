import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ToastProvider } from '@/lib/toast';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import PasscodeScreen from '@/components/Auth/PasscodeScreen';
import Onboarding from '@/components/UI/Onboarding';
import { NavBar } from '@/components/UI/NavBar';
import { db } from '@/lib/db';

const Dashboard = lazy(() => import('@/components/Dashboard/Dashboard'));
const TxListPage = lazy(() => import('@/components/Transactions/TxList'));
const LoanListPage = lazy(() => import('@/components/Loans/LoanList'));
const AnalyticsPage = lazy(() => import('@/components/Analytics/Analytics'));
const SettingsPage = lazy(() => import('@/components/Settings/Settings'));

function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.querySelector('[data-search-input]')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

function AppShell() {
  const { unlocked } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  useKeyboardShortcuts();

  useEffect(() => {
    if (unlocked) {
      db.meta.get('onboarded').then(val => {
        if (!val) setShowOnboarding(true);
      });
    }
  }, [unlocked]);

  if (!unlocked) return <PasscodeScreen />;

  return (
    <BrowserRouter>
      <div className="min-h-dvh bg-background pb-16">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-dvh"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<TxListPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/loans" element={<LoanListPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
        <NavBar />
        {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  );
}
