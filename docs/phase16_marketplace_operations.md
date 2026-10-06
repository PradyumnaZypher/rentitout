# Phase 16: Advanced Marketplace Operations & Trust

## 1. Existing Marketplace Architecture & Phase 16 Additions

Phase 16 audits and builds upon the existing architecture to implement stronger trust signals, reporting capabilities, and booking dispute systems without duplicating functionality or modifying financial logic.

### Newly Added Models
- **Favorites**: `favorites` table allows users to save listings securely.
- **Reports**: `reports` table supports user-reporting of 'LISTING', 'USER', 'REVIEW', or 'MESSAGE'.
- **Disputes**: `booking_disputes` allows participants of a booking to open a dispute.

## 2. Listing Lifecycle & Ownership
The listing lifecycle continues to use `is_active` and the administrative `moderation_status`.
Listing ownership remains securely guarded by RLS. Owner A cannot edit, delete, or modify Owner B's listing availability or price.

## 3. Availability Management
The authoritative availability mechanism remains the booking overlap prevention introduced in Phase 3. Blocked dates rely on existing booking models, avoiding duplicate date conflict logic.

## 4. User Reporting System
Users can create reports for policy violations. Reports are defaulted to `OPEN`.
- **Security**: Users can only see their own reports. Users cannot change the status of a report. Only administrators can transition a report to `RESOLVED` or `DISMISSED`.

## 5. Booking Disputes
Disputes provide a structured way for a renter or owner to flag a problematic booking to administrators.
- **Security**: A Security Definer function `is_booking_participant` enforces that only the renter or the listing owner can open a dispute for a given booking.
- **Financial Isolation**: A dispute **does not automatically move money**. Admin resolution is required, and if financial correction is needed, the Phase 14 Refund/Reversal mechanism must be used separately.

## 6. Favorites
Users can add/remove listings to their favorites list.
- **Security**: Favorites are scoped strictly by RLS. A user cannot view or modify another user's favorites.

## 7. Trust Signals & Search
Search and browse functionalities remain securely gated. Profile verifications and ratings (Phase 5) serve as trust signals without exposing private user data (e.g., phone numbers).

## 8. Moderation & Admin Operations
Administrative moderation relies on `is_current_user_admin()` checks. The UI for moderation extends the existing Phase 6 admin patterns. Administrative actions like resolving disputes or resolving reports are securely guarded at the database level by trigger functions.

## 9. Audit Logging
Administrative actions fall under the existing `admin_audit_log` (Phase 6), remaining append-only and completely opaque to normal users.

## 10. Financial Security Regression
Financial isolation is explicitly maintained.
- Payments: unaffected
- Transfers: unaffected
- Refunds: unaffected
- Reversals: unaffected
- Ledger: unaffected
- Reconciliation: unaffected

## 11. Known Limitations
- Advanced dispute automation (e.g., automatic timed resolution) is deferred.
- Rate limiting for abusive report creation is primarily handled by the application/edge, lacking complex database-level sliding windows.
