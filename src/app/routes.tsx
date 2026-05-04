import { createBrowserRouter } from "react-router";
import { HomeSelector } from "./components/HomeSelector";
import { Screen1Display } from "./components/Screen1Display";
import { Screen2Control } from "./components/Screen2Control";
import { LogPage } from './components/LogPage';

// ─────────────────────────────────────────
// Block Screen 2 if accessed from network IP
// (Production PC uses 192.168.10.1 to access)
// Operator PC accesses via localhost
// ─────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hostname = window.location.hostname

  const isOperatorPC = hostname === 'localhost' || hostname === '127.0.0.1'

  if (!isOperatorPC) return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-3xl font-bold text-red-400 mb-2">Access Denied</h1>
        <p className="text-slate-400 text-lg">This screen is only available on the operator PC.</p>
      </div>
    </div>
  )

  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: HomeSelector,
  },
  {
    path: "/screen1",
    Component: Screen1Display,
  },
  {
    path: "/screen2",
    element: (
      <ProtectedRoute>
        <Screen2Control />
      </ProtectedRoute>
    ),
  },
  // Add inside createBrowserRouter:
{
  path: '/logs',
  element: (
    <ProtectedRoute>
      <LogPage />
    </ProtectedRoute>
  ),
},
]);

