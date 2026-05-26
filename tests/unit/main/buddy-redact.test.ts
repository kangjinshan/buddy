import { describe, expect, it } from 'vitest'
import { redactSensitiveText } from '../../../src/main/buddy/redact'

describe('redactSensitiveText', () => {
  it('redacts common API keys', () => {
    expect(redactSensitiveText('token sk-abcdefghijklmnopqrstuvwxyz1234567890')).toContain('[REDACTED]')
    expect(redactSensitiveText('token sk-ant-abcdefghijklmnopqrstuvwxyz1234567890')).toContain('[REDACTED]')
    expect(redactSensitiveText('aws AKIAABCDEFGHIJKLMNOP')).toContain('[REDACTED]')
  })
})
