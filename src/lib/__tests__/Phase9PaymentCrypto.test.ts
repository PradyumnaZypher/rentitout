import { describe, it, expect } from 'vitest'
// @ts-ignore
import * as crypto from 'crypto'

// Since we cannot run Edge Functions (Deno) easily in this Vitest suite (Node/Browser), 
// we will test the cryptographic logic that is identical to what runs in the Edge Function.
// In the Edge function we use `hmac` from `https://deno.land/x/hmac`
// Here we use native `crypto` which is equivalent for testing the logic.

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const payload = `${orderId}|${paymentId}`
  const generatedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return generatedSignature === signature
}

function verifyRazorpayWebhook(rawBody: string, signature: string, secret: string) {
  const generatedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return generatedSignature === signature
}

describe('Phase 9 Payment Cryptography Tests', () => {
  const MOCK_SECRET = 'test_secret_12345'
  
  describe('Payment Success Signature Verification', () => {
    const orderId = 'order_IluGWxBm9U8zJ8'
    const paymentId = 'pay_IluHGPEVSsJdJk'
    // pre-calculated valid HMAC for the above payload and secret
    const validSignature = crypto.createHmac('sha256', MOCK_SECRET).update(`${orderId}|${paymentId}`).digest('hex')

    it('accepts a valid signature', () => {
      const isValid = verifyRazorpaySignature(orderId, paymentId, validSignature, MOCK_SECRET)
      expect(isValid).toBe(true)
    })

    it('rejects an invalid signature', () => {
      const isValid = verifyRazorpaySignature(orderId, paymentId, 'invalid_sig', MOCK_SECRET)
      expect(isValid).toBe(false)
    })

    it('rejects if orderId is modified', () => {
      const isValid = verifyRazorpaySignature('order_forged', paymentId, validSignature, MOCK_SECRET)
      expect(isValid).toBe(false)
    })

    it('rejects if paymentId is modified', () => {
      const isValid = verifyRazorpaySignature(orderId, 'pay_forged', validSignature, MOCK_SECRET)
      expect(isValid).toBe(false)
    })
  })

  describe('Webhook Signature Verification', () => {
    const rawBody = JSON.stringify({
      entity: 'event',
      account_id: 'acc_123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            order_id: 'order_123',
            amount: 500000,
            status: 'captured'
          }
        }
      }
    })
    const validWebhookSignature = crypto.createHmac('sha256', MOCK_SECRET).update(rawBody).digest('hex')

    it('accepts a valid webhook signature', () => {
      const isValid = verifyRazorpayWebhook(rawBody, validWebhookSignature, MOCK_SECRET)
      expect(isValid).toBe(true)
    })

    it('rejects an invalid webhook signature', () => {
      const isValid = verifyRazorpayWebhook(rawBody, 'invalid_sig', MOCK_SECRET)
      expect(isValid).toBe(false)
    })

    it('rejects if payload is modified', () => {
      const forgedBody = rawBody.replace('500000', '1000') // modifying amount
      const isValid = verifyRazorpayWebhook(forgedBody, validWebhookSignature, MOCK_SECRET)
      expect(isValid).toBe(false)
    })
  })
})
