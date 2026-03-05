import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, PieChart, Landmark, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Txns' },
  { to: '/analytics', icon: PieChart, label: 'Analytics' },
  { to: '/loans', icon: Landmark, label: 'Loans' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function NavBar() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/80 backdrop-blur-xl safe-area-pb">
      <div className="mx-auto flex max-w-lg items-center justify-around py-1">
        {links.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors',
                active ? 'text-primary' : 'text-text'
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
