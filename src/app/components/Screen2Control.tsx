import { useEffect, useState } from 'react';
import { SystemState, MEDIA_OPTIONS, PRODUCT_OPTIONS } from '../types';
import { getSystemState, setSystemState } from '../utils/storage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

// ─────────────────────────────────────────
// API base URL — from .env
// ─────────────────────────────────────────
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

// ─────────────────────────────────────────
// Reverse maps — PLC int → option string
// ─────────────────────────────────────────
const MEDIA_REVERSE: Record<number, string> = {
  1: 'Option 1', 2: 'Option 2', 3: 'Option 3',
  4: 'Option 4', 5: 'Option 5',
}

const PRODUCT_REVERSE: Record<number, string> = {
  1:  'Option 1',  2:  'Option 2',  3:  'Option 3',
  4:  'Option 4',  5:  'Option 5',  6:  'Option 6',
  7:  'Option 7',  8:  'Option 8',  9:  'Option 9',
  10: 'Option 10', 11: 'Option 11', 12: 'Option 12',
  13: 'Option 13', 14: 'Option 14', 15: 'Option 15',
}

// ─────────────────────────────────────────
// Popup types
// ─────────────────────────────────────────
interface PopupInfo {
  line:   string;
  kind:   'media' | 'product';
  option: string | null;
}

interface StopPopupInfo {
  line:  string;
  kind:  'product' | 'media';
  label: string;
}

interface LineRequests {
  media:          boolean;
  product:        boolean;
  media_option:   string | null;
  product_option: string | null;
}

interface LineStops {
  stop_product: boolean;
  stop_media:   boolean;
}

interface RequestState {
  L1: LineRequests;
  L2: LineRequests;
  L3: LineRequests;
  L4: LineRequests;
}

interface StopState {
  L1: LineStops;
  L2: LineStops;
  L3: LineStops;
  L4: LineStops;
}

export function Screen2Control() {
  const [state, setState]                 = useState<SystemState>(getSystemState());
  const [popup, setPopup]                 = useState<PopupInfo | null>(null);
  const [stopPopup, setStopPopup]         = useState<StopPopupInfo | null>(null);
  const [dismissed, setDismissed]         = useState(false);
  const [stopDismissed, setStopDismissed] = useState(false);
  const [requests, setRequests]           = useState<RequestState>({
    L1: { media: false, product: false, media_option: null, product_option: null },
    L2: { media: false, product: false, media_option: null, product_option: null },
    L3: { media: false, product: false, media_option: null, product_option: null },
    L4: { media: false, product: false, media_option: null, product_option: null },
  });
  const [stops, setStops]                 = useState<StopState>({
    L1: { stop_product: false, stop_media: false },
    L2: { stop_product: false, stop_media: false },
    L3: { stop_product: false, stop_media: false },
    L4: { stop_product: false, stop_media: false },
  });
  const [flash, setFlash]                 = useState(false);
  const [loaded, setLoaded]               = useState(false);  // ← prevents flicker before PLC load

  // ─────────────────────────────────────────
  // Flash timer — toggles every 500ms
  // ─────────────────────────────────────────
  useEffect(() => {
    const flashInterval = setInterval(() => {
      setFlash(prev => !prev)
    }, 500)
    return () => clearInterval(flashInterval)
  }, [])


  useEffect(() => {
    // ─────────────────────────────────────────
    // Load initial state from PLC on startup
    // replaces localStorage as source of truth
    // ─────────────────────────────────────────
    const fetchInitialState = async () => {
      try {
        const res  = await fetch(`${API}/api/get-line-state`)
        const data = await res.json()
        if (data.status === 'success') {
          setState(prev => ({
            ...prev,
            L1: { ...prev.L1,
              media:   MEDIA_REVERSE[data.lines.L1.media]     ?? prev.L1.media,
              product: PRODUCT_REVERSE[data.lines.L1.product] ?? prev.L1.product,
            },
            L2: { ...prev.L2,
              media:   MEDIA_REVERSE[data.lines.L2.media]     ?? prev.L2.media,
              product: PRODUCT_REVERSE[data.lines.L2.product] ?? prev.L2.product,
            },
            L3: { ...prev.L3,
              media:   MEDIA_REVERSE[data.lines.L3.media]     ?? prev.L3.media,
              product: PRODUCT_REVERSE[data.lines.L3.product] ?? prev.L3.product,
            },
            L4: { ...prev.L4,
              media:   MEDIA_REVERSE[data.lines.L4.media]     ?? prev.L4.media,
              product: PRODUCT_REVERSE[data.lines.L4.product] ?? prev.L4.product,
            },
          }))
        }
      } catch (error) {
        console.error('❌ Could not load initial state from PLC:', error)
      } finally {
        setLoaded(true)  // ← always mark as loaded even if PLC unreachable
      }
    }
    fetchInitialState()

    // ─────────────────────────────────────────
    // Poll QC every 2 seconds
    // ─────────────────────────────────────────
    const fetchQC = async () => {
      try {
        const res  = await fetch(`${API}/api/get-qc`)
        const data = await res.json()
        if (data.status === 'success') {
          setState(prev => {
            const hasChanged =
              prev.L1.qc !== data.qc.L1 ||
              prev.L2.qc !== data.qc.L2 ||
              prev.L3.qc !== data.qc.L3 ||
              prev.L4.qc !== data.qc.L4
            if (!hasChanged) return prev
            return {
              ...prev,
              L1: { ...prev.L1, qc: data.qc.L1 },
              L2: { ...prev.L2, qc: data.qc.L2 },
              L3: { ...prev.L3, qc: data.qc.L3 },
              L4: { ...prev.L4, qc: data.qc.L4 },
            }
          })
        }
      } catch (error) {
        console.error('❌ Could not read QC:', error)
      }
    }
    fetchQC()
    const qcInterval = setInterval(fetchQC, 2000)

    // ─────────────────────────────────────────
    // Poll HMI request buttons every second
    // ─────────────────────────────────────────
    const fetchRequests = async () => {
      try {
        const res  = await fetch(`${API}/api/get-requests`)
        const data = await res.json()
        if (data.status === 'success') {
          setRequests(data.requests)
          for (const line of ['L1', 'L2', 'L3', 'L4']) {
            const l = data.requests[line]
            if (l.media) {
              setPopup(prev => {
                if (prev || dismissed) return prev
                return { line, kind: 'media', option: 'Option 1' }
              })
              return
            }
            if (l.product) {
              setPopup(prev => {
                if (prev || dismissed) return prev
                return { line, kind: 'product', option: null }
              })
              return
            }
          }
        }
      } catch (error) {
        console.error('❌ Could not read requests:', error)
      }
    }
    fetchRequests()
    const requestInterval = setInterval(fetchRequests, 1000)

    // ─────────────────────────────────────────
    // Poll Stop requests every second
    // ─────────────────────────────────────────
    const fetchStopRequests = async () => {
      try {
        const res  = await fetch(`${API}/api/get-stop-requests`)
        const data = await res.json()
        if (data.status === 'success') {
          setStops(data.stops)
          for (const line of ['L1', 'L2', 'L3', 'L4']) {
            const s = data.stops[line]
            if (s.stop_product) {
              setStopPopup(prev => {
                if (prev || stopDismissed) return prev
                return { line, kind: 'product', label: 'Product' }
              })
              return
            }
            if (s.stop_media) {
              setStopPopup(prev => {
                if (prev || stopDismissed) return prev
                return { line, kind: 'media', label: 'Media Option 1' }
              })
              return
            }
          }
        }
      } catch (error) {
        console.error('❌ Could not read stop requests:', error)
      }
    }
    fetchStopRequests()
    const stopInterval = setInterval(fetchStopRequests, 1000)

    return () => {
      clearInterval(qcInterval)
      clearInterval(requestInterval)
      clearInterval(stopInterval)
    };
  }, [dismissed, stopDismissed]);


  // ─────────────────────────────────────────
  // Orange underglow — stop request active
  // ─────────────────────────────────────────
  const hasStopRequest = (id: string) => {
    if (stopPopup?.line === id) return true
    return false
  }

  // ─────────────────────────────────────────
  // Red underglow — media/product request
  // ─────────────────────────────────────────
  const hasRequest = (id: string) => {
    const line = requests[id as keyof RequestState]
    if (!line) return false
    return line.media || line.product
  }


  // ─────────────────────────────────────────
  // Dismiss request popup
  // ─────────────────────────────────────────
  const handleDismiss = async () => {
    if (!popup) return
    setDismissed(true)
    try {
      await fetch(`${API}/api/clear-request`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kind: popup.kind, line: popup.line })
      })
    } catch (error) {
      console.error('❌ Could not clear request:', error)
    }
    setPopup(null)
    setTimeout(() => setDismissed(false), 3000)
  }


  // ─────────────────────────────────────────
  // Acknowledge stop popup
  // ─────────────────────────────────────────
  const handleStopAcknowledge = async () => {
    if (!stopPopup) return
    setStopDismissed(true)
    try {
      await fetch(`${API}/api/clear-stop-request`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kind: stopPopup.kind, line: stopPopup.line })
      })
    } catch (error) {
      console.error('❌ Could not clear stop request:', error)
    }
    setStopPopup(null)
    setTimeout(() => setStopDismissed(false), 3000)
  }


  // ─────────────────────────────────────────
  // Write media and product to PLC
  // ─────────────────────────────────────────
  const updateLine = async (line: keyof SystemState, field: 'media' | 'product', value: string) => {
    const newState = {
      ...state,
      [line]: { ...state[line], [field]: value },
    };
    setState(newState);
    setSystemState(newState);
    try {
      const updatedLine = newState[line];
      const response = await fetch(`${API}/api/set-line`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          line:    line,
          media:   updatedLine.media,
          product: updatedLine.product,
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        console.log(`✅ ${line} written to PLC:`, data.written);
      } else {
        console.error(`❌ PLC write failed:`, data.message);
      }
    } catch (error) {
      console.error('❌ Could not reach backend:', error);
    }
  };


  const lines = [
    { id: 'L1' as const, data: state.L1 },
    { id: 'L2' as const, data: state.L2 },
    { id: 'L3' as const, data: state.L3 },
    { id: 'L4' as const, data: state.L4 },
  ];

  // ─────────────────────────────────────────
  // Show loading screen until PLC data loaded
  // ─────────────────────────────────────────
  if (!loaded) return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">⚙️</div>
        <p className="text-slate-400 text-xl">Loading from PLC...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-800 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-r text-center from-green-600 to-green-700 text-white px-5 py-4 mb-5 rounded-lg shadow-xl flex items-center justify-between">
          <div className="w-32" />  {/* spacer */}
          <h1 className="text-3xl font-bold tracking-wide">Control Panel</h1>

          <a
            href="/logs"
            className="bg-white/20 hover:bg-white/30 text-white font-bold px-5 py-2 rounded-lg transition-colors text-lg w-32 text-center"
          >
            View Logs
          </a>
        </div>

        {/* Main content */}
        <div className="bg-slate-700 border-4 border-green-500 rounded-lg shadow-2xl overflow-hidden">

          {/* Column Headers */}
          <div className="grid grid-cols-[120px_1fr_1fr_120px] gap-4 px-6 py-5 border-b-4 border-green-500 bg-slate-900">
            <div></div>
            <div className="text-2xl font-bold text-center text-yellow-400">Media</div>
            <div className="text-2xl font-bold text-center text-yellow-400">Products</div>
            <div className="text-2xl font-bold text-center text-yellow-400">QC</div>
          </div>

          {/* Lines */}
          {lines.map((line, index) => (
            <div
              key={line.id}
              className={`
                grid grid-cols-[120px_1fr_1fr_120px] gap-4 px-6 py-7
                transition-all duration-300
                ${index < lines.length - 1 ? 'border-b-2 border-slate-600' : ''}
                ${hasStopRequest(line.id)
                  ? flash
                    ? 'shadow-[0_0_30px_8px_rgba(249,115,22,0.8)] bg-orange-950/40'
                    : 'shadow-[0_0_10px_2px_rgba(249,115,22,0.2)] bg-orange-950/10'
                  : hasRequest(line.id)
                    ? flash
                      ? 'shadow-[0_0_30px_8px_rgba(239,68,68,0.8)] bg-red-950/40'
                      : 'shadow-[0_0_10px_2px_rgba(239,68,68,0.2)] bg-red-950/10'
                    : ''
                }
              `}
            >
              {/* Line ID */}
              <div className="flex items-center">
                <span className={`
                  text-3xl font-bold transition-all duration-300
                  ${hasStopRequest(line.id)
                    ? flash ? 'text-orange-400' : 'text-green-400'
                    : hasRequest(line.id)
                      ? flash ? 'text-red-400' : 'text-green-400'
                      : 'text-green-400'
                  }
                `}>
                  {line.id}
                </span>
              </div>

              {/* Media dropdown */}
              <div className="flex items-center">
                <Select
                  value={line.data.media}
                  onValueChange={(value) => updateLine(line.id, 'media', value)}
                >
                  <SelectTrigger className="w-full h-14 text-xl border-2 border-blue-400 bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIA_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="text-xl">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product dropdown */}
              <div className="flex items-center">
                <Select
                  value={line.data.product}
                  onValueChange={(value) => updateLine(line.id, 'product', value)}
                >
                  <SelectTrigger className="w-full h-14 text-xl border-2 border-blue-400 bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="text-xl">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* QC — read only from PLC */}
              <div className="flex items-center justify-center">
                <span className={`text-2xl font-bold ${line.data.qc === 'Yes' ? 'text-green-400' : 'text-red-400'}`}>
                  {line.data.qc}
                </span>
              </div>

            </div>
          ))}
        </div>
      </div>


      {/* ── REQUEST POPUP ── */}
      {popup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 border-4 border-yellow-400 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="text-center text-6xl mb-4">🔔</div>
            <h2 className="text-2xl font-extrabold text-yellow-400 text-center mb-4">
              Request Received
            </h2>
            <div className="flex justify-center mb-3">
              <span className="bg-green-600 text-white text-2xl font-extrabold px-6 py-2 rounded-xl">
                {popup.line}
              </span>
            </div>
            <p className="text-slate-300 text-center text-lg mb-4">
              is requesting a{' '}
              <span className="text-white font-bold">
                {popup.kind === 'media' ? '🎛 Media' : '📦 Product'}
              </span>{' '}
              change
            </p>
            {popup.kind === 'media' && (
              <div className="bg-slate-900 border-2 border-yellow-400 rounded-xl px-4 py-4 mb-6 text-center">
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Requested Option</p>
                <p className="text-yellow-400 text-3xl font-extrabold">Option 1</p>
              </div>
            )}
            {popup.kind === 'product' && (
              <div className="bg-slate-900 border-2 border-blue-400 rounded-xl px-4 py-4 mb-6 text-center">
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Action Required</p>
                <p className="text-blue-400 text-xl font-bold">Please select a product for {popup.line}</p>
              </div>
            )}
            <button
              onClick={handleDismiss}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-extrabold text-xl py-3 rounded-xl transition-colors"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}


      {/* ── STOP POPUP ── */}
      {stopPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 border-4 border-orange-400 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="text-center text-6xl mb-4">🛑</div>
            <h2 className="text-2xl font-extrabold text-orange-400 text-center mb-4">
              Stop Request
            </h2>
            <div className="flex justify-center mb-3">
              <span className="bg-orange-600 text-white text-2xl font-extrabold px-6 py-2 rounded-xl">
                {stopPopup.line}
              </span>
            </div>
            <div className="bg-slate-900 border-2 border-orange-400 rounded-xl px-4 py-4 mb-6 text-center">
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">
                Stop Requested For
              </p>
              <p className="text-orange-400 text-2xl font-extrabold">
                {stopPopup.label}
              </p>
            </div>
            <button
              onClick={handleStopAcknowledge}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-extrabold text-xl py-3 rounded-xl transition-colors"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

    </div>
  );
}