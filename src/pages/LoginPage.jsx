import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function LoginPage({ user }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage('로그인 실패: ' + error.message)
    } else {
      setMessage('로그인 성공')
    }

    setLoading(false)
  }

  const handleSignup = async () => {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage('회원가입 실패: ' + error.message)
    } else {
      if (data.session) {
        setMessage('회원가입 및 로그인 성공')
      } else {
        setMessage('회원가입 성공. 이메일 인증이 켜져 있다면 메일을 확인하세요.')
      }
    }

    setLoading(false)
  }

  const isError = message.includes('실패')

  return (
    <div className="page page-narrow">
      <section className="hero">
        <h1>로그인</h1>
        <p>설문 응답 제출과 관리자 기능 접근을 위해 로그인하세요.</p>
      </section>

      <div className="card" style={{ marginTop: '20px' }}>
        <form onSubmit={handleLogin} className="form-group" style={{ gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">이메일</label>
            <input
              className="input"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">비밀번호</label>
            <input
              className="input"
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="button-row" style={{ marginTop: '8px' }}>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? '처리 중...' : '로그인'}
            </button>

            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="btn btn-secondary"
            >
              테스트 회원가입
            </button>
          </div>
        </form>

        {message && (
          <div
            className={`notice ${isError ? 'notice-error' : 'notice-success'}`}
            style={{ marginTop: '16px' }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginPage
