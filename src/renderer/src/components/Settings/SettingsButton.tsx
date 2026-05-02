interface Props {
  onClick: () => void
}

export default function SettingsButton({ onClick }: Props): JSX.Element {
  return (
    <button
      onClick={onClick}
      title="Audio settings"
      className="text-[13px] text-slate-500 hover:text-slate-300 transition-colors px-1"
    >
      ⚙
    </button>
  )
}
