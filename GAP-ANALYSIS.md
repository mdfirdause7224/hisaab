# Hisaab — Comprehensive Gap Analysis

**Date:** 2 March 2026
**Analyst:** Automated code audit + manual review
**Scope:** Full codebase audit of `hisaab/` — 23 source files, 18 components, 4 library modules
**Build:** Vite 7.3.1, React 19, Tailwind 4, Recharts 3, Dexie 4, framer-motion 12

---

## Executive Summary — Top 5 Critical Gaps

| # | Gap | Severity | Impact | Recommended Fix |
|---|-----|----------|--------|-----------------|
| 1 | **No error handling on any DB write** | Critical | Silent data loss — user taps "Add Transaction", DB call throws (quota exceeded, schema mismatch), form closes with no feedback, no data saved | Wrap every `addTransaction`/`updateTransaction`/`addLoan`/`updateLoan` call in try/catch; show toast on failure; keep modal open |
| 2 | **Passcode screen `tryUnlock` always returns `true`** | Critical | `success` state (unlock icon) shows even on wrong passcode; confusing UX where user sees green check followed by shake | Fix `tryUnlock` to return the actual result from `unlock`, or remove `success` state and let `unlocked` from AuthContext drive the transition |
| 3 | **Data stored unencrypted at rest in IndexedDB** | High | Anyone with device access can open DevTools → Application → IndexedDB and read all transactions, notes, and loan details in plain text | Encrypt sensitive fields (amount, note, party) before writing to Dexie; decrypt on read; or encrypt the entire DB dump and store as a single encrypted blob |
| 4 | **Service worker caches only 4 static paths; JS/CSS bundles not precached** | High | App shell loads offline, but the actual React bundle (492 KB) is not precached — first offline visit after install shows a blank spinner forever | Precache hashed bundle filenames at build time using `vite-plugin-pwa` or inject the manifest into `sw.js`; use a network-first strategy for the index and cache-first for hashed assets |
| 5 | **No error boundary anywhere in the app** | High | Any runtime error in a lazy-loaded route (e.g., malformed date in IndexedDB) crashes the entire app with a white screen and no recovery path | Add a React Error Boundary wrapping `<Routes>` that shows a "Something went wrong" screen with a "Reload" button |

---

## Full Gap Log

### GAP-001: `tryUnlock` always returns `true`
- **Severity:** Critical
- **File:** `src/components/Auth/PasscodeScreen.jsx:41-44`
- **Evidence:**
  ```js
  const tryUnlock = async (val) => {
    await unlock(val);
    return true;  // ← always true regardless of outcome
  };
  ```
  `unlock()` is async and sets `error` state on failure, but `tryUnlock` ignores it. Line 34-36 then sets `success = true` unconditionally, showing the unlock icon even when the passcode is wrong.
- **Root cause:** `unlock` communicates failure via React state (`error`), not via return value. `tryUnlock` should check `unlocked` state or `unlock` should return a boolean.
- **Fix:**
  - Option A: Make `unlock` return `true`/`false` and use that.
  - Option B: Remove `success` state entirely; derive it from `unlocked`.
- **Priority:** P0 — breaks first impression

---

### GAP-002: No try/catch on any database write operation
- **Severity:** Critical
- **Files:** `TxForm.jsx:56-77`, `LoanForm.jsx`, `PaymentForm.jsx`, `CategoryManager.jsx`, `TxList.jsx:63-69`, `LoanList.jsx:80-86`
- **Evidence:** Every `handleSubmit` and `handleDelete` calls DB functions (`addTransaction`, `updateTransaction`, `deleteLoan`, etc.) without try/catch. If IndexedDB throws (quota exceeded, version mismatch, constraint violation), the error propagates uncaught, `setSaving(false)` is never reached, and the button stays disabled forever.
- **Root cause:** No error handling pattern established in the codebase.
- **Fix:**
  ```js
  try {
    await addTransaction({ id: generateId(), ...tx });
    onSaved?.();
    onOpenChange(false);
  } catch (err) {
    // show inline error or toast
  } finally {
    setSaving(false);
  }
  ```
- **Priority:** P0

---

### GAP-003: Data at rest is unencrypted in IndexedDB
- **Severity:** High
- **File:** `src/lib/db.js` (all CRUD functions write plain objects)
- **Evidence:** `crypto.js` contains encryption utilities but they are only used for export/import backups and passcode verification. The actual transaction, loan, and category records in IndexedDB are stored as plain JSON objects. Anyone with physical access or an XSS vulnerability can read all financial data via `indexedDB.open('HisaabDB')`.
- **Root cause:** Encryption was designed for backup/export only, not for at-rest storage.
- **Fix (two options):**
  - **Field-level:** Encrypt `note`, `amount`, `party` fields before Dexie `.add()` using the derived key held in memory. Decrypt in `getAll*` functions. Indexes on encrypted fields won't work, so keep `type`, `date`, `categoryId` as plaintext (non-sensitive).
  - **Full-DB:** On lock, serialize the entire DB and encrypt it. On unlock, decrypt and rehydrate. Simpler but slower for large datasets.
- **Priority:** P0 — stated security goal of the product

---

### GAP-004: Service worker does not precache JS/CSS bundles
- **Severity:** High
- **File:** `public/sw.js:2`
- **Evidence:**
  ```js
  const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg'];
  ```
  Production build outputs hashed files like `index-aKRJv633.js` (493 KB) and `index-CsUXusLW.css` (31 KB). These are not in the precache list. On first offline visit the app shell loads but React never bootstraps because the JS bundle is not cached.
- **Root cause:** Manual SW doesn't know about Vite's hashed output filenames.
- **Fix:** Use `vite-plugin-pwa` (wraps Workbox) which auto-generates a precache manifest from the build output. Alternatively, use Workbox's `injectManifest` mode with the existing `sw.js` as a template.
  ```bash
  npm install -D vite-plugin-pwa
  ```
  ```js
  // vite.config.js
  import { VitePWA } from 'vite-plugin-pwa';
  plugins: [react(), tailwindcss(), VitePWA({ registerType: 'autoUpdate' })]
  ```
- **Priority:** P0 — PWA offline is a stated product goal

---

### GAP-005: No React Error Boundary
- **Severity:** High
- **File:** `src/App.jsx`
- **Evidence:** `<Suspense>` catches loading states but not runtime errors. If any component throws (e.g., `parseISO(undefined)` from malformed data), the entire app white-screens.
- **Root cause:** No `componentDidCatch` / Error Boundary component exists.
- **Fix:** Create `src/components/UI/ErrorBoundary.jsx`:
  ```jsx
  import { Component } from 'react';
  class ErrorBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <FallbackUI onRetry={() => this.setState({ hasError: false })} />;
      return this.props.children;
    }
  }
  ```
  Wrap `<Routes>` inside it.
- **Priority:** P1

---

### GAP-006: `importAllData` does not validate schema
- **Severity:** High
- **File:** `src/lib/db.js:97-108`
- **Evidence:** `importAllData(data)` clears all tables then calls `bulkAdd` on whatever is in `data.transactions`, `data.categories`, etc. If the imported file has wrong field names, missing `id` fields, or injected garbage, the app corrupts silently. No rollback on partial failure since `bulkAdd` inside a Dexie transaction will rollback only on exception, but malformed-but-insertable records persist.
- **Root cause:** No schema validation layer.
- **Fix:**
  - Validate each record against expected shape before import.
  - At minimum check: `id` is string, `type` is one of `income|expense|loan`, `amount` is a positive number, `date` is a valid ISO string.
  - Show import summary before committing ("Found 150 transactions, 12 categories — Import?").
- **Priority:** P1

---

### GAP-007: `importEncrypted` silently overwrites the salt
- **Severity:** High
- **File:** `src/lib/crypto.js:88-93`
- **Evidence:**
  ```js
  export async function importEncrypted(jsonString, passphrase) {
    const { salt, iv, data } = JSON.parse(jsonString);
    localStorage.setItem(SALT_KEY, salt);  // ← overwrites current salt
    ...
  }
  ```
  After importing a backup made with a different passcode, the current passcode's salt is overwritten. The user can no longer unlock the app with their current passcode because `verifyPasscode` will derive a different key with the new salt.
- **Root cause:** Export embeds the salt; import blindly restores it.
- **Fix:** Use a separate, independent salt for exports. Do not touch the app's `SALT_KEY` during import. The export passphrase should derive its own key with its own embedded salt.
- **Priority:** P1

---

### GAP-008: No brute-force protection on passcode
- **Severity:** High
- **File:** `src/lib/AuthContext.jsx:12-34`
- **Evidence:** `unlock` can be called unlimited times with no delay, lockout, or attempt counter. A 4-digit numeric passcode has only 10,000 combinations. PBKDF2 at 200k iterations adds ~200ms per attempt, so brute-force completes in ~33 minutes.
- **Root cause:** No rate limiting implemented.
- **Fix:**
  - Add exponential backoff: 1s after 3 fails, 5s after 5, 30s after 8, wipe after 15.
  - Store attempt count in `localStorage` (survives refresh).
  - Show remaining attempts to user.
  ```js
  const MAX_ATTEMPTS = 10;
  const attempts = parseInt(localStorage.getItem('hisaab_attempts') || '0');
  if (attempts >= MAX_ATTEMPTS) { setError('Too many attempts. Data wiped.'); await clearAllData(); return; }
  ```
- **Priority:** P1

---

### GAP-009: `prompt()` used for export/import passphrase
- **Severity:** Medium
- **File:** `src/components/Settings/Settings.jsx:47,85`
- **Evidence:** `prompt('Set an export passphrase:')` and `prompt('Enter the backup passphrase:')` use the browser's native blocking dialog. On mobile browsers (especially iOS Safari), `prompt()` can be unreliable, ugly, and doesn't support password masking. It's also impossible to validate (min length, confirmation).
- **Root cause:** Quick implementation shortcut.
- **Fix:** Replace with a proper modal (`<Modal>`) containing a password input with confirmation field, min-length validation, and a show/hide toggle.
- **Priority:** P1

---

### GAP-010: CSV export doesn't escape commas or quotes in fields
- **Severity:** Medium
- **File:** `src/components/Settings/Settings.jsx:62-65`
- **Evidence:**
  ```js
  return `${tx.date},${tx.type},${tx.amount},${cat?.title || 'Other'},"${tx.note || ''}","${(tx.tags || []).join(';')}"`;
  ```
  If `tx.note` contains a double-quote character (`"`), the CSV will be malformed. Standard CSV requires doubling internal quotes (`""`) and quoting fields that contain commas.
- **Root cause:** No CSV escaping utility.
- **Fix:** Create a helper:
  ```js
  function csvEscape(val) {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }
  ```
- **Priority:** P2

---

### GAP-011: No recurring/repeat transaction support
- **Severity:** Medium
- **File:** Transaction schema in `db.js`, `TxForm.jsx`
- **Evidence:** The original spec calls for "Repeat (none / daily / weekly / monthly)" on transactions. The schema has no `repeat` or `recurrence` field, and TxForm has no repeat UI.
- **Root cause:** Feature not implemented.
- **Fix:**
  - Add `recurrence: { type: 'none'|'daily'|'weekly'|'monthly', endDate?: string }` to transaction schema.
  - On app load or dashboard render, generate pending instances for recurring transactions whose next date has passed.
  - Show recurring indicator (icon) on transaction cards.
- **Priority:** P2

---

### GAP-012: No receipt/attachment support
- **Severity:** Medium
- **File:** `db.js:9` — `blobs: 'id'` store defined but never used; `TxForm.jsx` has no file input
- **Evidence:** The spec calls for "Attach receipt (optional — keep as blob in IndexedDB)". The `blobs` table exists in the schema but no UI or logic writes to it. The `receiptBlobId` field from the spec is not in the transaction write path.
- **Root cause:** Feature not implemented.
- **Fix:**
  - Add a file input to TxForm (accept `image/*`).
  - On file select, read as `ArrayBuffer`, store in `blobs` table, link via `receiptBlobId` on the transaction.
  - Show receipt thumbnail on transaction cards; tap to view full.
  - Warn about storage quotas when total blob size exceeds 50 MB.
- **Priority:** P2

---

### GAP-013: Charts have no accessibility attributes
- **Severity:** Medium
- **Files:** `CashflowChart.jsx`, `Analytics.jsx`
- **Evidence:** Recharts SVG output has no `role="img"`, no `aria-label`, no `<title>` or `<desc>` elements. Screen readers see raw SVG paths with no semantic meaning. The spec explicitly calls for "aria-hidden charts with accessible summary text."
- **Root cause:** Recharts doesn't add ARIA attributes by default and no wrapper was added.
- **Fix:**
  ```jsx
  <div role="img" aria-label={`Cashflow chart showing balance trend over ${range} days`}>
    <ResponsiveContainer>...</ResponsiveContainer>
  </div>
  <p className="sr-only">Balance on day 30: ₹12,500. Trend: increasing.</p>
  ```
- **Priority:** P2

---

### GAP-014: NavBar `safe-area-pb` class is not defined
- **Severity:** Medium
- **File:** `src/components/UI/NavBar.jsx:18`
- **Evidence:** `className="... safe-area-pb"` — this is not a Tailwind utility and no custom class by this name exists in `index.css`. On iPhones with the home indicator bar, the bottom nav will be occluded.
- **Root cause:** Missing CSS rule.
- **Fix:** Add to `index.css`:
  ```css
  .safe-area-pb { padding-bottom: env(safe-area-inset-bottom, 0px); }
  ```
- **Priority:** P2 — affects all iPhone users

---

### GAP-015: No toast/notification system for user feedback
- **Severity:** Medium
- **Files:** All forms and actions
- **Evidence:** `@radix-ui/react-toast` is installed (in `package.json`) but never used. Success/failure feedback is either missing (forms just close) or uses `alert()` (Settings). The user gets no confirmation that a transaction was saved.
- **Root cause:** Toast infrastructure not wired up.
- **Fix:** Create a `ToastProvider` using Radix Toast at the app root. Expose a `useToast()` hook. Call `toast({ title: 'Transaction added' })` after successful saves.
- **Priority:** P2

---

### GAP-016: Category grid buttons and filter buttons lack ARIA attributes
- **Severity:** Medium
- **Files:** `TxForm.jsx`, `TxList.jsx`, `Analytics.jsx`, `CashflowChart.jsx`
- **Evidence:** Toggle-style buttons (type selector, filter, range picker) don't have `aria-pressed` or `role="radiogroup"` / `role="radio"`. Screen readers cannot communicate which option is selected.
- **Root cause:** Accessibility not audited.
- **Fix:** Add `aria-pressed={type === t.value}` to type buttons, `aria-pressed={filterType === t}` to filter buttons, etc.
- **Priority:** P2

---

### GAP-017: Labels not programmatically associated with inputs
- **Severity:** Medium
- **Files:** `TxForm.jsx`, `LoanForm.jsx`, `PaymentForm.jsx`
- **Evidence:** Labels use `<label className="...">Amount</label>` followed by `<Input>` but without `htmlFor` / `id` pairing. Clicking the label does not focus the input. Screen readers do not associate the label with the control.
- **Root cause:** `htmlFor`/`id` attributes omitted.
- **Fix:** Add `id` to each `<Input>` and matching `htmlFor` to each `<label>`.
- **Priority:** P2

---

### GAP-018: `PaymentForm` allows overpayment without warning
- **Severity:** Medium
- **File:** `src/components/Loans/PaymentForm.jsx`
- **Evidence:** User can enter a payment amount greater than the remaining balance. The payment is recorded, making `totalPaid > principal`. The progress bar will show >100% and the remaining balance will be negative.
- **Root cause:** No validation against remaining amount.
- **Fix:** Add `max={remaining}` to the amount input and validate on submit:
  ```js
  if (parseFloat(amount) > remaining) { setError('Amount exceeds remaining balance'); return; }
  ```
- **Priority:** P2

---

### GAP-019: `AmortizationSchedule` crashes on `termMonths = 0`
- **Severity:** Medium
- **File:** `src/components/Loans/LoanList.jsx:18-23`
- **Evidence:**
  ```js
  const months = loan.termMonths || 12;
  ```
  If `loan.termMonths` is `0` (falsy), it defaults to 12 — not a crash, but misleading. If someone sets termMonths to a very large number, the loop creates thousands of DOM rows.
- **Root cause:** No upper bound on loop iterations.
- **Fix:** Clamp: `const months = Math.min(Math.max(loan.termMonths || 12, 1), 360);`
- **Priority:** P3

---

### GAP-020: `useTransactions` hook has no error state
- **Severity:** Medium
- **File:** `src/lib/hooks.js:4-17`
- **Evidence:** If `getAllTransactions()` throws (DB corruption, version mismatch), the error propagates uncaught. `setLoading(false)` is never called, leaving the UI in a permanent loading state.
- **Fix:**
  ```js
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllTransactions();
      setTransactions(data);
    } catch (err) {
      setError(err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);
  ```
- **Priority:** P2

---

### GAP-021: `window.location.reload()` after import/clear
- **Severity:** Low
- **File:** `src/components/Settings/Settings.jsx:93,106`
- **Evidence:** Full page reload destroys React state and re-triggers passcode entry. The user is logged out and must re-enter their passcode after importing data or clearing data.
- **Root cause:** Shortcut to refresh all data hooks.
- **Fix:** Instead of reload, call `refresh()` on all hooks. Create a global `DataContext` that exposes a `refreshAll()` method, or use Dexie's live queries (`useLiveQuery`) which auto-update.
- **Priority:** P3

---

### GAP-022: `motion` import unused in several files
- **Severity:** Low
- **Files:** `TxForm.jsx:2` imports `motion` but never uses it. `Settings.jsx:2` imports `motion` but never uses it.
- **Evidence:** Dead imports increase bundle size marginally (tree-shaking handles most, but the import statement is still processed).
- **Fix:** Remove unused imports.
- **Priority:** P3

---

### GAP-023: Bundle size — main chunk is 493 KB gzipped 161 KB
- **Severity:** Medium
- **File:** Build output
- **Evidence:** The main `index-*.js` chunk is 493 KB (161 KB gzipped). On a 3G connection (~400 kbps), this takes ~3.2 seconds to download. The Recharts `CartesianChart` chunk is 326 KB (99 KB gzipped), loaded on first chart view.
- **Root cause:** Recharts is large (~250 KB minified). All Radix UI primitives are in the main bundle.
- **Fix:**
  - Consider `lightweight-charts` (TradingView, 45 KB) or `uplot` (35 KB) for the simple chart use cases.
  - Move Radix Dialog/AlertDialog to lazy chunks (they're only needed on user interaction).
  - Add `build.rollupOptions.output.manualChunks` to split Radix and framer-motion.
- **Priority:** P2

---

### GAP-024: No `<meta name="apple-mobile-web-app-capable">` for iOS PWA
- **Severity:** Low
- **File:** `index.html`
- **Evidence:** While `manifest.json` sets `display: standalone`, iOS Safari requires the legacy `<meta name="apple-mobile-web-app-capable" content="yes">` tag for full standalone mode.
- **Fix:** Add to `<head>`:
  ```html
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  ```
- **Priority:** P3

---

### GAP-025: No onboarding / first-run experience
- **Severity:** Medium
- **File:** N/A — feature missing
- **Evidence:** On first run, the user sees "Set your 4-digit passcode" — then immediately lands on an empty dashboard with no guidance. The spec calls for empty states with tips, but there's no walkthrough or contextual hints for first-time users.
- **Fix:**
  - After first passcode set, show a 2-3 step overlay: "Welcome to Hisaab" → "Tap + to add your first transaction" → "Swipe between tabs to explore".
  - Use framer-motion for step transitions.
  - Store `onboarded: true` in `meta` table to not show again.
- **Priority:** P2

---

### GAP-026: Category icons not rendered — stored as strings, never used
- **Severity:** Low
- **Files:** `db.js:14-26`, `TxForm.jsx:127-129`, `TxList.jsx:144-148`
- **Evidence:** Categories have an `icon` field (`'Utensils'`, `'Car'`, etc.) matching Lucide icon names, but no component renders them. Instead, a colored dot is shown in TxForm and the first letter of the category title is shown in TxList.
- **Root cause:** Dynamic Lucide icon rendering requires a lookup map; was skipped.
- **Fix:** Create an icon map:
  ```js
  import { Utensils, Car, ShoppingBag, ... } from 'lucide-react';
  const ICON_MAP = { Utensils, Car, ShoppingBag, ... };
  const IconComp = ICON_MAP[cat.icon];
  if (IconComp) return <IconComp size={16} />;
  ```
- **Priority:** P3

---

### GAP-027: No keyboard shortcut support
- **Severity:** Low
- **Evidence:** No global keyboard shortcuts exist. Desktop users cannot press `N` to add new transaction, `Esc` to close modals (Radix handles Esc natively, but other shortcuts are missing), `/` to focus search.
- **Fix:** Add a `useEffect` with `keydown` listener for common shortcuts. Low priority given mobile-first focus.
- **Priority:** P3

---

### GAP-028: `CategoryBars.onCategoryClick` result is ignored in Dashboard
- **Severity:** Low
- **File:** `Dashboard.jsx:132-134`
- **Evidence:** `CategoryBars` calls `onCategoryClick(item.id)` with the category ID, but Dashboard passes `() => navigate('/transactions')` — the category ID is discarded. The user expects tapping a category bar to filter transactions by that category.
- **Fix:** Pass category as search param: `navigate(`/transactions?category=${catId}`)` and read it in TxList.
- **Priority:** P3

---

### GAP-029: `user-scalable=no` in viewport meta
- **Severity:** Medium
- **File:** `index.html:5`
- **Evidence:** `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />` prevents pinch-to-zoom. This is a WCAG 1.4.4 failure (Resize Text) and hinders users with low vision.
- **Root cause:** Commonly added for "app-like" feel but violates accessibility.
- **Fix:** Change to `content="width=device-width, initial-scale=1.0"` — remove `maximum-scale` and `user-scalable=no`.
- **Priority:** P2

---

### GAP-030: No color-contrast validation on chart elements
- **Severity:** Low
- **Evidence:** Chart grid lines use `#1e293b` on `#0f172a` background — contrast ratio is 1.3:1 (below 3:1 minimum for non-text elements per WCAG 1.4.11). Axis text uses `#94a3b8` on `#0f172a` — contrast ratio is ~4.8:1 (passes AA for small text at 4.5:1 minimum, but the 10px font size is very small).
- **Fix:** Increase grid color to `#334155` (2.1:1 — still subtle but more visible). Increase axis font to at least 11px.
- **Priority:** P3

---

## UX Micro-Solutions

### Wireframe 1: Toast Notification System (Top 3 UX Impact)

```
┌──────────────────────────────┐
│  ✓ Transaction added         │  ← slides down from top
│     ₹500 · Food              │     auto-dismisses 3s
│                        Undo  │  ← undo within 3s window
└──────────────────────────────┘
```

Implementation: Wire up `@radix-ui/react-toast` (already installed). Position at top-center on mobile. Show on every create/update/delete with an undo option for deletes (soft-delete with 3s timer before hard-delete).

### Wireframe 2: Proper Passphrase Modal (replacing `prompt()`)

```
┌──────────────────────────────────┐
│  Export Backup                ✕  │
│                                  │
│  Set a passphrase to encrypt     │
│  your backup file.               │
│                                  │
│  Passphrase    [••••••••••] 👁   │
│  Confirm       [••••••••••] 👁   │
│                                  │
│  ⚠ Min 6 characters             │
│                                  │
│  [ Cancel ]    [ Export ]        │
└──────────────────────────────────┘
```

Implementation: New `<PassphraseModal>` component using existing `<Modal>` + `<Input type="password">` with visibility toggle. Validates min length and confirmation match before enabling Export button.

### Wireframe 3: First-Run Onboarding Overlay

```
Step 1/3:
┌──────────────────────────────────┐
│                                  │
│         💰                       │
│   Welcome to Hisaab              │
│   Your personal finance          │
│   tracker, 100% private.        │
│                                  │
│        [ Get Started → ]         │
│                                  │
└──────────────────────────────────┘

Step 2/3:
┌──────────────────────────────────┐
│   ↓ points to FAB               │
│   Tap the + button to add       │
│   your first transaction.       │
│                                  │
│        [ Next → ]                │
│                            [+]   │  ← FAB highlighted
└──────────────────────────────────┘

Step 3/3:
┌──────────────────────────────────┐
│   Export backups regularly       │
│   from Settings to keep          │
│   your data safe.               │
│                                  │
│        [ Done ✓ ]                │
└──────────────────────────────────┘
```

Implementation: Overlay component with framer-motion page transitions. Store `onboarded: true` in Dexie `meta` table. Show only once.

---

## Technical Fix Recommendations

### Storage Schema Improvements

```js
// db.js — v2 migration adding recurrence, receiptBlobId, and compound index
db.version(2).stores({
  transactions: 'id, type, date, categoryId, *tags, recurrence.type',
  categories: 'id, title',
  loans: 'id, party, direction',
  blobs: 'id',
  meta: 'key',
}).upgrade(tx => {
  return tx.table('transactions').toCollection().modify(t => {
    if (!t.recurrence) t.recurrence = { type: 'none' };
  });
});
```

### Service Worker — Proper Precaching

```js
// Use Workbox via vite-plugin-pwa
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [{
          urlPattern: /^https:\/\/fonts\./,
          handler: 'CacheFirst',
          options: { cacheName: 'fonts', expiration: { maxEntries: 10 } }
        }]
      },
      manifest: {
        name: 'Hisaab — Personal Finance',
        short_name: 'Hisaab',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      }
    })
  ]
});
```

### Brute-Force Protection

```js
// crypto.js addition
const ATTEMPT_KEY = 'hisaab_attempts';
const LOCKOUT_KEY = 'hisaab_lockout';

export function checkRateLimit() {
  const lockUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0');
  if (Date.now() < lockUntil) {
    const secs = Math.ceil((lockUntil - Date.now()) / 1000);
    return { allowed: false, waitSeconds: secs };
  }
  return { allowed: true, waitSeconds: 0 };
}

export function recordAttempt(success) {
  if (success) {
    localStorage.removeItem(ATTEMPT_KEY);
    localStorage.removeItem(LOCKOUT_KEY);
    return;
  }
  const attempts = parseInt(localStorage.getItem(ATTEMPT_KEY) || '0') + 1;
  localStorage.setItem(ATTEMPT_KEY, String(attempts));
  // Exponential backoff: 2s, 5s, 15s, 60s, 300s
  const delays = [0, 0, 0, 2000, 5000, 15000, 60000, 300000];
  const delay = delays[Math.min(attempts, delays.length - 1)];
  if (delay > 0) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + delay));
  }
}
```

### Chart Performance Optimization

```jsx
// For large datasets (1000+ transactions), memoize chart data computation
// and limit rendered data points

const MAX_CHART_POINTS = 90;

const data = useMemo(() => {
  // ... existing computation ...
  // If more than MAX_CHART_POINTS, sample evenly
  if (result.length > MAX_CHART_POINTS) {
    const step = Math.ceil(result.length / MAX_CHART_POINTS);
    return result.filter((_, i) => i % step === 0 || i === result.length - 1);
  }
  return result;
}, [transactions, range]);
```

---

## Acceptance Criteria / Validation Checklist

### For Engineers

| # | Test | Pass Criteria |
|---|------|---------------|
| 1 | Enter wrong passcode 5 times | See increasing delay; error message shows "Try again in Xs" |
| 2 | Open DevTools → IndexedDB → HisaabDB → transactions | Sensitive fields (note, amount) should be encrypted or not readable as plain text |
| 3 | Add transaction, close modal | Toast appears "Transaction added"; transaction visible in list immediately |
| 4 | Airplane mode → reload app | App loads fully with cached shell + JS bundle; can add transactions offline |
| 5 | Import a malformed JSON file | Error toast/alert; no data is wiped; existing data intact |
| 6 | Import an encrypted backup | Modal asks for passphrase (not `prompt()`); wrong passphrase shows error; correct passphrase imports |
| 7 | Export CSV with note containing commas and quotes | Open in Excel/Sheets; all fields correctly delimited |
| 8 | Screen reader (VoiceOver/TalkBack) on Dashboard | Charts have role="img" with descriptive label; all buttons announce their purpose |
| 9 | Pinch to zoom on mobile | Zoom works (no `user-scalable=no`) |
| 10 | Add 500+ transactions → open Dashboard | Chart renders in <1s; no visible lag on scroll |
| 11 | Delete a transaction | Toast with "Undo" appears; undo within 3s restores it |
| 12 | Loan payment > remaining balance | Error shown; payment not recorded |

### Suggested Automated Checks

- **Unit tests:** `crypto.js` (deriveKey → encrypt → decrypt roundtrip), `db.js` (CRUD operations), CSV escaping
- **Integration tests:** Full add-transaction flow, passcode verification, import/export roundtrip
- **E2E (Playwright):** Passcode entry, add expense, view in list, export, re-import, verify data
- **Lighthouse PWA audit:** Score ≥90 on PWA category
- **axe-core accessibility scan:** 0 critical/serious violations

---

## Severity / Effort Matrix

```
                    Low Effort          Medium Effort         High Effort
                ┌─────────────────┬─────────────────────┬──────────────────┐
  Critical      │ GAP-001 (fix    │ GAP-002 (try/catch  │ GAP-003 (encrypt │
                │ tryUnlock)      │ all DB writes)      │ at rest)         │
                ├─────────────────┼─────────────────────┼──────────────────┤
  High          │ GAP-005 (error  │ GAP-004 (SW precache│ GAP-006 (import  │
                │ boundary)       │ via vite-plugin-pwa)│ validation)      │
                │ GAP-007 (salt   │ GAP-008 (brute-force│                  │
                │ fix)            │ protection)         │                  │
                ├─────────────────┼─────────────────────┼──────────────────┤
  Medium        │ GAP-014 (safe   │ GAP-009 (passphrase │ GAP-011 (recur-  │
                │ area)           │ modal)              │ ring txns)       │
                │ GAP-016 (ARIA)  │ GAP-015 (toasts)    │ GAP-012 (receipt │
                │ GAP-017 (labels)│ GAP-025 (onboarding)│ attachments)     │
                │ GAP-022 (unused │ GAP-023 (bundle     │                  │
                │ imports)        │ optimization)       │                  │
                │ GAP-029 (zoom)  │ GAP-010 (CSV escape)│                  │
                ├─────────────────┼─────────────────────┼──────────────────┤
  Low           │ GAP-024 (iOS    │ GAP-026 (cat icons) │ GAP-027 (kbd     │
                │ meta)           │ GAP-028 (cat filter │ shortcuts)       │
                │ GAP-030 (chart  │ passthrough)        │                  │
                │ contrast)       │ GAP-021 (no reload) │                  │
                │ GAP-019 (term   │                     │                  │
                │ clamp)          │                     │                  │
                └─────────────────┴─────────────────────┴──────────────────┘
```

**Recommended sprint plan:**
1. **Sprint 1 (Quick wins):** GAP-001, 002, 005, 007, 014, 016, 017, 022, 029 — all low-effort, high/critical impact
2. **Sprint 2 (Core reliability):** GAP-004, 008, 009, 015, 020 — medium effort, foundational
3. **Sprint 3 (Security + data):** GAP-003, 006, 010, 025 — high effort, security goals
4. **Sprint 4 (Features):** GAP-011, 012, 026, 028 — new functionality

---

## Appendix

### Tools Used
- Static code analysis: manual line-by-line review of all 23 source files
- Build analysis: `vite build` output (chunk sizes, dependency graph)
- Dependency audit: `npm ls --depth=0`

### Test Environment
- OS: Windows 10 (10.0.26200)
- Node.js: v22.13.1
- Build tool: Vite 7.3.1
- Browser target: Chromium (latest), inferred Safari/Firefox compatibility from API usage

### Assumptions
- No backend/API is planned — all storage is client-side IndexedDB
- Single user only — no multi-device sync
- Passcode `1011` is the default; security evaluation considers this fixed
- Currency hardcoded to INR; no multi-currency support evaluated
- No telemetry or analytics endpoints exist; none recommended per privacy stance

### Files Audited (23 total)
```
vite.config.js, index.html, public/manifest.json, public/sw.js
src/main.jsx, src/index.css, src/App.jsx
src/lib/utils.js, src/lib/crypto.js, src/lib/db.js, src/lib/hooks.js, src/lib/AuthContext.jsx
src/components/Auth/PasscodeScreen.jsx
src/components/Dashboard/Dashboard.jsx
src/components/Transactions/TxForm.jsx, src/components/Transactions/TxList.jsx
src/components/Loans/LoanForm.jsx, src/components/Loans/PaymentForm.jsx, src/components/Loans/LoanList.jsx
src/components/Analytics/Analytics.jsx
src/components/Charts/CashflowChart.jsx, src/components/Charts/CategoryBars.jsx
src/components/Settings/Settings.jsx, src/components/Settings/CategoryManager.jsx
src/components/UI/Modal.jsx, src/components/UI/Button.jsx, src/components/UI/Input.jsx
src/components/UI/Card.jsx, src/components/UI/Badge.jsx, src/components/UI/Fab.jsx
src/components/UI/EmptyState.jsx, src/components/UI/ConfirmDialog.jsx, src/components/UI/NavBar.jsx
```
