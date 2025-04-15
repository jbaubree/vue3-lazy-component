import { describe, expect, it } from 'vitest'
import { defineLazyComponent, lazyComponentPlugin } from '../src/index'

describe('index exports', () => {
  it('exports defineLazyComponent', () => {
    expect(typeof defineLazyComponent).toBe('function')
  })

  it('exports lazyComponentPlugin', () => {
    expect(typeof lazyComponentPlugin).toBe('function')
  })
})
