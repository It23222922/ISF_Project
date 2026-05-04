import { useEffect, useState } from 'react';
import { SystemState } from '../types';
import { getSystemState } from '../utils/storage';

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
// Request state type
// ─────────────────────────────────────────
interface LineRequests {
  media:          boolean;
  product:        boolean;
  media_option:   string | null;
  product_option: string | null;
}

interface RequestState {
  L1: LineRequests;
  L2: LineRequests;
  L3: LineRequests;
  L4: LineRequests;
}

// ─────────────────────────────────────────
// Stop state type
// ─────────────────────────────────────────
interface LineStops {
  stop_product: boolean;
  stop_media:   boolean;
}

interface StopState {
  L1: LineStops;
  L2: LineStops;
  L3: LineStops;
  L4: LineStops;
}

export function Screen1Display() {
  const [state, setState]       = useState<SystemState>(getSystemState());
  const [requests, setRequests] = useState<RequestState>({
    L1: { media: false, product: false, media_option: null, product_option: null },
    L2: { media: false, product: false, media_option: null, product_option: null },
    L3: { media: false, product: false, media_option: null, product_option: null },
    L4: { media: false, product: false, media_option: null, product_option: null },
  });
  const [stops, setStops]       = useState<StopState>({
    L1: { stop_product: false, stop_media: false },
    L2: { stop_product: false, stop_media: false },
    L3: { stop_product: false, stop_media: false },
    L4: { stop_product: false, stop_media: false },
  });
  const [flash, setFlash]       = useState(false);

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
    // Poll media + product from PLC every second
    // ─────────────────────────────────────────
    const fetchLineState = async () => {
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
        console.error('❌ Could not read line state from PLC:', error)
      }
    }
    fetchLineState()
    const lineInterval = setInterval(fetchLineState, 1000)

    // ─────────────────────────────────────────
    // Poll QC from PLC every 2 seconds
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
        console.error('❌ Could not read QC from PLC:', error)
      }
    }
    fetchQC()
    const qcInterval = setInterval(fetchQC, 2000)

    // ─────────────────────────────────────────
    // Poll HMI requests — red underglow
    // ─────────────────────────────────────────
    const fetchRequests = async () => {
      try {
        const res  = await fetch(`${API}/api/get-requests`)
        const data = await res.json()
        if (data.status === 'success') {
          setRequests(data.requests)
        }
      } catch (error) {
        console.error('❌ Could not read requests:', error)
      }
    }
    fetchRequests()
    const requestInterval = setInterval(fetchRequests, 1000)

    // ─────────────────────────────────────────
    // Poll stop requests — orange underglow
    // ─────────────────────────────────────────
    const fetchStops = async () => {
      try {
        const res  = await fetch(`${API}/api/get-stop-requests`)
        const data = await res.json()
        if (data.status === 'success') {
          setStops(data.stops)
        }
      } catch (error) {
        console.error('❌ Could not read stop requests:', error)
      }
    }
    fetchStops()
    const stopInterval = setInterval(fetchStops, 1000)

    return () => {
      clearInterval(lineInterval)
      clearInterval(qcInterval)
      clearInterval(requestInterval)
      clearInterval(stopInterval)
    }
  }, []);

  const lines = [
    { id: 'L1', data: state.L1 },
    { id: 'L2', data: state.L2 },
    { id: 'L3', data: state.L3 },
    { id: 'L4', data: state.L4 },
  ];

  // ─────────────────────────────────────────
  // Red underglow — active request per line
  // ─────────────────────────────────────────
  const hasRequest = (id: string) => {
    const line = requests[id as keyof RequestState]
    if (!line) return false
    return line.media || line.product
  }

  // ─────────────────────────────────────────
  // Orange underglow — stop active per line
  // ─────────────────────────────────────────
  const hasStopped = (id: string) => {
    const line = stops[id as keyof StopState]
    if (!line) return false
    return line.stop_product || line.stop_media
  }

  return (
    <div className="min-h-screen bg-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r text-center from-blue-600 to-blue-700 text-white px-6 py-5 mb-6 rounded-lg shadow-xl">
          <h1 className="text-4xl font-bold tracking-wide">Display Only</h1>
        </div>

        {/* Main content */}
        <div className="bg-slate-700 border-4 border-blue-500 rounded-lg shadow-2xl overflow-hidden">
          {/* Column Headers */}
          <div className="grid grid-cols-[180px_1fr_1fr_180px] gap-4 px-6 py-6 border-b-4 border-blue-500 bg-slate-900">
            <div></div>
            <div className="text-3xl font-bold text-center text-yellow-400">Media</div>
            <div className="text-3xl font-bold text-center text-yellow-400">Products</div>
            <div className="text-3xl font-bold text-center text-yellow-400">QC</div>
          </div>

          {/* Lines */}
          {lines.map((line, index) => (
            <div
              key={line.id}
              className={`
                grid grid-cols-[180px_1fr_1fr_180px] gap-4 px-6 py-8
                transition-all duration-300
                ${index < lines.length - 1 ? 'border-b-2 border-slate-600' : ''}
                ${hasStopped(line.id)
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
              <div className="flex items-center">
                <span className={`
                  inline-flex min-w-28 justify-center rounded-xl border-2 px-4 py-3
                  text-5xl font-extrabold tracking-wider shadow-xl ring-2
                  transition-all duration-300
                  ${hasStopped(line.id)
                    ? flash
                      ? 'border-orange-400 bg-orange-600 text-white ring-orange-400/60'
                      : 'border-primary-foreground/40 bg-primary text-primary-foreground ring-ring/60'
                    : hasRequest(line.id)
                      ? flash
                        ? 'border-red-400 bg-red-600 text-white ring-red-400/60'
                        : 'border-primary-foreground/40 bg-primary text-primary-foreground ring-ring/60'
                      : 'border-primary-foreground/40 bg-primary text-primary-foreground ring-ring/60'
                  }
                `}>
                  {line.id}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <div className="bg-slate-900 border-2 border-green-500 px-6 py-4 rounded-lg w-full max-w-md shadow-lg">
                  <span className="text-2xl font-semibold text-white">{line.data.media}</span>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="bg-slate-900 border-2 border-green-500 px-6 py-4 rounded-lg w-full max-w-md shadow-lg">
                  <span className="text-2xl font-semibold text-white">{line.data.product}</span>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <span
                  className={`inline-flex min-w-28 justify-center rounded-xl border-2 px-5 py-3 text-3xl font-extrabold uppercase tracking-wider text-white shadow-xl ring-2 ${
                    line.data.qc === 'Yes'
                      ? 'border-green-300 bg-green-600 ring-green-300/60'
                      : 'border-red-300 bg-red-600 ring-red-300/60'
                  }`}
                >
                  {line.data.qc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}