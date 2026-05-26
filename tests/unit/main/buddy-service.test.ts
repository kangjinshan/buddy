import { describe, expect, it } from 'vitest'
import { BuddyCoreService } from '../../../src/main/buddy/service'

describe('BuddyCoreService', () => {
  it('reports native health without HTTP', async () => {
    const service = new BuddyCoreService()

    await expect(service.checkHealth()).resolves.toBe(true)
  })

  it('returns empty bootstrap before store is wired', async () => {
    const service = new BuddyCoreService()

    await expect(service.bootstrap()).resolves.toMatchObject({
      version: 'native',
      tasks: []
    })
  })
})
