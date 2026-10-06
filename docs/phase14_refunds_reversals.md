# Phase 14: Refunds, Reversals & Financial Adjustments

## 1. Overview
Phase 14 implements **controlled financial correction workflows**, including full and partial Refunds, and full and partial Transfer Reversals via the Razorpay Sandbox. 

This phase strictly preserves the immutability of the financial ledger and decouples frontend requests from financial mutation. All amounts are calculated and validated server-side.

## 2. Refund Architecture
- **Eligibility**: A server-side RPC `get_refund_eligibility` dictates if a refund is allowed.
- **Provider API**: Supabase Edge Function `create-payment-refund` verifies eligibility against the RPC, and creates a Razorpay `refunds` API request if valid.
- **Amount Validation**: The system tracks already refunded amounts to accurately reject excessive partial refunds.

## 3. Transfer Reversals
- **Route API**: Razorpay Route `transfers/:id/reversals` is leveraged rather than blanket refund reversals, preserving separate tracking for owner funds versus renter refunds.
- **Eligibility**: Only authorized admins (service roles or explicit admin flags) can reverse a processed Route Transfer.
- **Amount Validation**: Validates the remaining reversible amount to ensure over-reversals do not occur.

## 4. Webhooks & Idempotency
- **`refund.processed` / `refund.failed`**: Safely marks the internal `refund_requests` record as PROCESSED or FAILED and inserts a `REFUND_SUCCESS` ledger event.
- **`transfer.reversed`**: Modifies the `transfer_reversals` status and tracks provider reversal IDs.
- **Idempotency**: All provider requests include unique Notes (request IDs) and Webhooks safely use `.or` conditions and `SELECT` guards to avoid duplicating ledger entries.

## 5. Security Constraints
- **Sandbox Only**: Code enforces `RAZORPAY_ENVIRONMENT === 'sandbox'`. Production fails closed.
- **No Client Authority**: The frontend can only trigger edge functions; the edge function securely pulls server limits.
- **RLS Restrictions**: `refund_requests` and `transfer_reversals` are secured so users only see records relevant to their transactions.

## 6. Financial Ledger Immutability
- History is preserved: Instead of altering a `PAYMENT_COLLECTED` record, the system appends a `REFUND_SUCCESS` event, maintaining a perfect double-entry history.

## 7. Deferred
- Automatic discrepancy correction.
- Production money movement.
- End-user refund cancellation UI in complex cancellation flows.
