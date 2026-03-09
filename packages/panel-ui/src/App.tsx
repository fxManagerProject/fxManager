import { Navigate, Route, Routes } from "react-router-dom"
import AppLayout from "./components/sidebar"
import { ProtectedRoute } from "./components/protected-route"
import LoginPage from "./pages/LoginPage"
import Dashboard from "./pages/Dashboard"
import Settings from "./pages/Settings"
import Players from "./pages/Players"
import Console from "./pages/Console"

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={<ProtectedRoute element={Dashboard} />}
        />
        <Route
          path="/players"
          element={<ProtectedRoute element={Players} />}
        />
        <Route
          path="/console"
          element={<ProtectedRoute element={Console} />}
        />
        <Route
          path="/settings"
          element={<ProtectedRoute element={Settings} />}
        />
      </Route>

      <Route path="*" element={<p>Not Found</p>} />
    </Routes>
  )
}

export default App
