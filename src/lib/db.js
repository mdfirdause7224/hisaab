import Dexie from 'dexie';

export const db = new Dexie('HisaabDB');

db.version(1).stores({
  transactions: 'id, type, date, categoryId, *tags',
  categories: 'id, title',
  loans: 'id, party',
  blobs: 'id',
  meta: 'key',
});

// GAP-011: v2 adds recurrence field
db.version(2).stores({
  transactions: 'id, type, date, categoryId, *tags',
  categories: 'id, title',
  loans: 'id, party, direction',
  blobs: 'id',
  meta: 'key',
}).upgrade(tx => {
  return tx.table('transactions').toCollection().modify(t => {
    if (!t.recurrence) t.recurrence = 'none';
  });
});

export const DEFAULT_CATEGORIES = [
  { id: 'cat_food', title: 'Food', icon: 'Utensils', color: '#F59E0B' },
  { id: 'cat_transport', title: 'Transport', icon: 'Car', color: '#3B82F6' },
  { id: 'cat_shopping', title: 'Shopping', icon: 'ShoppingBag', color: '#EC4899' },
  { id: 'cat_bills', title: 'Bills', icon: 'FileText', color: '#EF4444' },
  { id: 'cat_salary', title: 'Salary', icon: 'Banknote', color: '#22C55E' },
  { id: 'cat_interest', title: 'Interest', icon: 'Percent', color: '#A855F7' },
  { id: 'cat_transfers', title: 'Transfers', icon: 'ArrowLeftRight', color: '#06B6D4' },
  { id: 'cat_entertainment', title: 'Entertainment', icon: 'Music', color: '#F97316' },
  { id: 'cat_health', title: 'Health', icon: 'Heart', color: '#14B8A6' },
  { id: 'cat_education', title: 'Education', icon: 'GraduationCap', color: '#8B5CF6' },
  { id: 'cat_rent', title: 'Rent', icon: 'Home', color: '#64748B' },
  { id: 'cat_other', title: 'Other', icon: 'MoreHorizontal', color: '#94A3B8' },
];

export async function seedDefaults() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
  const meta = await db.meta.get('init');
  if (!meta) {
    await db.meta.put({ key: 'init', createdAt: new Date().toISOString() });
  }
}

export async function getAllTransactions() {
  return db.transactions.orderBy('date').reverse().toArray();
}

export async function addTransaction(tx) {
  return db.transactions.add(tx);
}

export async function updateTransaction(id, changes) {
  return db.transactions.update(id, changes);
}

export async function deleteTransaction(id) {
  return db.transactions.delete(id);
}

export async function getAllCategories() {
  return db.categories.toArray();
}

export async function addCategory(cat) {
  return db.categories.add(cat);
}

export async function updateCategory(id, changes) {
  return db.categories.update(id, changes);
}

export async function deleteCategory(id) {
  return db.categories.delete(id);
}

export async function getAllLoans() {
  return db.loans.toArray();
}

export async function addLoan(loan) {
  return db.loans.add(loan);
}

export async function updateLoan(id, changes) {
  return db.loans.update(id, changes);
}

export async function deleteLoan(id) {
  return db.loans.delete(id);
}

export async function exportAllData() {
  const [transactions, categories, loans, meta] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.loans.toArray(),
    db.meta.toArray(),
  ]);
  return { transactions, categories, loans, meta, exportedAt: new Date().toISOString() };
}

// GAP-006: Validate imported data structure
function validateRecord(rec, requiredFields) {
  if (!rec || typeof rec !== 'object') return false;
  return requiredFields.every(f => rec[f] !== undefined);
}

export function validateImportData(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['Invalid data format'];

  if (data.transactions) {
    if (!Array.isArray(data.transactions)) errors.push('transactions must be an array');
    else data.transactions.forEach((t, i) => {
      if (!validateRecord(t, ['id', 'type', 'amount', 'date'])) errors.push(`Transaction ${i}: missing id/type/amount/date`);
      if (t.type && !['income', 'expense', 'loan'].includes(t.type)) errors.push(`Transaction ${i}: invalid type "${t.type}"`);
      if (typeof t.amount !== 'number' || t.amount < 0) errors.push(`Transaction ${i}: invalid amount`);
    });
  }
  if (data.categories) {
    if (!Array.isArray(data.categories)) errors.push('categories must be an array');
    else data.categories.forEach((c, i) => {
      if (!validateRecord(c, ['id', 'title'])) errors.push(`Category ${i}: missing id/title`);
    });
  }
  if (data.loans) {
    if (!Array.isArray(data.loans)) errors.push('loans must be an array');
    else data.loans.forEach((l, i) => {
      if (!validateRecord(l, ['id', 'party', 'principal'])) errors.push(`Loan ${i}: missing id/party/principal`);
    });
  }
  return errors;
}

export async function importAllData(data) {
  const errors = validateImportData(data);
  if (errors.length > 0) throw new Error('Validation failed:\n' + errors.slice(0, 5).join('\n'));

  await db.transaction('rw', db.transactions, db.categories, db.loans, db.meta, async () => {
    await db.transactions.clear();
    await db.categories.clear();
    await db.loans.clear();
    await db.meta.clear();
    if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
    if (data.categories?.length) await db.categories.bulkAdd(data.categories);
    if (data.loans?.length) await db.loans.bulkAdd(data.loans);
    if (data.meta?.length) await db.meta.bulkAdd(data.meta);
  });
}

export async function clearAllData() {
  await db.transaction('rw', db.transactions, db.categories, db.loans, db.meta, async () => {
    await db.transactions.clear();
    await db.categories.clear();
    await db.loans.clear();
    await db.meta.clear();
  });
}
