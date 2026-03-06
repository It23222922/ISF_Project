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

export function Screen2Control() {
  const [state, setState] = useState<SystemState>(getSystemState());

  useEffect(() => {
    // ─────────────────────────────────────────
    // Poll media and product from local storage
    // ─────────────────────────────────────────
    const handleStorageChange = () => {
      setState(getSystemState());
    };
    window.addEventListener('storage', handleStorageChange);

    // ─────────────────────────────────────────
    // Poll QC values from PLC every 2 seconds
    // ─────────────────────────────────────────
    const fetchQC = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/get-qc')
        const data = await res.json()

        if (data.status === 'success') {
          setState(prev => ({
            ...prev,
            L1: { ...prev.L1, qc: data.qc.L1 },
            L2: { ...prev.L2, qc: data.qc.L2 },
            L3: { ...prev.L3, qc: data.qc.L3 },
            L4: { ...prev.L4, qc: data.qc.L4 },
          }))
        }
      } catch (error) {
        console.error('❌ Could not read QC from PLC:', error)
      }
    }

    fetchQC()                                       // read immediately on load
    const qcInterval = setInterval(fetchQC, 2000)  // then every 2 seconds

    // Cleanup on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(qcInterval)
    };
  }, []);


  // ─────────────────────────────────────────
  // Write media and product only (no QC)
  // ─────────────────────────────────────────
  const updateLine = async (line: keyof SystemState, field: 'media' | 'product', value: string) => {
    // 1. Update UI state
    const newState = {
      ...state,
      [line]: {
        ...state[line],
        [field]: value,
      },
    };
    setState(newState);
    setSystemState(newState);

    // 2. Send media and product to Flask → PLC (no QC)
    try {
      const updatedLine = newState[line];

      const response = await fetch('http://localhost:5000/api/set-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line:    line,                  // 'L1', 'L2', 'L3', 'L4'
          media:   updatedLine.media,     // current media value
          product: updatedLine.product,   // current product value
          // ❌ qc removed — PLC controls it
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

  return (
    <div className="min-h-screen bg-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r text-center from-green-600 to-green-700 text-white px-5 py-4 mb-5 rounded-lg shadow-xl">
          <h1 className="text-2xl font-bold tracking-wide">Control Panel</h1>
        </div>

        {/* Main content */}
        <div className="bg-slate-700 border-4 border-green-500 rounded-lg shadow-2xl overflow-hidden">
          {/* Column Headers */}
          <div className="grid grid-cols-[100px_1fr_1fr_100px] gap-3 px-4 py-4 border-b-4 border-green-500 bg-slate-900">
            <div></div>
            <div className="text-xl font-bold text-center text-yellow-400">Media</div>
            <div className="text-xl font-bold text-center text-yellow-400">Products</div>
            <div className="text-xl font-bold text-center text-yellow-400">QC</div>
          </div>

          {/* Lines */}
          {lines.map((line, index) => (
            <div 
              key={line.id}
              className={`grid grid-cols-[100px_1fr_1fr_100px] gap-3 px-4 py-5 ${
                index < lines.length - 1 ? 'border-b-2 border-slate-600' : ''
              }`}
            >
              <div className="flex items-center">
                <span className="text-2xl font-bold text-green-400">{line.id}</span>
              </div>
              <div className="flex items-center">
                <Select 
                  value={line.data.media} 
                  onValueChange={(value) => updateLine(line.id, 'media', value)}
                >
                  <SelectTrigger className="w-full h-12 text-lg border-2 border-blue-400 bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIA_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="text-lg">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center">
                <Select 
                  value={line.data.product} 
                  onValueChange={(value) => updateLine(line.id, 'product', value)}
                >
                  <SelectTrigger className="w-full h-12 text-lg border-2 border-blue-400 bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="text-lg">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* QC — read only from PLC */}
              <div className="flex items-center justify-center">
                <span className={`text-xl font-bold ${line.data.qc === 'Yes' ? 'text-green-400' : 'text-red-400'}`}>
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