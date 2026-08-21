import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import './App.css'

function PlaceholderPage({ title }) {
  return <div className="screen-state"><span className="eyebrow">WORKSPACE MODULE</span><h1>{title}</h1><p>This protected workspace is ready for the next operations phase.</p><button className="button button-primary" type="button" onClick={() => window.history.back()}>Go back</button></div>
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/menu" element={<PlaceholderPage title="Menu" />} />
            <Route path="/orders" element={<PlaceholderPage title="Orders" />} />
            <Route path="/inventory" element={<PlaceholderPage title="Inventory" />} />
            <Route path="/forecasts" element={<PlaceholderPage title="Forecasts" />} />
            <Route path="/purchase-orders" element={<PlaceholderPage title="Purchase orders" />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
