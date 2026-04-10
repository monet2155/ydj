import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// 8 hot cue slots per track; null = unset
export type HotCueSlots = (number | null)[]

interface HotCueFile {
  cues: Record<string, HotCueSlots>  // videoId → 8 slots
}

function getPath(): string {
  const dir = join(homedir(), '.ydj')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'hotcues.json')
}

function read(): HotCueFile {
  const p = getPath()
  if (!existsSync(p)) return { cues: {} }
  try { return JSON.parse(readFileSync(p, 'utf-8')) as HotCueFile } catch { return { cues: {} } }
}

export function loadHotCues(videoId: string): HotCueSlots {
  const data = read()
  return data.cues[videoId] ?? Array(8).fill(null)
}

export function saveHotCues(videoId: string, slots: HotCueSlots): void {
  const data = read()
  data.cues[videoId] = slots
  writeFileSync(getPath(), JSON.stringify(data, null, 2), 'utf-8')
}
