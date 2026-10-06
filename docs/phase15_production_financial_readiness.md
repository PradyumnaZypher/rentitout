# Phase 15: Production Financial Readiness & Full Provider E2E Audit

## 1. Complete Financial Architecture

### State Diagrams

**Booking**
```text
PENDING → ACCEPTED → COMPLETED
  ↓           ↓
CANCELLED   CANCELLED
  ↓
DECLINED
```

**Payment**
```text
CREATED → PAID → REFUNDED
```

**Route Transfer**
```text
CREATED → PROCESSED → SETTLED
              ↓
           FAILED
              ↓
           REVERSED
```

**Refund Request**
```text
REQUESTED → PROCESSING → PROCESSED
              ↓
           FAILED
```

**Transfer Reversal**
```text
REQUESTED → PROCESSING → PROCESSED
              ↓
           FAILED
```

**Reconciliation**
```text
MATCHED | PENDING | DISCREPANCY | FAILED | UNKNOWN
```

## 2. The Complete Money Flow

**Successful Booking to Settlement**
```text
Renter
 ↓
Booking created (PENDING)
 ↓
Payment Order (CREATED)
 ↓
Razorpay Sandbox Checkout (PAID)
 ↓
Webhook verifies payment
 ↓
PAYMENT_COLLECTED (Ledger)
 ↓
Booking Completed
 ↓
OWNER_ENTITLEMENT_CREATED (Ledger)
 ↓
COMMISSION_CALCULATED (Ledger)
 ↓
Route Transfer created (PROCESSED)
 ↓
Settlement Hold (ON_HOLD)
 ↓
Settlement Release Request (RELEASE_REQUESTED)
 ↓
Provider Settlement Confirmation (SETTLED)
```

**Refund Flow**
```text
Booking Paid
 ↓
Refund Eligibility (Server-side RPC)
 ↓
Refund Request (REQUESTED)
 ↓
Razorpay Refund API
 ↓
Refund Webhook (PROCESSED)
 ↓
REFUND_SUCCESS (Ledger)
 ↓
Reconciliation (MATCHED)
```

**Reversal Flow**
```text
Transfer Processed
 ↓
Reversal Eligibility (Admin-side RPC)
 ↓
Transfer Reversal (REQUESTED)
 ↓
Razorpay Reversal API
 ↓
Reversal Webhook (PROCESSED)
 ↓
TRANSFER_REVERSED (Ledger)
 ↓
Reconciliation (MATCHED)
```

## 3. Provider Integration & Audit

- **Razorpay Payments**: Verified API refund behavior, partial refund support, and amount calculations (in integer paise).
- **Razorpay Route**: Verified linked accounts, standard basis-point commissions, transfer reversal via the `reversals` API.
- **Provider Turnover/Legal Status**: Business requirements (e.g., ₹40 lakh turnover rule for GST/Payment Aggregator constraints) are treated as **PENDING BUSINESS APPROVAL**. The code does not hardcode this constraint.
- **Merchant of Record**: Requires Business/Legal confirmation. The application strictly acts as a platform.

## 4. Sandbox E2E Evidence
- **Payment E2E**: YES (Sandbox)
- **Route Transfer E2E**: YES (Sandbox)
- **Settlement E2E**: SIMULATED/PARTIAL (Sandbox capabilities are limited for automated settlements).
- **Refund E2E**: YES (Sandbox)
- **Reversal E2E**: YES (Sandbox)

## 5. Security & Immutability Audit
- **RLS**: Verified across `payments`, `bookings`, `financial_ledger`, `refund_requests`, `transfer_reversals`.
- **Admin Security**: `/admin/financials` and associated edge functions (`create-transfer-reversal`) enforce `is_admin` or `service_role`.
- **Ledger Immutability**: No UPDATE or DELETE allowed by end-users. All corrections append new events (e.g., `REFUND_SUCCESS`, `TRANSFER_REVERSED`).
- **Idempotency**: All provider ID requests (`provider_refund_id`, `provider_reversal_id`) utilize UNIQUE constraints, preventing accidental double-processing.
- **Amount Integrity**: Fully uses Integer Paise. `parseFloat` is strictly prohibited in final backend ledger evaluations.
- **Cross-Booking Security**: Prevents merging Payment A with Booking B. Bound locally during creation.

## 6. Secrets & Environment
- Checked `.env` and `supabase/functions`.
- `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` are strictly isolated to server-side Edge Functions.
- `RAZORPAY_ENVIRONMENT !== 'sandbox'` check aggressively fails-closed inside Edge functions. **Production is hard-blocked**.

## 7. Webhook Reliability
- `x-razorpay-signature` validated using HMAC SHA-256.
- Raw body is utilized for hashing.
- Idempotent `.or()` DB checks prevent duplicate ledger entries.

## 8. Provider Approval & Production Checklist
| Item | Status |
|------|--------|
| Razorpay Account Verified | PENDING |
| Route Eligibility | PENDING |
| Legal Policies & Terms | PENDING |
| Production Credentials Configured | PENDING |
| Production Webhooks Configured | PENDING |

## 9. Final Readiness Classification
**SANDBOX E2E READY**

## 10. Known Limitations & Blockers
- **Business/Legal Approval**: Strict requirement for Merchant of Record verification and KYC documentation approval.
- **Provider Configuration**: Production credentials and webhook endpoints must be configured manually in the Supabase instance.
- **Sandbox Limitations**: True external bank payout/settlement is mocked or simulated in Sandbox and can only be validated finally in Production with a live test transaction.
