import { useEffect, useState } from 'react';
import { SystemState } from '../types';
import { getSystemState } from '../utils/storage';

export function Screen1Display() {
  const [state, setState] = useState<SystemState>(getSystemState());

  useEffect(() => {
    // ─────────────────────────────────────────
    // Poll media and product from localStorage
    // but NEVER overwrite qc from storage
    // ─────────────────────────────────────────
    const handleStorageChange = () => {
      const stored = getSystemState()
      setState(prev => ({
        ...prev,
        L1: { ...stored.L1, qc: prev.L1.qc },  // preserve PLC qc value
        L2: { ...stored.L2, qc: prev.L2.qc },
        L3: { ...stored.L3, qc: prev.L3.qc },
        L4: { ...stored.L4, qc: prev.L4.qc },
      }))
    }
    window.addEventListener('storage', handleStorageChange)
    const storageInterval = setInterval(handleStorageChange, 500)

    // ─────────────────────────────────────────
    // Poll QC from PLC only — never from storage
    // ─────────────────────────────────────────
    const fetchQC = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/get-qc')
        const data = await res.json()

        if (data.status === 'success') {
          setState(prev => {
            // Only re-render if QC actually changed
            const hasChanged =
              prev.L1.qc !== data.qc.L1 ||
              prev.L2.qc !== data.qc.L2 ||
              prev.L3.qc !== data.qc.L3 ||
              prev.L4.qc !== data.qc.L4

            if (!hasChanged) return prev  // no re-render, no flashing

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

    fetchQC()                                      // read immediately on load
    const qcInterval = setInterval(fetchQC, 2000)  // then every 2 seconds

    // Cleanup both intervals on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(storageInterval)
      clearInterval(qcInterval)
    }
  }, []);

  const lines = [
    { id: 'L1', data: state.L1 },
    { id: 'L2', data: state.L2 },
    { id: 'L3', data: state.L3 },
    { id: 'L4', data: state.L4 },
  ];

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
              className={`grid grid-cols-[180px_1fr_1fr_180px] gap-4 px-6 py-8 ${
                index < lines.length - 1 ? 'border-b-2 border-slate-600' : ''
              }`}
            >
              <div className="flex items-center">
                <span className="inline-flex min-w-28 justify-center rounded-xl border-2 border-primary-foreground/40 bg-primary px-4 py-3 text-5xl font-extrabold tracking-wider text-primary-foreground shadow-xl ring-2 ring-ring/60">
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