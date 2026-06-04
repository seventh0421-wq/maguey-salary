# Firestore Security Specification

This security specification details the access control and data integrity rules for the RP Store Payroll Application.

## Data Invariants
1. **Clerks collection**: Clerk IDs must be valid usernames (`^[a-zA-Z0-9_\u4e00-\u9fa5\-]+$`) to prevent injection.
2. **Payroll Entries**:
   - `meatJerkyCount` must be non-negative and is bounded.
   - `salaryRate` must be a positive integer matching the current valid exchange rate (generally 24000).
   - `totalSalary` must always exactly equal `meatJerkyCount * salaryRate`.
   - `isVerified` can be changed only by administrators (managers).
   - `isPaid` can be changed only by administrators (managers) and only when `isVerified == true`.
   - `createdAt` is immutable.
   - All timestamps must match the server-side time.

---

## The "Dirty Dozen" Payloads (Anti-Invariance Samples)

1. **Self-Verification Attack**: Clerk tries to write/update their own payroll entry setting `isVerified = true`.
2. **Price Inflation Attack**: Clerk submits a custom `salaryRate = 1000000` to inflate their payout.
3. **Ghost Fields Injection**: Clerk adds structural payload fields (`role = 'admin'`) inside their document.
4. **Time Spoofing Attack**: Clerk sets a future or backdated `createdAt` timestamp.
5. **Zero-Jerky Multi-Millions Payout**: Clerk submits `meatJerkyCount = 1` and `totalSalary = 24000000`.
6. **Negative Jerky Tax Siphon**: Clerk submits a negative count (`meatJerkyCount = -100`) to glitch totals.
7. **Bypass Verification on Payout**: Clerk sets `isPaid = true` directly without setting `isVerified` to correct status first.
8. **Orphaned Entry Injection**: Adding entries containing invalid reference IDs with extreme sizing (e.g. 1000 character ID).
9. **Admin Overwrite on Safe Settings**: Clerk modifies `settings/config` variables directly to crash the system rates.
10. **Foreign Record Modification**: Clerk tries to modify another clerk's existing pending entries.
11. **Immutable Date Hijacking**: Clerk attempts to change the `createdAt` timestamp on an existing verified entry.
12. **Anonymous Entry Spam**: Unauthenticated client attempting to populate the payroll list.

---

## Target Security Rules (`firestore.rules`)
To handle these guards, we enforce strict attribute-based controls, type checks, and operation validation gates on all writes.
Since our RP application uses identity-based roles (the store group uses a local PIN or Admin mode, and standard client writes are allowed for simple, fast gaming RP interactions but strictly validated for state logic), our security rules will allow clerks to write new pending entries, but only admins can verify or payout.
