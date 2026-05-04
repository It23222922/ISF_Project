import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

// ─────────────────────────────────────────
// Event label map — readable names
// ─────────────────────────────────────────
const EVENT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  request_media:    { label: 'Media Request',         color: 'text-yellow-400', icon: '🎛' },
  request_product:  { label: 'Product Request',       color: 'text-yellow-400', icon: '📦' },
  ack_media:        { label: 'Media Acknowledged',    color: 'text-green-400',  icon: '✅' },
  ack_product:      { label: 'Product Acknowledged',  color: 'text-green-400',  icon: '✅' },
  stop_product:     { label: 'Product Stop',          color: 'text-orange-400', icon: '🛑' },
  stop_media:       { label: 'Media Stop',            color: 'text-orange-400', icon: '🛑' },
  ack_stop_product: { label: 'Stop Acknowledged',     color: 'text-green-400',  icon: '✅' },
  ack_stop_media:   { label: 'Stop Acknowledged',     color: 'text-green-400',  icon: '✅' },
  change_media:     { label: 'Media Changed',         color: 'text-blue-400',   icon: '🔄' },
  change_product:   { label: 'Product Changed',       color: 'text-blue-400',   icon: '🔄' },
  qc_change:        { label: 'QC Status Changed',     color: 'text-purple-400', icon: '🔬' },
}

interface LogEntry {
  id:        number;
  timestamp: string;
  line:      string;
  event:     string;
  details:   string;
}

export function LogPage() {
  const [logs, setLogs]           = useState<LogEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo]   = useState('')
  const [generating, setGenerating] = useState(false)
  const [filterLine, setFilterLine] = useState('')
  const [filterEvent, setFilterEvent] = useState('')

  // ─────────────────────────────────────────
  // Fetch recent 10 logs on mount
  // ─────────────────────────────────────────
  useEffect(() => {
    fetchLogs()
  }, [filterLine, filterEvent])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '10' })
      if (filterLine)  params.append('line',  filterLine)
      if (filterEvent) params.append('event', filterEvent)
      const res  = await fetch(`${API}/api/get-logs?${params}`)
      const data = await res.json()
      if (data.status === 'success') setLogs(data.logs)
    } catch (error) {
      console.error('❌ Could not fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────
  // Generate report — fetch filtered logs
  // and export as CSV
  // ─────────────────────────────────────────
  const generateReport = async () => {
    if (!reportFrom && !reportTo) {
      alert('Please select at least a start date for the report.')
      return
    }
    setGenerating(true)
    try {
      const params = new URLSearchParams({ limit: '10000' })
      if (reportFrom) params.append('date_from', reportFrom)
      if (reportTo)   params.append('date_to',   reportTo)
      if (filterLine) params.append('line',       filterLine)

      const res  = await fetch(`${API}/api/get-logs?${params}`)
      const data = await res.json()

      if (data.status === 'success' && data.logs.length > 0) {
        exportCSV(data.logs)
      } else {
        alert('No data found for the selected date range.')
      }
    } catch (error) {
      console.error('❌ Could not generate report:', error)
    } finally {
      setGenerating(false)
    }
  }

  // ─────────────────────────────────────────
  // Export logs as CSV file
  // ─────────────────────────────────────────
  const exportCSV = (data: LogEntry[]) => {
    const headers = ['ID', 'Timestamp', 'Line', 'Event', 'Details']
    const rows    = data.map(l => [
      l.id,
      l.timestamp,
      l.line,
      EVENT_LABELS[l.event]?.label ?? l.event,
      l.details,
    ])
    const csv     = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob    = new Blob([csv], { type: 'text/csv' })
    const url     = URL.createObjectURL(blob)
    const a       = document.createElement('a')
    a.href        = url
    a.download    = `factory_log_${reportFrom ?? 'all'}_to_${reportTo ?? 'now'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-800 p-8">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 mb-6 rounded-lg shadow-xl flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-wide">Event Log</h1>
          
            <a
              href="/screen2"
              className="bg-white/20 hover:bg-white/30 text-white font-bold px-5 py-2 rounded-lg transition-colors text-lg"
            >
              ← Back
            </a>
          </div>

        {/* ── Filters ── */}
        <div className="bg-slate-700 border-2 border-green-500 rounded-lg p-5 mb-6 shadow-xl">
          <p className="text-yellow-400 font-bold text-lg mb-4">Filter Recent Logs</p>
          <div className="flex flex-wrap gap-4">

            {/* Line filter */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-sm uppercase tracking-widest">Line</label>
              <select
                value={filterLine}
                onChange={e => setFilterLine(e.target.value)}
                className="bg-slate-900 border-2 border-slate-600 text-white rounded-lg px-4 py-2 text-lg focus:border-green-500 outline-none"
              >
                <option value="">All Lines</option>
                <option value="L1">L1</option>
                <option value="L2">L2</option>
                <option value="L3">L3</option>
                <option value="L4">L4</option>
              </select>
            </div>

            {/* Event filter */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-sm uppercase tracking-widest">Event Type</label>
              <select
                value={filterEvent}
                onChange={e => setFilterEvent(e.target.value)}
                className="bg-slate-900 border-2 border-slate-600 text-white rounded-lg px-4 py-2 text-lg focus:border-green-500 outline-none"
              >
                <option value="">All Events</option>
                <option value="request_media">Media Request</option>
                <option value="request_product">Product Request</option>
                <option value="ack_media">Media Acknowledged</option>
                <option value="ack_product">Product Acknowledged</option>
                <option value="stop_product">Product Stop</option>
                <option value="stop_media">Media Stop</option>
                <option value="ack_stop_product">Stop Product Acknowledged</option>
                <option value="ack_stop_media">Stop Media Acknowledged</option>
                <option value="change_media">Media Changed</option>
                <option value="change_product">Product Changed</option>
                <option value="qc_change">QC Changed</option>
              </select>
            </div>

            {/* Refresh button */}
            <div className="flex flex-col gap-1 justify-end">
              <button
                onClick={fetchLogs}
                className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2 rounded-lg transition-colors text-lg"
              >
                🔄 Refresh
              </button>
            </div>

          </div>
        </div>

        {/* ── Recent Logs Table ── */}
        <div className="bg-slate-700 border-2 border-green-500 rounded-lg shadow-xl overflow-hidden mb-6">
          <div className="bg-slate-900 px-6 py-4 border-b-2 border-green-500">
            <p className="text-yellow-400 font-bold text-lg">
              Recent 10 Updates
            </p>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[160px_80px_200px_1fr] gap-4 px-6 py-3 bg-slate-800 border-b border-slate-600">
            <div className="text-slate-400 text-sm uppercase tracking-widest font-bold">Timestamp</div>
            <div className="text-slate-400 text-sm uppercase tracking-widest font-bold">Line</div>
            <div className="text-slate-400 text-sm uppercase tracking-widest font-bold">Event</div>
            <div className="text-slate-400 text-sm uppercase tracking-widest font-bold">Details</div>
          </div>

          {/* Table Rows */}
          {loading ? (
            <div className="px-6 py-12 text-center text-slate-400 text-lg animate-pulse">
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500 text-lg">
              No events found.
            </div>
          ) : (
            logs.map((log, index) => {
              const meta = EVENT_LABELS[log.event] ?? { label: log.event, color: 'text-white', icon: '📋' }
              return (
                <div
                  key={log.id}
                  className={`
                    grid grid-cols-[160px_80px_200px_1fr] gap-4 px-6 py-4
                    ${index < logs.length - 1 ? 'border-b border-slate-600' : ''}
                    hover:bg-slate-600/30 transition-colors
                  `}
                >
                  <div className="text-slate-300 text-sm font-mono">{log.timestamp}</div>
                  <div>
                    <span className="bg-green-700 text-white text-sm font-bold px-3 py-1 rounded-lg">
                      {log.line}
                    </span>
                  </div>
                  <div className={`font-bold text-sm ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </div>
                  <div className="text-slate-300 text-sm">{log.details}</div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Report Generator ── */}
        <div className="bg-slate-700 border-2 border-blue-500 rounded-lg p-5 shadow-xl">
          <p className="text-yellow-400 font-bold text-lg mb-4">📊 Generate Report</p>
          <div className="flex flex-wrap gap-4 items-end">

            {/* Date From */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-sm uppercase tracking-widest">From Date</label>
              <input
                type="date"
                value={reportFrom}
                onChange={e => setReportFrom(e.target.value)}
                className="bg-slate-900 border-2 border-slate-600 text-white rounded-lg px-4 py-2 text-lg focus:border-blue-500 outline-none"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-sm uppercase tracking-widest">To Date</label>
              <input
                type="date"
                value={reportTo}
                onChange={e => setReportTo(e.target.value)}
                className="bg-slate-900 border-2 border-slate-600 text-white rounded-lg px-4 py-2 text-lg focus:border-blue-500 outline-none"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={generateReport}
              disabled={generating}
              className={`
                font-bold px-8 py-2 rounded-lg transition-colors text-lg
                ${generating
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-400 text-white'
                }
              `}
            >
              {generating ? '⏳ Generating...' : '📥 Download CSV'}
            </button>

          </div>
          <p className="text-slate-500 text-sm mt-3">
            Leave "To Date" empty to include all events up to today. Report applies the Line filter above.
          </p>
        </div>

      </div>
    </div>
  )
}