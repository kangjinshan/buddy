import { PanelLeft, PanelRight } from 'lucide-react'
import { useT } from '../hooks/useI18n'

interface TitleBarProps {
  taskName: string
  isSidebarOpen: boolean
  isStatusBarOpen: boolean
  isFullScreen: boolean
  showToggles?: boolean
  bare?: boolean
  onToggleSidebar: () => void
  onToggleStatusBar: () => void
}

export function TitleBar({
  taskName,
  isSidebarOpen,
  isStatusBarOpen,
  isFullScreen,
  showToggles = true,
  bare = false,
  onToggleSidebar,
  onToggleStatusBar
}: TitleBarProps) {
  const t = useT()
  return (
    <div className={`h-[50px] flex items-center px-4 bg-bg-elevated drag-region ${bare ? '' : 'border-b border-border'}`}>
      {/* 红绿灯占位 + 展开按钮（仅在侧边栏关闭时显示，否则它们在侧边栏顶部） */}
      {!isSidebarOpen && (
        <>
          <div className={`flex-shrink-0 ${isFullScreen ? 'w-[32px]' : 'w-[68px]'}`} />
          {showToggles && (
            <button
              onClick={onToggleSidebar}
              className="w-5 h-5 mt-[4px] flex items-center justify-center rounded hover:bg-bg-muted no-drag"
              title={t('sidebar.expand')}
            >
              <PanelLeft size={14} strokeWidth={2} />
            </button>
          )}
        </>
      )}

      {/* 任务名（左对齐） */}
      <div className="flex-1 text-sm font-medium truncate px-4">
        {bare ? '' : (taskName || t('app.brand'))}
      </div>

      {/* 右侧栏切换按钮（最右侧，右对齐） */}
      {showToggles && (
        <button
          onClick={onToggleStatusBar}
          className="w-5 h-5 mt-[4px] flex items-center justify-center rounded hover:bg-bg-muted no-drag"
          title={isStatusBarOpen ? t('titleBar.toggleStatusBar.collapse') : t('titleBar.toggleStatusBar.expand')}
        >
          <PanelRight size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
