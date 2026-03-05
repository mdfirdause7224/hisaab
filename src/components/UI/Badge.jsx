import { cn } from '@/lib/utils';

export function Badge({ className, variant = 'default', children, ...props }) {
  const variants = {
    default: 'bg-primary/20 text-primary',
    income: 'bg-income/20 text-income',
    expense: 'bg-expense/20 text-expense',
    loan: 'bg-loan/20 text-loan',
    muted: 'bg-surface-hover text-text-muted',
  };
  return (
    <span
      className={cn('inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium', variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}
