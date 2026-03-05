import { motion } from 'framer-motion';

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {Icon && <Icon size={48} className="mb-4 text-text-muted/50" />}
      <h3 className="text-lg font-medium text-text-muted">{title}</h3>
      {description && <p className="mt-1 text-sm text-text-muted/70">{description}</p>}
    </motion.div>
  );
}
