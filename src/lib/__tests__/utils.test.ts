import { describe, it, expect } from 'vitest'
import { getDaysBetween, formatPrice, getInitials } from '../utils'

describe('Utility Functions', () => {
  it('calculates days between correctly', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-01-05')
    expect(getDaysBetween(start, end)).toBe(4)
  })

  it('calculates minimum 1 day if start and end are same', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-01-01')
    expect(getDaysBetween(start, end)).toBe(1)
  })

  it('formats price into INR', () => {
    expect(formatPrice(1500)).toContain('₹')
    expect(formatPrice(1500).replace(/\s/g, '')).toContain('1,500')
  })

  it('extracts initials correctly', () => {
    expect(getInitials('John Doe')).toBe('JD')
    expect(getInitials('Jane')).toBe('J')
    expect(getInitials('alice bob charlie')).toBe('AB')
  })
})
