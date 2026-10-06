import { describe, it, expect } from 'vitest'

// We are simulating the DB calculate_commission logic 
// to ensure the frontend / test logic matches the backend integer math.

function calculateCommission(amountPaise: number, platformFeeBps: number): number {
  return Math.round((amountPaise * platformFeeBps) / 10000)
}

describe('Phase 11 Financial Foundation Tests', () => {
  it('correctly calculates integer commission for standard 5% fee', () => {
    const grossAmount = 1000 // ₹10.00 (1000 paise)
    const platformFeeBps = 500 // 5%
    const commission = calculateCommission(grossAmount, platformFeeBps)
    
    expect(commission).toBe(50) // ₹0.50 (50 paise)
    
    const ownerEntitlement = grossAmount - commission
    expect(ownerEntitlement).toBe(950) // ₹9.50
  })

  it('correctly handles fractional rounding', () => {
    const grossAmount = 1050 // ₹10.50
    const platformFeeBps = 500 // 5%
    // 1050 * 500 = 525000 / 10000 = 52.5 -> rounds to 53
    const commission = calculateCommission(grossAmount, platformFeeBps)
    
    expect(commission).toBe(53) // ₹0.53
  })
  
  it('correctly calculates 0% fee', () => {
    const grossAmount = 1000
    const platformFeeBps = 0
    const commission = calculateCommission(grossAmount, platformFeeBps)
    
    expect(commission).toBe(0)
    expect(grossAmount - commission).toBe(1000)
  })

  it('correctly calculates 100% fee', () => {
    const grossAmount = 1000
    const platformFeeBps = 10000
    const commission = calculateCommission(grossAmount, platformFeeBps)
    
    expect(commission).toBe(1000)
    expect(grossAmount - commission).toBe(0)
  })
})
