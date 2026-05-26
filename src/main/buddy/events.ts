import type { BrowserWindow } from 'electron'
import type { TaskEventEnvelope } from '../../shared/types'

type Subscriber = (event: TaskEventEnvelope) => void

export class BuddyEventBus {
  private readonly subscribers = new Set<Subscriber>()

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  publish(event: TaskEventEnvelope): void {
    for (const subscriber of this.subscribers) {
      subscriber(event)
    }
  }

  publishToWindow(window: BrowserWindow, event: TaskEventEnvelope): void {
    window.webContents.send('buddy:event', event)
  }
}
