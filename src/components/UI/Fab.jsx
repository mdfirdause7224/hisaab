import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Fab({ onClick, className }) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'fixed bottom-20 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30 active:scale-95 transition-colors cursor-pointer',
        className
      )}
      whileTap={{ scale: 0.9 }}
      aria-label="Quick add transaction"
    >
      <Plus size={24} />
    </motion.button>
  );
}
