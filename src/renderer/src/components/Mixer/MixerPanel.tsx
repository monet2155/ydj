export default function MixerPanel(): JSX.Element {
  return (
    <div
      className="flex flex-col items-center w-48 shrink-0 bg-[#0a0d14] border-x border-slate-800 p-4 gap-4"
      data-testid="mixer-panel"
    >
      <div className="text-xs font-bold tracking-widest text-slate-600">MIXER</div>

      {/* Master volume placeholder */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-slate-600">MASTER</span>
        <div className="h-24 w-6 bg-slate-800 rounded-full relative">
          <div className="absolute bottom-0 left-0 right-0 h-3/4 bg-slate-600 rounded-full" />
        </div>
      </div>

      {/* Crossfader placeholder */}
      <div className="mt-auto flex flex-col items-center gap-2 w-full">
        <span className="text-xs text-slate-600">CROSSFADER</span>
        <div className="w-full h-2 bg-slate-800 rounded-full relative">
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-400 rounded-full" />
        </div>
        <div className="flex justify-between w-full text-xs text-slate-600">
          <span>A</span>
          <span>B</span>
        </div>
      </div>
    </div>
  )
}
