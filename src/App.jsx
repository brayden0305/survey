import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { supabase } from './lib/supabase'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SurveyPage from './pages/SurveyPage'
import AdminPage from './pages/AdminPage'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="page">로딩 중...</div>
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Survey Admin</div>

        <nav className="topnav">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            홈
          </NavLink>
          <NavLink to="/login" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            로그인
          </NavLink>
          <NavLink to="/survey" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            설문
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            관리자
          </NavLink>
        </nav>

        <div className="user-box">
          {user ? (
            <>
              <span className="user-badge">{user.email}</span>
              <button className="btn btn-secondary" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <span className="user-badge">로그인 안 됨</span>
          )}
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePage user={user} />} />
        <Route path="/login" element={<LoginPage user={user} />} />
        <Route path="/survey" element={<SurveyPage user={user} />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} adminOnly={true}>
              <AdminPage user={user} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}

export default App
