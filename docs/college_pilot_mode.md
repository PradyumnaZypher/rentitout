# Rentitout College Pilot Mode Guide

## Overview
The College Pilot Mode enables real-world usage among college students by offering "Cash / Pay in Person" as an offline alternative to Razorpay online payments. This feature acts as a temporary UI layer built upon the existing production environment.

## The Two-Switch Model
Rentitout's financial system remains fully sandboxed regardless of this pilot mode.
- `VITE_COLLEGE_PILOT_MODE`: Exposes the "College Pilot Mode" UI and "Cash" payment options in the browser.
- `RAZORPAY_ENVIRONMENT`: Dictates the live/sandbox status of Razorpay integrations across Supabase Edge Functions. (Must remain `sandbox`).

## A. Enabling College Pilot Mode
1. Open Vercel project settings.
2. Navigate to **Environment Variables**.
3. Set `VITE_COLLEGE_PILOT_MODE=true` for the Production deployment environment.
4. Verify `RAZORPAY_ENVIRONMENT=sandbox` is strictly configured in the Supabase Edge Functions dashboard.
5. Redeploy the Vercel application to inject the build-time variable.

## B. Verifying College Pilot Mode
1. Open the deployed Vercel website.
2. Confirm the presence of the "Rentitout College Pilot" banner on the UI.
3. Access a booking request. Verify that "Cash / Pay in Person" is available as a payment method.
4. Verify that the production online payment button explicitly reads "Online payments are currently disabled during the Rentitout College Pilot."

## C. Using the Website During the Pilot
- Users agree to direct peer-to-peer cash transactions.
- Renters can flag a booking as "Cash Paid".
- Owners mutually verify and flag it as "Cash Received".
- These state mutations *do not* trigger Razorpay transactions, Route Transfers, or Settlement Ledger events.

## D. Disabling College Pilot Mode
1. Open Vercel project settings.
2. Navigate to **Environment Variables**.
3. Set `VITE_COLLEGE_PILOT_MODE=false`.
4. Redeploy the Vercel application.
5. Verify the "Rentitout College Pilot" banner vanishes.
6. Verify online production payment paths are restored (and will operate per the `RAZORPAY_ENVIRONMENT` configuration).

## E. Returning to Normal Production Behavior
Once disabled, standard Razorpay integrations seamlessly resume control without requiring database rollback, SQL migrations, or Git reverts. Existing cash transactions remain safely stored in the `bookings` table as historical non-platform ledger events.

## F. Troubleshooting
- **Cash Option Not Showing:** Re-trigger a Vercel deployment without build cache.
- **Razorpay Still Triggering:** Ensure the UI correctly parses the boolean flag `import.meta.env.VITE_COLLEGE_PILOT_MODE === 'true'`.

## G. Vercel Redeployment Requirements
All toggles of the Pilot mode require Vercel to rebuild and statically inject the new `import.meta.env` boolean.

## H. Supabase Configuration Requirements
Apply migration `20261006000020_phase24_college_pilot.sql` to expose `payment_method` to the `bookings` table, and the `platform_feedback` table. 

## I. Razorpay Safety Verification
Even if a malicious user manipulates the client to bypass the `VITE_COLLEGE_PILOT_MODE=true` gate, Supabase Edge functions will block Live money movement since `RAZORPAY_ENVIRONMENT=sandbox` prevents any live payloads.
