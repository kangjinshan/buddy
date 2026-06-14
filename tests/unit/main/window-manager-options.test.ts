import { describe, expect, it } from 'vitest'
import { createMainWindowOptions } from '../../../src/main/window-options'

describe('window manager options', () => {
  it('enables macOS traffic lights only on darwin', () => {
    const options = createMainWindowOptions('/tmp/preload.js', 'darwin')
    expect(options.titleBarStyle).toBe('hiddenInset')
    expect(options.trafficLightPosition).toEqual({ x: 16, y: 19 })
  })

  it('uses Windows-safe title bar options on win32', () => {
    const options = createMainWindowOptions('/tmp/preload.js', 'win32')
    expect(options.titleBarStyle).toBe('hidden')
    expect(options.trafficLightPosition).toBeUndefined()
    expect(options.titleBarOverlay).toBe(false)
  })
})
