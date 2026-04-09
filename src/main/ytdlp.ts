import { spawn } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface TrackInfo {
  filePath: string
  title: string
  duration: number
  videoId: string
  thumbnailUrl?: string
}

export type DownloadResult =
  | { success: true; track: TrackInfo }
  | { success: false; error: string }

export type ProgressCallback = (percent: number) => void

const YTDLP_PATHS = [
  '/opt/homebrew/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  'yt-dlp'
]

function findYtDlp(): string {
  for (const p of YTDLP_PATHS) {
    if (existsSync(p)) return p
  }
  return 'yt-dlp'
}

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    // Standard: youtube.com/watch?v=ID
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
    }
    // Short: youtu.be/ID
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1)
      if (/^[\w-]{11}$/.test(id)) return id
    }
    return null
  } catch {
    return null
  }
}

export function getCacheDir(): string {
  const dir = join(homedir(), '.ydj', 'cache')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getCachedPath(videoId: string, cacheDir?: string): string | null {
  const dir = cacheDir ?? getCacheDir()
  const path = join(dir, `${videoId}.m4a`)
  return existsSync(path) ? path : null
}

export function downloadAudio(
  url: string,
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  return new Promise((resolve) => {
    const videoId = extractVideoId(url)
    if (!videoId) {
      resolve({ success: false, error: '유효하지 않은 YouTube URL입니다.' })
      return
    }

    const cached = getCachedPath(videoId)
    if (cached) {
      resolve({
        success: true,
        track: { filePath: cached, title: videoId, duration: 0, videoId }
      })
      return
    }

    const cacheDir = getCacheDir()
    const outputTemplate = join(cacheDir, '%(id)s.%(ext)s')
    const ytdlp = findYtDlp()

    const args = [
      '--extract-audio',
      '--audio-format', 'm4a',
      '--audio-quality', '0',
      '--output', outputTemplate,
      '--print', '%(title)s\n%(duration)s',
      '--no-playlist',
      '--newline',
      url
    ]

    const proc = spawn(ytdlp, args)

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text

      // Parse progress: "[download]  45.3% of ..."
      const progressMatch = text.match(/\[download\]\s+([\d.]+)%/)
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1])
        onProgress?.(percent)
      }
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: `다운로드 실패: ${stderr.slice(0, 200)}` })
        return
      }

      const lines = stdout.trim().split('\n').filter(Boolean)
      const title = lines[0] ?? videoId
      const duration = parseFloat(lines[1] ?? '0') || 0

      const filePath = join(cacheDir, `${videoId}.m4a`)
      if (!existsSync(filePath)) {
        resolve({ success: false, error: '파일이 생성되지 않았습니다.' })
        return
      }

      resolve({
        success: true,
        track: { filePath, title, duration, videoId }
      })
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: `yt-dlp 실행 오류: ${err.message}` })
    })
  })
}
