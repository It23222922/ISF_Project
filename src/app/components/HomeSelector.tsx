import { Link } from 'react-router';

export function HomeSelector() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="bg-slate-700 rounded-lg shadow-2xl p-8 border-2 border-slate-600">
          <h1 className="text-4xl font-bold text-center mb-8 text-yellow-400">
            Screen Selection
          </h1>
          
          <div className="space-y-6">
            <Link to="/screen1">
              <button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 px-8 rounded-lg text-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                Screen 1 - Display Only
              </button>
            </Link>
            
            <Link to="/screen2">
              <button className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-6 px-8 rounded-lg text-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                Screen 2 - Control Panel
              </button>
            </Link>
          </div>

          <div className="mt-8 p-4 bg-slate-800 rounded border border-slate-600">
            <h2 className="font-semibold text-yellow-400 mb-2">System Overview:</h2>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Screen 1: Large display showing current line status (read-only)</li>
              <li>• Screen 2: Control panel for selecting Media and Product options</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}