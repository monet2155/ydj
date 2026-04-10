import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface LibraryTrack {
  videoId: string
  title: string
  duration: number
  filePath: string
  addedAt: number
}

interface LibraryFile {
  tracks: LibraryTrack[]
}

function getLibraryPath(): string {
  const dir = join(homedir(), '.ydj')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'library.json')
}

export function readLibrary(): LibraryTrack[] {
  const path = getLibraryPath()
  if (!existsSync(path)) return []
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as LibraryFile
    return Array.isArray(data.tracks) ? data.tracks : []
  } catch {
    return []
  }
}

export function saveTrack(track: Omit<LibraryTrack, 'addedAt'>): void {
  const path = getLibraryPath()
  const tracks = readLibrary()
  const existing = tracks.findIndex((t) => t.videoId === track.videoId)
  const entry: LibraryTrack = { ...track, addedAt: Date.now() }

  if (existing >= 0) {
    tracks[existing] = entry
  } else {
    tracks.unshift(entry) // newest first
  }

  writeFileSync(path, JSON.stringify({ tracks }, null, 2), 'utf-8')
}
