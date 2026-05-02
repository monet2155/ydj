import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join, resolve, sep } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { downloadAudio, getCacheDir, searchYouTube } from './ytdlp.js'
import { readLibrary, saveTrack, updateBpm } from './library.js'
import { loadHotCues, saveHotCues } from './hotcues.js'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ydj.app')

  // 권한 허용:
  //   - midi/midiSysex: WebMIDI (DJ 컨트롤러)
  //   - media: getUserMedia. 실제 마이크는 안 쓰지만 enumerateDevices()가
  //     장치 label과 전체 audiooutput 목록을 보여주려면 media 권한이 필요.
  const allowed = new Set(['midi', 'midiSysex', 'media'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowed.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // T3: yt-dlp 통합
  ipcMain.handle('youtube:download', async (event, url: string, deckId: string) => {
    const result = await downloadAudio(url, (percent) => {
      event.sender.send('youtube:progress', deckId, percent)
    })
    if (result.success) {
      saveTrack(result.track)
    }
    return result
  })

  ipcMain.handle('youtube:search', (_e, query: string) => searchYouTube(query))
  ipcMain.handle('library:list', () => readLibrary())
  ipcMain.handle('library:updateBpm', (_e, videoId: string, bpm: number) => { updateBpm(videoId, bpm) })
  ipcMain.handle('hotcues:load', (_e, videoId: string) => loadHotCues(videoId))
  ipcMain.handle('hotcues:save', (_e, videoId: string, slots: (number | null)[]) => { saveHotCues(videoId, slots) })

  // T4: 오디오 파일 읽기 (ArrayBuffer 반환) — cache dir 외 경로 차단
  ipcMain.handle('audio:readFile', async (_event, filePath: string) => {
    const abs = resolve(filePath)
    const cacheDir = getCacheDir()
    if (!abs.startsWith(cacheDir + sep)) return null
    try {
      const buf = await readFile(abs)
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    } catch {
      return null
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
