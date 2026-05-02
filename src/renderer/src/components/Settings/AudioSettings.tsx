import { useEffect } from 'react'
import { useOutputDeviceStore, type DeviceRole } from '../../store/outputDeviceStore'

interface Props {
  onClose: () => void
}

export default function AudioSettings({ onClose }: Props): JSX.Element {
  const { availableDevices, masterDeviceId, headphoneDeviceId, refreshDevices, setDeviceId } =
    useOutputDeviceStore()

  useEffect(() => { void refreshDevices() }, [refreshDevices])

  const sameDevice = masterDeviceId === headphoneDeviceId && masterDeviceId !== 'default'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#0d1018] border border-white/10 rounded-lg shadow-2xl w-[520px] flex flex-col text-slate-200">
        <div className="flex items-center justify-between h-10 px-4 border-b border-white/5">
          <span className="text-[11px] font-black tracking-[0.3em] text-slate-300">AUDIO</span>
          <button onClick={onClose} className="text-[14px] text-slate-500 hover:text-slate-200 px-2">×</button>
        </div>

        <div className="p-4 space-y-4">
          <DeviceRow
            label="Master Output"
            role="master"
            selected={masterDeviceId}
            devices={availableDevices}
            onChange={(id) => setDeviceId('master', id)}
          />
          <DeviceRow
            label="Headphone Output"
            role="headphone"
            selected={headphoneDeviceId}
            devices={availableDevices}
            onChange={(id) => setDeviceId('headphone', id)}
          />

          {sameDevice && (
            <div className="text-[10px] text-amber-400/80">
              두 출력이 같은 장치를 가리킵니다. PFL이 마스터에도 들립니다.
            </div>
          )}

          <div className="text-[10px] text-slate-500 leading-relaxed pt-2 border-t border-white/5">
            * 다중 채널 USB 오디오 인터페이스(예: Party Mix MKII)를 메인/헤드폰 두 출력으로
            나누려면 macOS의 <em>Audio MIDI Setup → Aggregate Device</em> 기능이 필요합니다.
          </div>
        </div>
      </div>
    </div>
  )
}

interface DeviceRowProps {
  label: string
  role: DeviceRole
  selected: string
  devices: MediaDeviceInfo[]
  onChange: (id: string) => void
}

function DeviceRow({ label, selected, devices, onChange }: DeviceRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <label className="w-32 text-[11px] text-slate-400">{label}</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-[#06080d] text-slate-200 text-[11px] border border-white/10 rounded px-2 py-1.5 outline-none focus:border-slate-500"
      >
        <option value="default">시스템 기본</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `장치 (${d.deviceId.slice(0, 8)}…)`}
          </option>
        ))}
      </select>
    </div>
  )
}
