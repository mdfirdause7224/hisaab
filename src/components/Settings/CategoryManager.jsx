import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { addCategory, updateCategory, deleteCategory } from '@/lib/db';
import { useToast } from '@/lib/toast';
import { generateId, cn } from '@/lib/utils';
import { Input } from '@/components/UI/Input';
import { Button } from '@/components/UI/Button';
import { ConfirmDialog } from '@/components/UI/ConfirmDialog';

const PRESET_COLORS = ['#F59E0B', '#3B82F6', '#EC4899', '#EF4444', '#22C55E', '#A855F7', '#06B6D4', '#F97316', '#14B8A6', '#64748B'];

export default function CategoryManager({ categories, onChanged }) {
  const { toast } = useToast();
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const startEdit = (cat) => {
    setEditId(cat.id);
    setEditTitle(cat.title);
    setEditColor(cat.color);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    try {
      await updateCategory(editId, { title: editTitle.trim(), color: editColor });
      toast({ title: 'Category updated', variant: 'success' });
      setEditId(null);
      onChanged?.();
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'error' });
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await addCategory({ id: `cat_${generateId().slice(0, 8)}`, title: newTitle.trim(), icon: 'Tag', color: newColor });
      toast({ title: 'Category added', variant: 'success' });
      setNewTitle('');
      onChanged?.();
    } catch (err) {
      toast({ title: 'Add failed', description: err.message, variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory(deleteTarget);
      toast({ title: 'Category deleted', variant: 'success' });
      setDeleteTarget(null);
      onChanged?.();
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'error' });
    }
  };

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {categories.map(cat => (
        <div key={cat.id} className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
          {editId === cat.id ? (
            <>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-8 text-xs flex-1" aria-label="Category name" />
              <div className="flex gap-0.5">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setEditColor(c)} className={cn('h-4 w-4 rounded-full cursor-pointer', editColor === c && 'ring-2 ring-primary ring-offset-1 ring-offset-surface')} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
                ))}
              </div>
              <button onClick={saveEdit} className="p-1 text-income cursor-pointer" aria-label="Save"><Check size={14} /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-text-muted cursor-pointer" aria-label="Cancel"><X size={14} /></button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm">{cat.title}</span>
              <button onClick={() => startEdit(cat)} className="p-1 text-text-muted hover:text-text cursor-pointer" aria-label={`Edit ${cat.title}`}><Pencil size={12} /></button>
              <button onClick={() => setDeleteTarget(cat.id)} className="p-1 text-text-muted hover:text-danger cursor-pointer" aria-label={`Delete ${cat.title}`}><Trash2 size={12} /></button>
            </>
          )}
        </div>
      ))}

      <div className="border-t border-border pt-3">
        <p className="text-xs text-text-muted mb-2">Add category</p>
        <div className="flex items-center gap-2">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Category name" className="h-8 text-xs flex-1" aria-label="New category name" />
          <div className="flex gap-0.5">
            {PRESET_COLORS.slice(0, 5).map(c => (
              <button key={c} onClick={() => setNewColor(c)} className={cn('h-4 w-4 rounded-full cursor-pointer', newColor === c && 'ring-2 ring-primary ring-offset-1 ring-offset-surface')} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
            ))}
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()} aria-label="Add category">
            <Plus size={14} />
          </Button>
        </div>
      </div>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete category?" description="Transactions using this category won't be deleted, but will show as 'Other'." onConfirm={handleDelete} />
    </div>
  );
}
