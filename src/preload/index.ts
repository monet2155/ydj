import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export type DeckId = 'A' | 'B'

export interface TrackInfo {
  filePath: string
  title: string
  duration: number
  thumbnailUrl?: string
  videoId: string
}

export type DownloadResult =
  | { success: true; track: TrackInfo }
  | { success: false; error: string }

export interface SearchResult {
  videoId: string
  title: string
  duration: number
}

export interface LibraryTrack {
  videoId: string
  title: string
  duration: number
  filePath: string
  addedAt: number
}

export interface ElectronAPI {
  youtube: {
    download: (url: string, deckId: DeckId) => Promise<DownloadResult>
    onProgress: (callback: (deckId: DeckId, percent: number) => void) => () => void
    search: (query: string) => Promise<SearchResult[]>
  }
  audio: {
    readFile: (filePath: string) => Promise<ArrayBuffer | null>
  }
  library: {
    list: () => Promise<LibraryTrack[]>
  }
  hotcues: {
    load: (videoId: string) => Promise<(number | null)[]>
    save: (videoId: string, slots: (number | null)[]) => Promise<void>
  }
}

const api: ElectronAPI = {
  youtube: {
    download: (url, deckId) => ipcRenderer.invoke('youtube:download', url, deckId),
    search: (query) => ipcRenderer.invoke('youtube:search', query),
    onProgress: (callback) => {
      const handler = (_: Electron.IpcRendererEvent, deckId: DeckId, percent: number): void =>
        callback(deckId, percent)
      ipcRenderer.on('youtube:progress', handler)
      return () => ipcRenderer.removeListener('youtube:progress', handler)
    }
  },
  audio: {
    readFile: (filePath) => ipcRenderer.invoke('audio:readFile', filePath)
  },
  library: {
    list: () => ipcRenderer.invoke('library:list')
  },
  hotcues: {
    load: (videoId) => ipcRenderer.invoke('hotcues:load', videoId),
    save: (videoId, slots) => ipcRenderer.invoke('hotcues:save', videoId, slots)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = api
}
