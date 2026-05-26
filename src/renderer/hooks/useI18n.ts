import { useCallback, useEffect, useState } from 'react'
import {
  Language,
  LanguagePref,
  SendShortcut,
  TranslationKey,
  detectLanguage,
  resolveLanguage,
  translate
} from '../lib/i18n'

const LANGUAGE_KEY = 'buddy.language'
const SEND_SHORTCUT_KEY = 'buddy.sendShortcut'
const LANGUAGE_EVENT = 'buddy.language-change'
const SEND_SHORTCUT_EVENT = 'buddy.sendShortcut-change'

function readLanguagePref(): LanguagePref {
  try {
    const v = localStorage.getItem(LANGUAGE_KEY)
    if (v === 'auto' || v === 'zh-CN' || v === 'zh-TW' || v === 'en') return v
  } catch {}
  return 'auto'
}

function readSendShortcut(): SendShortcut {
  try {
    const v = localStorage.getItem(SEND_SHORTCUT_KEY)
    if (v === 'enter' || v === 'shift-enter') return v
  } catch {}
  return 'shift-enter'
}

function writeLanguagePref(pref: LanguagePref) {
  try { localStorage.setItem(LANGUAGE_KEY, pref) } catch {}
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT))
}

function writeSendShortcut(value: SendShortcut) {
  try { localStorage.setItem(SEND_SHORTCUT_KEY, value) } catch {}
  window.dispatchEvent(new CustomEvent(SEND_SHORTCUT_EVENT))
}

function useLocalStorageBacked<T>(read: () => T, eventName: string): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(read)
  useEffect(() => {
    const handler = () => setValue(read())
    window.addEventListener(eventName, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(eventName, handler)
      window.removeEventListener('storage', handler)
    }
  }, [eventName, read])
  return [value, setValue]
}

export function useLanguagePref(): {
  pref: LanguagePref
  language: Language
  setPref: (pref: LanguagePref) => void
  detected: Language
} {
  const [pref] = useLocalStorageBacked(readLanguagePref, LANGUAGE_EVENT)
  const setPref = useCallback((next: LanguagePref) => writeLanguagePref(next), [])
  return {
    pref,
    language: resolveLanguage(pref),
    detected: detectLanguage(),
    setPref
  }
}

export function useLanguage(): Language {
  return useLanguagePref().language
}

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string

export function useT(): TFunction {
  const language = useLanguage()
  return useCallback(
    (key, params) => translate(language, key, params),
    [language]
  )
}

export function useSendShortcut(): {
  shortcut: SendShortcut
  setShortcut: (value: SendShortcut) => void
} {
  const [shortcut] = useLocalStorageBacked(readSendShortcut, SEND_SHORTCUT_EVENT)
  const setShortcut = useCallback((value: SendShortcut) => writeSendShortcut(value), [])
  return { shortcut, setShortcut }
}
