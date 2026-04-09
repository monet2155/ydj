import DeckPanel from './components/Deck/DeckPanel'
import MixerPanel from './components/Mixer/MixerPanel'

export default function App(): JSX.Element {
  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-slate-200">
      {/* Header */}
      <header className="flex items-center justify-center h-8 bg-[#0a0d14] border-b border-slate-800 shrink-0">
        <span className="text-sm font-bold tracking-widest text-slate-400">YDJ</span>
      </header>

      {/* Main layout: Deck A | Mixer | Deck B */}
      <main className="flex flex-1 overflow-hidden">
        <DeckPanel deckId="A" />
        <MixerPanel />
        <DeckPanel deckId="B" />
      </main>
    </div>
  )
}
