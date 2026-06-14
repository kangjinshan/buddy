/**
 * Keyboard shortcuts system for Buddy.
 *
 * Defines shortcut IDs, default keybindings, matching logic,
 * localStorage persistence, conflict detection, and reset.
 */

// ── Shortcut IDs ──────────────────────────────────────────────

export type ShortcutId =
  | 'newTask'
  | 'openSettings'
  | 'toggleSidebar'
  | 'toggleStatusBar'
  | 'commitAndPush'
  | 'selectTask1'
  | 'selectTask2'
  | 'selectTask3'
  | 'selectTask4'
  | 'selectTask5'
  | 'selectTask6'
  | 'selectTask7'
  | 'selectTask8'
  | 'selectTask9'
  | 'nextTask'
  | 'prevTask'
  | 'interrupt'
  | 'escape'
  | 'showShortcuts'

export type ShortcutPlatform = 'mac' | 'windows' | 'linux'

export interface KeyboardOptions {
  platform?: ShortcutPlatform
}

// ── Key binding representation ────────────────────────────────

export interface KeyBinding {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

// ── Shortcut definition (for display in settings) ─────────────

export interface ShortcutDef {
  id: ShortcutId
  group: 'application' | 'navigation'
  labelKey: string
  defaultBinding: KeyBinding
  hidden?: boolean
  readonly?: boolean
}

function resolvePlatform(options?: KeyboardOptions): ShortcutPlatform {
  return options?.platform ?? detectShortcutPlatform()
}

export function detectShortcutPlatform(): ShortcutPlatform {
  const nodePlatform = typeof process !== 'undefined' ? process.platform : ''
  if (nodePlatform === 'darwin') return 'mac'
  if (nodePlatform === 'win32') return 'windows'
  if (nodePlatform) return 'linux'

  const nav = typeof navigator === 'undefined'
    ? null
    : (navigator as Navigator & { userAgentData?: { platform?: string } })
  const raw =
    nav?.userAgentData?.platform ??
    nav?.platform ??
    ''
  const platform = raw.toLowerCase()
  if (platform.includes('mac') || platform === 'darwin') return 'mac'
  if (platform.includes('win') || platform === 'win32') return 'windows'
  return 'linux'
}

function primaryModifier(platform: ShortcutPlatform): Pick<KeyBinding, 'metaKey' | 'ctrlKey'> {
  if (platform === 'mac') return { metaKey: true, ctrlKey: false }
  return { metaKey: false, ctrlKey: true }
}

function withPrimary(
  platform: ShortcutPlatform,
  key: string,
  extras: Partial<KeyBinding> = {}
): KeyBinding {
  return {
    key,
    ...primaryModifier(platform),
    altKey: false,
    shiftKey: false,
    ...extras
  }
}

// ── Default shortcuts ─────────────────────────────────────────

export function createShortcutDefs(platform: ShortcutPlatform = detectShortcutPlatform()): ShortcutDef[] {
  return [
    // Application
    { id: 'newTask', group: 'application', labelKey: 'shortcuts.newTask', defaultBinding: withPrimary(platform, 'n') },
    { id: 'openSettings', group: 'application', labelKey: 'shortcuts.openSettings', defaultBinding: withPrimary(platform, ',') },
    { id: 'toggleSidebar', group: 'application', labelKey: 'shortcuts.toggleSidebar', defaultBinding: withPrimary(platform, 'b') },
    { id: 'toggleStatusBar', group: 'application', labelKey: 'shortcuts.toggleStatusBar', defaultBinding: withPrimary(platform, 'b', { altKey: true }) },
    { id: 'commitAndPush', group: 'application', labelKey: 'shortcuts.commitAndPush', defaultBinding: withPrimary(platform, 'm') },
    { id: 'interrupt', group: 'application', labelKey: 'shortcuts.interrupt', defaultBinding: withPrimary(platform, '.') },
    { id: 'showShortcuts', group: 'application', labelKey: 'shortcuts.showShortcuts', defaultBinding: withPrimary(platform, '/', { shiftKey: true }) },
    // Navigation
    { id: 'selectTask1', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '1'), hidden: true },
    { id: 'selectTask2', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '2'), hidden: true },
    { id: 'selectTask3', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '3'), hidden: true },
    { id: 'selectTask4', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '4'), hidden: true },
    { id: 'selectTask5', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '5'), hidden: true },
    { id: 'selectTask6', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '6'), hidden: true },
    { id: 'selectTask7', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '7'), hidden: true },
    { id: 'selectTask8', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '8'), hidden: true },
    { id: 'selectTask9', group: 'navigation', labelKey: 'shortcuts.selectTaskN', defaultBinding: withPrimary(platform, '9'), hidden: true },
    { id: 'nextTask', group: 'navigation', labelKey: 'shortcuts.nextTask', defaultBinding: withPrimary(platform, ']', { shiftKey: true }) },
    { id: 'prevTask', group: 'navigation', labelKey: 'shortcuts.prevTask', defaultBinding: withPrimary(platform, '[', { shiftKey: true }) },
    { id: 'escape', group: 'application', labelKey: 'shortcuts.escape', defaultBinding: { key: 'Escape', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }, readonly: true }
  ]
}

export const SHORTCUT_DEFS: ShortcutDef[] = createShortcutDefs()

// ── Persistence ───────────────────────────────────────────────

const STORAGE_KEY = 'buddy.keybindings'

type BindingMap = Record<ShortcutId, KeyBinding>

function defaultBindingMap(options?: KeyboardOptions): BindingMap {
  const defs = createShortcutDefs(resolvePlatform(options))
  const map = {} as BindingMap
  for (const def of defs) {
    map[def.id] = { ...def.defaultBinding }
  }
  return map
}

function readBindingMap(options?: KeyboardOptions): BindingMap {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return defaultBindingMap(options)
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaultBindingMap(options)
    // Merge with defaults so new shortcuts get values
    const defaults = defaultBindingMap(options)
    for (const id of Object.keys(defaults) as ShortcutId[]) {
      if (parsed[id] && typeof parsed[id] === 'object' && typeof parsed[id].key === 'string') {
        defaults[id] = {
          key: parsed[id].key,
          metaKey: !!parsed[id].metaKey,
          ctrlKey: !!parsed[id].ctrlKey,
          altKey: !!parsed[id].altKey,
          shiftKey: !!parsed[id].shiftKey
        }
      }
    }
    return defaults
  } catch {
    return defaultBindingMap(options)
  }
}

function writeBindingMap(map: BindingMap): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {}
}

// ── Public API ────────────────────────────────────────────────

/** Get current key bindings (defaults + user overrides from localStorage) */
export function loadBindings(options?: KeyboardOptions): BindingMap {
  return readBindingMap(options)
}

/** Save a single shortcut binding override */
export function saveBinding(id: ShortcutId, binding: KeyBinding): BindingMap {
  const map = loadBindings()
  map[id] = { ...binding }
  writeBindingMap(map)
  return map
}

/** Reset a single shortcut to its default */
export function resetBinding(id: ShortcutId): BindingMap {
  const map = loadBindings()
  const def = SHORTCUT_DEFS.find((d) => d.id === id)
  if (def) map[id] = { ...def.defaultBinding }
  writeBindingMap(map)
  return map
}

/** Reset all shortcuts to defaults */
export function resetAllBindings(): BindingMap {
  const map = defaultBindingMap()
  writeBindingMap(map)
  return map
}

// ── Key normalization ──────────────────────────────────────────

/**
 * Normalize a KeyboardEvent's key value so that Shift-modified keys
 * match their unshifted base. For example, Shift+] produces `}` in
 * e.key but we want to match it against the stored binding `]`.
 * Uses e.code (physical key) to derive the base character.
 */
function normalizeKey(e: KeyboardEvent): string {
  if (e.key.length > 1) return e.key

  const code = e.code
  if (!code) return e.key

  if (code.startsWith('Key') && code.length === 4) {
    return code[3].toLowerCase()
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code[5]
  }

  const CODE_TO_KEY: Record<string, string> = {
    BracketLeft: '[',
    BracketRight: ']',
    Slash: '/',
    Comma: ',',
    Period: '.',
    Semicolon: ';',
    Quote: "'",
    Backslash: '\\',
    Backquote: '`',
    Minus: '-',
    Equal: '='
  }
  if (code in CODE_TO_KEY) return CODE_TO_KEY[code]

  return e.key
}

// ── Matching ──────────────────────────────────────────────────

function bindingMatchesEvent(binding: KeyBinding, e: KeyboardEvent): boolean {
  const normalizedKey = normalizeKey(e)
  return (
    normalizedKey === binding.key &&
    e.metaKey === binding.metaKey &&
    e.ctrlKey === binding.ctrlKey &&
    e.altKey === binding.altKey &&
    e.shiftKey === binding.shiftKey
  )
}

/**
 * Match a KeyboardEvent against current bindings.
 * Returns the ShortcutId if matched, or null.
 */
export function matchShortcut(e: KeyboardEvent, bindings?: BindingMap): ShortcutId | null {
  const map = bindings ?? loadBindings()
  for (const id of Object.keys(map) as ShortcutId[]) {
    if (bindingMatchesEvent(map[id], e)) {
      return id
    }
  }
  return null
}

/** Check if two key bindings are identical */
export function bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
  return (
    a.key === b.key &&
    a.metaKey === b.metaKey &&
    a.ctrlKey === b.ctrlKey &&
    a.altKey === b.altKey &&
    a.shiftKey === b.shiftKey
  )
}

/**
 * Find which other shortcut ID (if any) already uses the given binding.
 * Returns the conflicting ShortcutId or null.
 */
export function findConflict(binding: KeyBinding, excludeId: ShortcutId, bindings?: BindingMap): ShortcutId | null {
  const map = bindings ?? loadBindings()
  for (const id of Object.keys(map) as ShortcutId[]) {
    if (id === excludeId) continue
    if (bindingsEqual(map[id], binding)) return id
  }
  return null
}

// ── Display helpers ───────────────────────────────────────────

const MAC_SYMBOLS: Record<string, string> = {
  meta: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  Enter: '⏎',
  Escape: '⎋',
  Backspace: '⌫',
  Tab: '⇥',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': '␣'
}

const WINDOWS_LABELS: Record<string, string> = {
  meta: 'Win',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  Enter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Tab: 'Tab',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ' ': 'Space'
}

function plainKeyLabel(key: string, platform: ShortcutPlatform): string {
  const labels = platform === 'mac' ? MAC_SYMBOLS : WINDOWS_LABELS
  return labels[key] ?? key.toUpperCase()
}

/** Format a KeyBinding as a human-readable string */
export function formatBinding(binding: KeyBinding, options?: KeyboardOptions): string {
  const platform = resolvePlatform(options)

  if (platform === 'mac') {
    const parts: string[] = []
    if (binding.ctrlKey) parts.push(MAC_SYMBOLS.ctrl)
    if (binding.altKey) parts.push(MAC_SYMBOLS.alt)
    if (binding.shiftKey) parts.push(MAC_SYMBOLS.shift)
    if (binding.metaKey) parts.push(MAC_SYMBOLS.meta)
    parts.push(plainKeyLabel(binding.key, platform))
    return parts.join('')
  }

  const parts: string[] = []
  if (binding.ctrlKey) parts.push(WINDOWS_LABELS.ctrl)
  if (binding.altKey) parts.push(WINDOWS_LABELS.alt)
  if (binding.shiftKey) parts.push(WINDOWS_LABELS.shift)
  if (binding.metaKey) parts.push(platform === 'windows' ? WINDOWS_LABELS.meta : 'Super')
  parts.push(plainKeyLabel(binding.key, platform))
  return parts.join('+')
}

/** Key part for individual key-cap rendering */
export interface KeyPart {
  type: 'modifier' | 'key'
  key: string
  label: string
}

/** Decompose a KeyBinding into individual key parts for separate rendering */
export function bindingToParts(binding: KeyBinding, options?: KeyboardOptions): KeyPart[] {
  const platform = resolvePlatform(options)
  const parts: KeyPart[] = []
  if (binding.ctrlKey) parts.push({ type: 'modifier', key: 'ctrl', label: plainKeyLabel('ctrl', platform) })
  if (binding.altKey) parts.push({ type: 'modifier', key: 'alt', label: plainKeyLabel('alt', platform) })
  if (binding.shiftKey) parts.push({ type: 'modifier', key: 'shift', label: plainKeyLabel('shift', platform) })
  if (binding.metaKey) parts.push({ type: 'modifier', key: 'meta', label: platform === 'mac' ? plainKeyLabel('meta', platform) : (platform === 'windows' ? 'Win' : 'Super') })
  parts.push({ type: 'key', key: binding.key, label: plainKeyLabel(binding.key, platform) })
  return parts
}

/** Parse a KeyboardEvent into a KeyBinding for recording */
export function eventToBinding(e: KeyboardEvent): KeyBinding | null {
  const modifierKeys = ['Meta', 'Control', 'Alt', 'Shift']
  if (modifierKeys.includes(e.key)) return null
  if (e.key === 'CapsLock' || e.key === 'Fn') return null
  return {
    key: normalizeKey(e),
    metaKey: e.metaKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey
  }
}

/** Get the shortcut groups in display order */
export function getShortcutGroups(): { group: ShortcutDef['group']; labelKey: string }[] {
  return [
    { group: 'application', labelKey: 'shortcuts.group.application' },
    { group: 'navigation', labelKey: 'shortcuts.group.navigation' }
  ]
}
