import { useState } from 'react';
import { Lock, Download, Upload, Trash2, FileText, Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/toast';
import { exportAllData, importAllData, clearAllData, seedDefaults } from '@/lib/db';
import { exportEncrypted, importEncrypted } from '@/lib/crypto';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { Card } from '@/components/UI/Card';
import { Modal } from '@/components/UI/Modal';
import { ConfirmDialog } from '@/components/UI/ConfirmDialog';
import { PassphraseModal } from '@/components/UI/PassphraseModal';
import { useCategories, useTransactions, useLoans } from '@/lib/hooks';
import CategoryManager from './CategoryManager';

function csvEscape(val) {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function SettingsPage() {
  const { lock, changePasscode } = useAuth();
  const { toast } = useToast();
  const { categories, refresh: refreshCats } = useCategories();
  const { refresh: refreshTx } = useTransactions();
  const { refresh: refreshLoans } = useLoans();
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportPPOpen, setExportPPOpen] = useState(false);
  const [importPPOpen, setImportPPOpen] = useState(false);
  const [pendingImportText, setPendingImportText] = useState('');

  const handleChangePasscode = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess(false);
    try {
      await changePasscode(oldPass, newPass);
      setPassSuccess(true);
      setOldPass('');
      setNewPass('');
      toast({ title: 'Passcode changed', variant: 'success' });
      setTimeout(() => { setPassModalOpen(false); setPassSuccess(false); }, 1500);
    } catch (err) {
      setPassError(err.message);
    }
  };

  const handleExportEncrypted = () => setExportPPOpen(true);

  const doExportEncrypted = async (passphrase) => {
    setExportPPOpen(false);
    setExporting(true);
    try {
      const data = await exportAllData();
      const encrypted = await exportEncrypted(data, passphrase);
      downloadFile(encrypted, 'hisaab-backup.enc.json', 'application/json');
      toast({ title: 'Backup exported', variant: 'success' });
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'error' });
    }
    setExporting(false);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const header = 'Date,Type,Amount,Category,Note,Tags\n';
      const rows = data.transactions.map(tx => {
        const cat = categories.find(c => c.id === tx.categoryId);
        return [tx.date, tx.type, tx.amount, cat?.title || 'Other', tx.note || '', (tx.tags || []).join(';')]
          .map(csvEscape).join(',');
      }).join('\n');
      downloadFile(header + rows, 'hisaab-export.csv', 'text/csv');
      toast({ title: 'CSV exported', variant: 'success' });
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'error' });
    }
    setExporting(false);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.enc.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        if (json.iv && json.data) {
          setPendingImportText(text);
          setImportPPOpen(true);
        } else {
          await importAllData(json);
          toast({ title: 'Data imported', description: `${json.transactions?.length || 0} transactions`, variant: 'success' });
          refreshAll();
        }
      } catch (err) {
        toast({ title: 'Import failed', description: err.message, variant: 'error' });
      }
      setImporting(false);
    };
    input.click();
  };

  const doImportEncrypted = async (passphrase) => {
    setImportPPOpen(false);
    setImporting(true);
    try {
      const data = await importEncrypted(pendingImportText, passphrase);
      await importAllData(data);
      toast({ title: 'Data imported', variant: 'success' });
      refreshAll();
    } catch (err) {
      toast({ title: 'Import failed', description: err.message, variant: 'error' });
    }
    setImporting(false);
    setPendingImportText('');
  };

  const handleClearAll = async () => {
    try {
      await clearAllData();
      await seedDefaults();
      setClearConfirm(false);
      toast({ title: 'All data cleared', variant: 'success' });
      refreshAll();
    } catch (err) {
      toast({ title: 'Clear failed', description: err.message, variant: 'error' });
    }
  };

  function refreshAll() {
    refreshTx();
    refreshCats();
    refreshLoans();
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-24 px-4 pt-4">
      <h1 className="text-xl font-bold mb-4">Settings</h1>

      <div className="space-y-3">
        <Card>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield size={16} className="text-primary" /> Security
          </h2>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => setPassModalOpen(true)}>
              <Lock size={16} /> Change Passcode
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={lock}>
              <LogOut size={16} /> Lock App
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Download size={16} className="text-income" /> Backup & Export
          </h2>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={handleExportEncrypted} disabled={exporting}>
              <Shield size={16} /> Export Encrypted Backup
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleExportCSV} disabled={exporting}>
              <FileText size={16} /> Export CSV
            </Button>
            <p className="text-[10px] text-text-muted">Encrypted backup is recommended for security. CSV is plain text.</p>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Upload size={16} className="text-accent" /> Import
          </h2>
          <Button variant="outline" className="w-full justify-start" onClick={handleImport} disabled={importing}>
            <Upload size={16} /> Import Backup File
          </Button>
          <p className="text-[10px] text-text-muted mt-2">Supports encrypted (.enc.json) and plain JSON files.</p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold mb-3">Categories</h2>
          <Button variant="outline" className="w-full justify-start" onClick={() => setCatModalOpen(true)}>
            Manage Categories
          </Button>
        </Card>

        <Card className="border-danger/30">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-danger">
            <Trash2 size={16} /> Danger Zone
          </h2>
          <Button variant="destructive" className="w-full" onClick={() => setClearConfirm(true)}>
            Clear All Data
          </Button>
          <p className="text-[10px] text-text-muted mt-2">This will permanently delete all transactions, loans, and categories.</p>
        </Card>
      </div>

      <Modal open={passModalOpen} onOpenChange={setPassModalOpen} title="Change Passcode">
        <form onSubmit={handleChangePasscode} className="space-y-4">
          <div>
            <label htmlFor="old-pass" className="mb-1 block text-xs text-text-muted">Current Passcode</label>
            <Input id="old-pass" type="password" inputMode="numeric" value={oldPass} onChange={e => setOldPass(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="new-pass" className="mb-1 block text-xs text-text-muted">New Passcode</label>
            <Input id="new-pass" type="password" inputMode="numeric" value={newPass} onChange={e => setNewPass(e.target.value)} required />
          </div>
          {passError && <p className="text-xs text-expense" role="alert">{passError}</p>}
          {passSuccess && <p className="text-xs text-income">Passcode changed!</p>}
          <Button type="submit" className="w-full">Update Passcode</Button>
        </form>
      </Modal>

      <Modal open={catModalOpen} onOpenChange={setCatModalOpen} title="Manage Categories">
        <CategoryManager categories={categories} onChanged={refreshCats} />
      </Modal>

      <PassphraseModal
        open={exportPPOpen}
        onOpenChange={setExportPPOpen}
        title="Set Export Passphrase"
        description="This passphrase encrypts your backup. You'll need it to import later."
        confirmLabel="Export"
        onConfirm={doExportEncrypted}
      />

      <PassphraseModal
        open={importPPOpen}
        onOpenChange={(v) => { setImportPPOpen(v); if (!v) { setImporting(false); setPendingImportText(''); } }}
        title="Enter Backup Passphrase"
        description="Enter the passphrase used when this backup was exported."
        confirmLabel="Import"
        onConfirm={doImportEncrypted}
      />

      <ConfirmDialog
        open={clearConfirm}
        onOpenChange={setClearConfirm}
        title="Clear all data?"
        description="This action cannot be undone. All your transactions, loans, and categories will be permanently deleted."
        confirmLabel="Delete Everything"
        onConfirm={handleClearAll}
      />
    </div>
  );
}
