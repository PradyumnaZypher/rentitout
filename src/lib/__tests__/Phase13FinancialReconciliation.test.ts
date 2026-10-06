import { describe, it, expect } from 'vitest'

// Mocking the server-side RPC logic visually for the test
function mockReconcile(
  booking: any,
  payment: any,
  transfer: any,
  profile: any,
  ledgerEvents: string[]
) {
  if (booking.status !== 'COMPLETED') {
    return { status: 'PENDING', message: 'Booking not completed' }
  }
  if (!payment) {
    return { status: 'DISCREPANCY', type: 'PAYMENT_MISMATCH' }
  }
  if (payment.status !== 'PAID') {
    return { status: 'DISCREPANCY', type: 'PAYMENT_MISMATCH' }
  }
  if (booking.total_price !== payment.amount) {
    return { status: 'DISCREPANCY', type: 'AMOUNT_MISMATCH' }
  }
  if (!ledgerEvents.includes('PAYMENT_COLLECTED') || !ledgerEvents.includes('OWNER_ENTITLEMENT_CREATED')) {
    return { status: 'DISCREPANCY', type: 'LEDGER_MISMATCH' }
  }
  if (!transfer) {
    return { status: 'PENDING', message: 'Transfer not yet created' }
  }
  if (transfer.amount !== payment.amount) {
    return { status: 'DISCREPANCY', type: 'AMOUNT_MISMATCH' }
  }
  if (transfer.owner_amount !== transfer.amount - transfer.platform_fee) {
    return { status: 'DISCREPANCY', type: 'AMOUNT_MISMATCH' }
  }
  if (transfer.provider_account_id !== profile.provider_account_id) {
    return { status: 'DISCREPANCY', type: 'PROVIDER_ACCOUNT_MISMATCH' }
  }
  if (!ledgerEvents.includes('TRANSFER_CREATED')) {
    return { status: 'DISCREPANCY', type: 'LEDGER_MISMATCH' }
  }
  if (transfer.status === 'FAILED' || transfer.status === 'REVERSED') {
    return { status: 'FAILED' }
  }
  if (transfer.settlement_status === 'SETTLED' && !ledgerEvents.includes('OWNER_SETTLED')) {
    return { status: 'DISCREPANCY', type: 'LEDGER_MISMATCH' }
  }
  if (transfer.settlement_status === 'SETTLED') {
    return { status: 'MATCHED' }
  }
  return { status: 'PENDING' }
}

describe('Phase 13 Financial Reconciliation Tests', () => {
  const baseBooking = { status: 'COMPLETED', total_price: 100000 }
  const basePayment = { status: 'PAID', amount: 100000 }
  const baseProfile = { provider_account_id: 'acc_123' }
  const baseTransfer = { 
    amount: 100000, 
    platform_fee: 5000, 
    owner_amount: 95000, 
    provider_account_id: 'acc_123',
    status: 'PROCESSED',
    settlement_status: 'SETTLED'
  }
  const baseEvents = ['PAYMENT_COLLECTED', 'OWNER_ENTITLEMENT_CREATED', 'TRANSFER_CREATED', 'OWNER_SETTLED']

  it('matches fully verified transaction', () => {
    const res = mockReconcile(baseBooking, basePayment, baseTransfer, baseProfile, baseEvents)
    expect(res.status).toBe('MATCHED')
  })

  it('detects amount mismatch between booking and payment', () => {
    const payment = { ...basePayment, amount: 90000 }
    const res = mockReconcile(baseBooking, payment, baseTransfer, baseProfile, baseEvents)
    expect(res.status).toBe('DISCREPANCY')
    expect(res.type).toBe('AMOUNT_MISMATCH')
  })

  it('detects amount mismatch between transfer owner_amount and gross-commission', () => {
    const transfer = { ...baseTransfer, owner_amount: 90000 } // Should be 95000
    const res = mockReconcile(baseBooking, basePayment, transfer, baseProfile, baseEvents)
    expect(res.status).toBe('DISCREPANCY')
    expect(res.type).toBe('AMOUNT_MISMATCH')
  })

  it('detects provider account mismatch', () => {
    const profile = { provider_account_id: 'acc_456' } // Transfer was to acc_123
    const res = mockReconcile(baseBooking, basePayment, baseTransfer, profile, baseEvents)
    expect(res.status).toBe('DISCREPANCY')
    expect(res.type).toBe('PROVIDER_ACCOUNT_MISMATCH')
  })

  it('detects missing ledger events', () => {
    const events = ['PAYMENT_COLLECTED', 'OWNER_ENTITLEMENT_CREATED', 'TRANSFER_CREATED'] // missing OWNER_SETTLED
    const res = mockReconcile(baseBooking, basePayment, baseTransfer, baseProfile, events)
    expect(res.status).toBe('DISCREPANCY')
    expect(res.type).toBe('LEDGER_MISMATCH')
  })

  it('flags failed transfers', () => {
    const transfer = { ...baseTransfer, status: 'FAILED' }
    const res = mockReconcile(baseBooking, basePayment, transfer, baseProfile, baseEvents)
    expect(res.status).toBe('FAILED')
  })

  it('flags pending settlements', () => {
    const transfer = { ...baseTransfer, settlement_status: 'RELEASE_REQUESTED' }
    const res = mockReconcile(baseBooking, basePayment, transfer, baseProfile, baseEvents)
    expect(res.status).toBe('PENDING')
  })
})
