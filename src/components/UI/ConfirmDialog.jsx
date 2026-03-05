import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button } from './Button';

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, confirmLabel = 'Delete', variant = 'destructive' }) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold text-text">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-text-muted">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={variant === 'destructive' ? 'destructive' : 'default'} size="sm" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
