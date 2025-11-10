import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function Stat({ label, value, unit }) {
  return (
    <div className="bg-white/70 backdrop-blur rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-800">
        {value ?? '--'} {unit}
      </p>
    </div>
  )
}

function AQBadge({ aqi }) {
  const color = aqi == null ? 'bg-gray-400' : aqi < 50 ? 'bg-green-500' : aqi < 100 ? 'bg-yellow-500' : aqi < 150 ? 'bg-orange-500' : 'bg-red-500'
  const label = aqi == null ? 'N/A' : aqi < 50 ? 'Good' : aqi < 100 ? 'Moderate' : aqi < 150 ? 'Unhealthy (SG)' : 'Unhealthy+'
  return (
    <span className={`px-3 py-1 text-white text-sm rounded-full ${color}`}>{label}{aqi!=null?` · ${aqi}`:''}</span>
  )
}

export default function App() {
  const [devices, setDevices] = useState([])
  const [selected, setSelected] = useState('')
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const selectedDevice = useMemo(() => devices.find(d => d.device_id === selected), [devices, selected])
  const powerOn = !!selectedDevice?.power

  const fetchDevices = () => {
    return fetch(`${API_BASE}/api/devices`)
      .then(r=>r.json())
      .then(d=>{
        setDevices(d)
        if (d.length && !selected) setSelected(d[0].device_id)
      })
      .catch(()=>{})
  }

  useEffect(() => {
    fetchDevices()
    const id = setInterval(fetchDevices, 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    const controller = new AbortController()

    const load = () => fetch(`${API_BASE}/api/readings/latest?device_id=${selected}&limit=100`, {signal: controller.signal})
      .then(r=>r.json())
      .then(d=>{ setReadings(d); setLoading(false) })
      .catch(()=>setLoading(false))
    load()
    const id = setInterval(load, 5000)
    return () => { clearInterval(id); controller.abort() }
  }, [selected])

  const latest = readings[0] || {}

  const toggleFan = async () => {
    if (!selected) return
    setSending(true)
    setMessage('')
    try {
      const body = { device_id: selected, power: !powerOn, mode: 'manual' }
      const res = await fetch(`${API_BASE}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Failed to queue command')
      setMessage(!powerOn ? 'Turned fan ON (queued)' : 'Turned fan OFF (queued)')
      // refresh devices to reflect possible immediate state changes (optimistic)
      fetchDevices()
    } catch (e) {
      setMessage('Error sending command')
    } finally {
      setSending(false)
      // Auto-clear message after a short delay
      setTimeout(()=> setMessage(''), 4000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      <header className="sticky top-0 bg-white/70 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">Smart Indoor Air Quality</h1>
          <nav className="text-sm text-blue-600">
            <a href="/test" className="hover:underline">Connection Test</a>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <select value={selected} onChange={e=>setSelected(e.target.value)} className="border rounded px-3 py-2">
              <option value="" disabled>Select device</option>
              {devices.map(d=> <option key={d._id} value={d.device_id}>{d.name||d.device_id}</option>)}
            </select>
            <span className="text-sm text-gray-500">{loading? 'Updating…' : readings.length? 'Live' : 'Waiting for data'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={!selected || sending}
              onClick={toggleFan}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-sm transition ${sending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'} ${powerOn ? 'bg-red-500' : 'bg-emerald-600'}`}
            >
              {sending ? 'Sending…' : powerOn ? 'Turn Fan Off' : 'Turn Fan On'}
            </button>
            {selectedDevice && (
              <span className="text-xs text-gray-600">Current: {powerOn ? 'On' : 'Off'}</span>
            )}
          </div>
        </div>

        {message && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-3 py-2 rounded-lg">
            {message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="PM2.5" value={latest.pm2_5} unit="µg/m³" />
          <Stat label="PM10" value={latest.pm10} unit="µg/m³" />
          <Stat label="CO₂" value={latest.co2} unit="ppm" />
          <Stat label="TVOC" value={latest.tvoc} unit="ppb" />
          <Stat label="Temp" value={latest.temperature} unit="°C" />
          <Stat label="RH" value={latest.humidity} unit="%" />
          <div className="col-span-2 flex items-center justify-between bg-white/70 backdrop-blur rounded-xl p-4 shadow-sm">
            <div>
              <p className="text-xs text-gray-500">Air Quality</p>
              <div className="mt-1"><AQBadge aqi={latest.aqi} /></div>
            </div>
            <div className="text-sm text-gray-500">{latest.timestamp ? new Date(latest.timestamp).toLocaleString() : '—'}</div>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold mb-2">Recent Readings</h3>
          <div className="max-h-64 overflow-auto text-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-500">
                  <th className="py-1">Time</th>
                  <th className="py-1">PM2.5</th>
                  <th className="py-1">PM10</th>
                  <th className="py-1">CO₂</th>
                  <th className="py-1">TVOC</th>
                  <th className="py-1">AQI</th>
                </tr>
              </thead>
              <tbody>
                {readings.map(r => (
                  <tr key={r._id} className="border-t">
                    <td className="py-1">{r.timestamp}</td>
                    <td className="py-1">{r.pm2_5 ?? '-'}</td>
                    <td className="py-1">{r.pm10 ?? '-'}</td>
                    <td className="py-1">{r.co2 ?? '-'}</td>
                    <td className="py-1">{r.tvoc ?? '-'}</td>
                    <td className="py-1">{r.aqi ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          API base: {API_BASE}
        </div>
      </main>
    </div>
  )
}
