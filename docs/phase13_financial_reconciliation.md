# Phase 13: Financial Reconciliation & Transaction Control Plane

## 1. Overview
Phase 13 establishes a comprehensive Financial Observability and Control Layer for Rentitout. It verifies the alignment between internal financial records and the payment provider (Razorpay Route) without silently manufacturing a matching state.

**Important Note:** Phase 13 does NOT automatically correct financial discrepancies. Phase 13 does NOT execute refunds or reversals. Phase 13 does NOT perform Production money movement.

## 2. Reconciliation Architecture

### Source-of-Truth Hierarchy
1. **Provider**: Authoritative for provider-side state (Razorpay).
2. **Database Financial Records**: Authoritative for Rentitout's internal accounting history (ledger, payments).
3. **Reconciliation**: Determines whether those sources agree. It identifies discrepancies but DOES NOT overwrite the source of truth to force a match.

### Database Schema
A new table `financial_reconciliation` has been introduced.
It captures:
- Links to `booking_id`, `payment_id`, and `route_transfer_id`
- States from payments, transfers, and settlements
- `reconciliation_status` (MATCHED, PENDING, DISCREPANCY, FAILED, UNKNOWN)
- `discrepancy_type` and `discrepancy_message`

## 3. Amount Reconciliation
The system validates the following equations securely in integer paise:
- Booking total amount == Payment captured amount
- Platform Commission + Owner Amount == Payment captured amount
- Route Transfer amount == Payment captured amount
- Route Transfer owner amount == Route Transfer gross minus commission

## 4. Provider Reconciliation
- Verifies that `payout_profiles.provider_account_id` matches the `route_transfers.provider_account_id`.
- Validates the owner identity chain across Listings, Bookings, Payments, and Transfers.

## 5. Ledger Reconciliation
- Checks for the presence of immutable ledger events mapped to the booking lifecycle (e.g., `PAYMENT_COLLECTED`, `OWNER_ENTITLEMENT_CREATED`, `TRANSFER_CREATED`, `OWNER_SETTLED`).
- Misses in the ledger will result in a `LEDGER_MISMATCH` discrepancy.

## 6. Discrepancy Model
- `AMOUNT_MISMATCH`
- `PAYMENT_MISMATCH`
- `TRANSFER_MISMATCH`
- `PROVIDER_ACCOUNT_MISMATCH`
- `LEDGER_MISMATCH`

## 7. Admin Control Plane
- Accessible via `/admin/financials`.
- Allows admins to trigger batch reconciliations (`reconcile_pending_financials()`).
- Summarizes the number of Matched, Pending, Discrepancy, and Failed records.
- Provides a comprehensive table detailing the states and explicit discrepancy messages.

## 8. Owner Transaction History
- Owner Dashboard (`/dashboard/payouts`) now explicitly exposes `Reconciliation Status` alongside Transfer History.
- It omits sensitive system details, only surfacing statuses (e.g., MATCHED, DISCREPANCY, PENDING).

## 9. Security & Idempotency
- All reconciliation logic lives in `SECURITY DEFINER` RPCs (`reconcile_booking_financials`, `reconcile_pending_financials`).
- Re-running reconciliation updates the snapshot safely via an `ON CONFLICT` upsert mechanism.
- Regular users cannot view other owners' reconciliations, enforcing robust Row-Level Security (RLS).
- **Sandbox Boundary:** Production money movement remains locked; environment checks ensure fail-closed safety.

## 10. Future Production Considerations
- Discrepancy Resolution workflows (e.g., Refunds, Adjustments) are explicitly deferred.
- Production Route activation requires physical KYC and actual production verification.
