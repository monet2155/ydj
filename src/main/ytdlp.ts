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
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
    }
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('?')[0]
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

export interface SearchResult {
  videoId: string
  title: string
  duration: number
}

export function searchYouTube(query: string): Promise<SearchResult[]> {
  return new Promise((resolve) => {
    const ytdlp = findYtDlp()
    const proc = spawn(ytdlp, [
      `ytsearch5:${query}`,
      '--flat-playlist',
      '--print', '%(id)s\t%(title)s\t%(duration)s',
    ])
    let out = ''
    proc.stdout.on('data', (c: Buffer) => { out += c.toString() })
    proc.on('close', () => {
      const results: SearchResult[] = out.trim().split('\n').filter(Boolean).flatMap((line) => {
        const [id, title, dur] = line.split('\t')
        if (!id || !/^[\w-]{11}$/.test(id.trim())) return []
        return [{ videoId: id.trim(), title: title ?? 'Unknown', duration: parseFloat(dur ?? '0') || 0 }]
      })
      resolve(results)
    })
    proc.on('error', () => resolve([]))
  })
}

export function getCachedPath(videoId: string, cacheDir?: string): string | null {
  const dir = cacheDir ?? getCacheDir()
  const path = join(dir, `${videoId}.m4a`)
  return existsSync(path) ? path : null
}

/** Fetch title + duration without downloading */
function fetchMeta(url: string, ytdlp: string): Promise<{ title: string; duration: number }> {
  return new Promise((resolve) => {
    const proc = spawn(ytdlp, [
      '--simulate',
      '--print', '%(title)s',
      '--print', '%(duration)s',
      '--no-playlist',
      url
    ])

    let out = ''
    proc.stdout.on('data', (c: Buffer) => { out += c.toString() })
    proc.on('close', () => {
      const lines = out.trim().split('\n').filter(Boolean)
      resolve({
        title: lines[0] ?? 'Unknown',
        duration: parseFloat(lines[1] ?? '0') || 0
      })
    })
    proc.on('error', () => resolve({ title: 'Unknown', duration: 0 }))
  })
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

    const cacheDir = getCacheDir()
    const ytdlp = findYtDlp()

    const cached = getCachedPath(videoId, cacheDir)
    if (cached) {
      // Return cached file — fetch meta async (non-blocking)
      fetchMeta(url, ytdlp).then((meta) => {
        resolve({ success: true, track: { filePath: cached, videoId, ...meta } })
      })
      return
    }

    const outputTemplate = join(cacheDir, '%(id)s.m4a')

    const args = [
      '--extract-audio',
      '--audio-format', 'm4a',
      '--audio-quality', '0',
      '--output', outputTemplate,
      '--no-playlist',
      '--newline',
      '--progress',
      url
    ]

    const proc = spawn(ytdlp, args)
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      const match = text.match(/\[download\]\s+([\d.]+)%/)
      if (match) onProgress?.(parseFloat(match[1]))
    })

    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString() })

    proc.on('close', async (code) => {
      if (code !== 0) {
        resolve({ success: false, error: `다운로드 실패: ${stderr.slice(0, 300)}` })
        return
      }

      const filePath = join(cacheDir, `${videoId}.m4a`)
      if (!existsSync(filePath)) {
        resolve({ success: false, error: `파일이 생성되지 않았습니다. (캐시 경로: ${filePath})` })
        return
      }

      const meta = await fetchMeta(url, ytdlp)
      resolve({ success: true, track: { filePath, videoId, ...meta } })
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: `yt-dlp 실행 오류: ${err.message}` })
    })
  })
}
