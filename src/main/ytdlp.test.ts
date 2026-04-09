import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// We test the pure logic functions in isolation (not the actual yt-dlp call)
// The actual download is tested manually (requires network + yt-dlp)

const TEST_CACHE_DIR = join(tmpdir(), 'ydj-test-cache')

describe('ytdlp cache logic', () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true })
    }
  })

  it('extracts video ID from standard YouTube URL', async () => {
    const { extractVideoId } = await import('./ytdlp.js')
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts video ID from short YouTube URL', async () => {
    const { extractVideoId } = await import('./ytdlp.js')
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for invalid URL', async () => {
    const { extractVideoId } = await import('./ytdlp.js')
    expect(extractVideoId('not-a-youtube-url')).toBeNull()
  })

  it('returns cached file path when file exists', async () => {
    const { getCachedPath } = await import('./ytdlp.js')
    mkdirSync(TEST_CACHE_DIR, { recursive: true })
    const fakeFile = join(TEST_CACHE_DIR, 'dQw4w9WgXcQ.m4a')
    // Create fake file
    const { writeFileSync } = await import('fs')
    writeFileSync(fakeFile, '')
    const result = getCachedPath('dQw4w9WgXcQ', TEST_CACHE_DIR)
    expect(result).toBe(fakeFile)
  })

  it('returns null when file not cached', async () => {
    const { getCachedPath } = await import('./ytdlp.js')
    mkdirSync(TEST_CACHE_DIR, { recursive: true })
    const result = getCachedPath('nonexistent-id', TEST_CACHE_DIR)
    expect(result).toBeNull()
  })
})
