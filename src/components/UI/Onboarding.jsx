import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, PlusCircle, Shield } from 'lucide-react';
import { Button } from './Button';
import { db } from '@/lib/db';

const steps = [
  { icon: Wallet, title: 'Welcome to Hisaab', desc: 'Your personal finance tracker — 100% private, all data stays on your device.' },
  { icon: PlusCircle, title: 'Quick Add', desc: 'Tap the + button at the bottom-right to add your first income or expense.' },
  { icon: Shield, title: 'Stay Safe', desc: 'Export backups regularly from Settings to keep your data safe across devices.' },
];

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);

  const finish = async () => {
    await db.meta.put({ key: 'onboarded', value: true });
    onDone();
  };

  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95 backdrop-blur-sm px-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center text-center max-w-xs"
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Icon size={36} className="text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">{current.title}</h2>
          <p className="text-sm text-text-muted mb-8">{current.desc}</p>

          <div className="flex gap-1.5 mb-6">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`} />
            ))}
          </div>

          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} className="w-40">Next</Button>
          ) : (
            <Button onClick={finish} className="w-40">Get Started</Button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
