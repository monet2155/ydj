# YDJ — YouTube DJ Desktop App

YouTube 링크를 소스로 사용하는 데스크탑 DJ 애플리케이션.

![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

## 기능

- **2덱 재생** — YouTube URL을 각 덱에 로드, play/pause/cue/seek
- **파형 시각화** — 현재 위치 중심 줌인 파형, 클릭 seek
- **BPM 감지** — 자동 BPM 감지 (Web Worker), SYNC 버튼
- **피치/템포 슬라이더** — ±10% playbackRate 조절
- **3밴드 EQ** — Low/Mid/High 노브 + Kill 버튼
- **크로스페이더** — constant-power 커브
- **핫큐 8개** — 설정/점프/삭제, 로컬 자동 저장
- **루프** — 자동 루프 (1/4~8박자), 수동 토글
- **FX 체인** — Filter(LPF/HPF) / Delay / Reverb / Flanger
- **스크래치** — 바이닐 디스크 드래그
- **트랙 라이브러리** — `~/.ydj/library.json` 영구 저장

## 요구사항

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — Homebrew: `brew install yt-dlp`
- [ffmpeg](https://ffmpeg.org/) — Homebrew: `brew install ffmpeg`
- Node.js 20+

## 개발 시작

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 기술 스택

| 역할 | 기술 |
|------|------|
| 런타임 | Electron 31 |
| UI | React 18 + TypeScript |
| 오디오 | Web Audio API |
| YouTube 추출 | yt-dlp |
| 파형 | Canvas API |
| 스타일 | Tailwind CSS |
| 상태 관리 | Zustand |
| 빌드 | Vite + electron-vite |

## 오디오 그래프

```
AudioBufferSourceNode
  → EQ (lowshelf 80Hz → peaking 1kHz → highshelf 10kHz)
  → FX chain (Filter → Delay → Reverb → Flanger)
  → Deck GainNode (volume)
  → Mixer GainNode (crossfader)
  → AudioContext.destination
```

## 라이선스

MIT
