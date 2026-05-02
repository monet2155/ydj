import { describe, it, expect } from 'vitest'
import { nextSelectedId } from '../store/libraryStore'
import type { LibraryTrack } from '../../../preload/index'

const t = (id: string): LibraryTrack => ({
  videoId: id, title: id, duration: 0, filePath: id, addedAt: 0
})

describe('nextSelectedId', () => {
  const tracks = [t('a'), t('b'), t('c')]

  it('returns null when track list is empty', () => {
    expect(nextSelectedId([], 'x', 1)).toBeNull()
  })

  it('starts at first track when current is null and direction is +1', () => {
    expect(nextSelectedId(tracks, null, 1)).toBe('a')
  })

  it('moves forward by 1', () => {
    expect(nextSelectedId(tracks, 'a', 1)).toBe('b')
  })

  it('moves backward by 1', () => {
    expect(nextSelectedId(tracks, 'b', -1)).toBe('a')
  })

  it('clamps at the end', () => {
    expect(nextSelectedId(tracks, 'c', 1)).toBe('c')
  })

  it('clamps at the start', () => {
    expect(nextSelectedId(tracks, 'a', -1)).toBe('a')
  })
})
