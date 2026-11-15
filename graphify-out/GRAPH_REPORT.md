# Graph Report - A_tier_management  (2026-11-15)

## Corpus Check
- 30 files · ~61,501 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 276 nodes · 901 edges · 10 communities
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- DealsFinancePage
- AuthProvider
- AdminPage
- AttendanceProvider
- package.json
- useAuth
- getTodayDateString
- AdminPage.jsx
- supabase.js
- exportToCSV

## God Nodes (most connected - your core abstractions)
1. `AdminPage()` - 50 edges
2. `useAuth()` - 33 edges
3. `getTodayDateString()` - 27 edges
4. `DealsFinancePage()` - 27 edges
5. `getStudioSettings()` - 26 edges
6. `react` - 26 edges
7. `ProspectDetailDrawer()` - 25 edges
8. `formatCurrency()` - 25 edges
9. `AttendancePage()` - 22 edges
10. `App()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `handleSettingsUpdated()` --calls--> `getStudioSettings()`  [EXTRACTED]
  src/components/Layout/DashboardLayout.jsx → src/lib/supabase.js
- `handleSettingsUpdated()` --calls--> `getStudioSettings()`  [EXTRACTED]
  src/pages/AttendancePage.jsx → src/lib/supabase.js
- `handleAddTouchpoint()` --calls--> `getTodayDateString()`  [EXTRACTED]
  src/components/Prospects/ProspectDetailDrawer.jsx → src/lib/supabase.js
- `handleSettingsUpdated()` --calls--> `getStudioSettings()`  [EXTRACTED]
  src/context/NotificationsContext.jsx → src/lib/supabase.js
- `DashboardLayout()` --calls--> `pauseWork()`  [EXTRACTED]
  src/components/Layout/DashboardLayout.jsx → src/context/AttendanceContext.jsx

## Import Cycles
- None detected.

## Communities (10 total, 0 thin omitted)

### Community 0 - "DealsFinancePage"
Cohesion: 0.20
Nodes (10): ProspectDetailDrawer(), handleAddTouchpoint(), handleChange(), handleSetFollowUpPreset(), formatCurrency(), getOffsetDateString(), getPaymentBadgeClass(), DealsFinancePage() (+2 more)

### Community 1 - "AuthProvider"
Cohesion: 0.25
Nodes (19): handleLogout(), AuthProvider(), adminCreateUser(), adminDeleteUser(), adminUpdateUser(), deleteAccount(), fetchSupabaseProfile(), handleAuthStorageSync() (+11 more)

### Community 2 - "AdminPage"
Cohesion: 0.12
Nodes (27): updateProspect(), saveStudioSettings(), AdminPage(), checkProspectDuplicate(), checkWorkHourCorrelation(), handleAddManualLogSubmit(), handleAddUserSubmit(), handleBatchVerifyAuditDate() (+19 more)

### Community 3 - "AttendanceProvider"
Cohesion: 0.14
Nodes (25): AttendanceProvider(), adminAddManualLog(), adminDeleteLog(), adminForceStopLog(), adminUpdateLog(), finishWork(), pauseWork(), persistLocal() (+17 more)

### Community 4 - "package.json"
Cohesion: 0.10
Nodes (23): dependencies, bootstrap@^5.3.3, lucide-react@^0.475.0, react@^18.3.1, react-dom@^18.3.1, react-router-dom@^7.1.5, @supabase/supabase-js@^2.49.1, devDependencies (+15 more)

### Community 5 - "useAuth"
Cohesion: 0.08
Nodes (43): react, react-router-dom, AdminRoute(), App(), ProtectedRoute(), PublicAuthRoute(), DashboardLayout(), handleSettingsUpdated() (+35 more)

### Community 6 - "getTodayDateString"
Cohesion: 0.10
Nodes (26): AddPaymentAccountModal(), handleSubmit(), InvoiceModal(), handleCopySummaryText(), PaymentAccountsList(), handleDelete(), MAX_PAYMENT_ACCOUNTS, PaymentAccountsContext (+18 more)

### Community 7 - "AdminPage.jsx"
Cohesion: 0.20
Nodes (18): handleSubmit(), useProspects(), calculateCommission(), DELIVERY_CHECKLIST_ITEMS, formatRupiah(), formatUSD(), getStudioSettings(), syncStudioSettingsFromSupabase() (+10 more)

### Community 8 - "supabase.js"
Cohesion: 0.19
Nodes (19): lucide-react, CURRENCIES, DEAL_MANAGEMENT_TYPES, DEFAULT_COMMISSION_RATES, getFollowUpBadgeMeta(), getFollowUpStatus(), getPlatformBadgeClass(), getStatusBadgeClass() (+11 more)

### Community 9 - "exportToCSV"
Cohesion: 0.27
Nodes (7): AnalyticsModal(), handleExportDealsCSV(), AddProspectModal(), exportToCSV, handleExportDealsCSV(), ProspectsPage(), handleExportCSV()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AdminPage()` connect `AdminPage` to `DealsFinancePage`, `AttendanceProvider`, `useAuth`, `getTodayDateString`, `AdminPage.jsx`, `exportToCSV`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Should `AdminPage` be split into smaller, more focused modules?**
  _Cohesion score 0.11827956989247312 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `useAuth` to `DealsFinancePage`, `AdminPage`, `AttendanceProvider`, `getTodayDateString`, `AdminPage.jsx`, `supabase.js`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Should `AttendanceProvider` be split into smaller, more focused modules?**
  _Cohesion score 0.1402116402116402 - nodes in this community are weakly interconnected._
- **Why does `App()` connect `useAuth` to `DealsFinancePage`, `AuthProvider`, `AdminPage`, `AttendanceProvider`, `getTodayDateString`, `AdminPage.jsx`, `exportToCSV`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.07615018508725542 - nodes in this community are weakly interconnected._