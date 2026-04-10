/**
 * AudioEngine — AudioContext singleton + buffer loading
 */
export class AudioEngine {
  private static instance: AudioEngine | null = null
  readonly ctx: AudioContext

  private constructor() {
    this.ctx = new AudioContext()
  }

  static getInstance(): AudioEngine {
    // Use window to survive Vite HMR (static class fields reset on module replacement)
    const w = window as Record<string, unknown>
    if (!w.__ydj_audio_ctx) w.__ydj_audio_ctx = new AudioEngine()
    AudioEngine.instance = w.__ydj_audio_ctx as AudioEngine
    return AudioEngine.instance
  }

  /** Must be called from a user gesture to resume the AudioContext */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  /**
   * Load audio from a file path via IPC → ArrayBuffer → AudioBuffer
   */
  async loadBuffer(filePath: string): Promise<AudioBuffer> {
    const arrayBuffer = await window.electronAPI.audio.readFile(filePath)
    if (!arrayBuffer) throw new Error(`파일을 읽을 수 없습니다: ${filePath}`)
    return this.ctx.decodeAudioData(arrayBuffer)
  }
}
