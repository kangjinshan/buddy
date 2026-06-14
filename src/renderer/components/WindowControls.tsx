import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { useT } from '../hooks/useI18n'

const isWindows = typeof window !== 'undefined' && window.api?.platform === 'win32'

export function WindowControls() {
  const t = useT()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isWindows) return
    window.api.isMaximized().then(setIsMaximized).catch(() => {})
    return window.api.onMaximizeChange(setIsMaximized)
  }, [])

  if (!isWindows) return null

  return (
    <div className="flex items-stretch h-full ml-2 no-drag">
      <button
        onClick={() => window.api.minimizeWindow()}
        title={t('window.minimize')}
        className="w-[46px] flex items-center justify-center text-fg-secondary hover:bg-bg-muted"
      >
        <Minus size={15} strokeWidth={2} />
      </button>
      <button
        onClick={() => window.api.toggleMaximizeWindow().then(setIsMaximized).catch(() => {})}
        title={isMaximized ? t('window.restore') : t('window.maximize')}
        className="w-[46px] flex items-center justify-center text-fg-secondary hover:bg-bg-muted"
      >
        {isMaximized ? <Copy size={12} strokeWidth={2} /> : <Square size={12} strokeWidth={2} />}
      </button>
      <button
        onClick={() => window.api.closeWindow()}
        title={t('window.close')}
        className="w-[46px] flex items-center justify-center text-fg-secondary hover:bg-[#e81123] hover:text-white"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
