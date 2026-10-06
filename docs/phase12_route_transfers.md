# Phase 12: Razorpay Route Sandbox Transfer & Settlement Engine

## 1. Transfer Architecture
Phase 12 implements a Sandbox-only transfer orchestration layer for Rentitout. When a booking becomes `COMPLETED` and is `PAID`, it qualifies for payout. The orchestration is performed by Edge Functions and secure PostgreSQL RPCs.
The system implements a strong isolation between Payment (renter to platform) and Transfer (platform to owner).

## 2. Transfer Eligibility
Transfers are strictly vetted server-side. The frontend is incapable of bypassing rules.
Before initiating a transfer, the server checks:
- Booking status is `COMPLETED`
- Payment status is `PAID`
- A matching payment record exists
- Owner has an `ACTIVE` payout profile with a valid `provider_account_id`
- Duplicate checks: No `route_transfers` record can already exist for the booking (`idx_route_transfers_booking` constraint guarantees this).

## 3. Amount & Commission Calculation
Transfers use exactly mapped Integer (paise) amounts.
- `gross_amount`: Derived from the trusted `payments` table.
- `commission`: Calculated in SQL via `calculate_commission(amount)` using the `platform_fee_bps` from `platform_settings`.
- `owner_amount`: The exact difference. The frontend is explicitly forbidden from submitting amounts.

## 4. On-Hold Settlement Architecture
Transfers are deliberately created with `on_hold: true` via the Route API.
This explicitly tracks:
- **Transfer Status**: The movement of funds to the linked account (`CREATED`, `PENDING`, `PROCESSED`, `FAILED`).
- **Settlement Status**: The availability of the funds for withdrawal (`ON_HOLD`, `SETTLED`).

## 5. Webhook Reconciliation
The `razorpay-route-webhook` securely patches transfer states asynchronously based on signature-verified provider events:
- `transfer.processed` -> `PROCESSED`
- `transfer.failed` -> `FAILED`
- `transfer.reversed` -> `REVERSED`
Webhooks execute atomic SQL updates and trigger immutable append operations to the `financial_ledger`.

## 6. Provider Transfer Mapping
The `route_transfers` table uniquely maps:
`booking` -> `payment` -> `owner` -> `provider_transfer_id` -> `provider_account_id`.
This strict mapping prevents cross-booking leakage or mistaken payout routing.

## 7. Sandbox Safety Mechanism
All Edge Functions check `Deno.env.get('RAZORPAY_ENVIRONMENT') === 'sandbox'`.
If the configuration is production or missing, the process securely fails closed.
This explicitly prevents Sandbox testing logic from mistakenly operating on Production transfers.

## 8. Current Limitations & Deferred Functionality
The following items remain DEFERRED in Rentitout until Provider verification is completed:
- **Production Transfers**: Explicitly blocked by Razorpay turnover limits.
- **Refund Execution**: Must be built as a standalone phase explicitly integrated into booking cancellations.
- **Transfer Reversals**: Awaiting a reversal orchestrator.
- **Automated Settlement Release**: While `release-route-settlement` is built, it requires Admin authorization or specific timing triggers (e.g., 48-hour clear window) before it is fully automated.
