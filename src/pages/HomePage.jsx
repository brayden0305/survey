import { Link } from 'react-router-dom'

function HomePage({ user }) {
  return (
    <div className="page">
      <section className="hero">
        <h1>설문 앱 대시보드</h1>
        <p>모바일에서도 쓰기 좋은 설문 시스템을 직접 만들고 있습니다.</p>
      </section>

      <div className="grid-3" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3 className="section-title" style={{ fontSize: '20px' }}>로그인 상태</h3>
          {user ? (
            <p><strong>{user.email}</strong> 계정으로 로그인되어 있습니다.</p>
          ) : (
            <p className="muted">현재 로그인되지 않았습니다.</p>
          )}
        </div>

        <div className="card">
          <h3 className="section-title" style={{ fontSize: '20px' }}>설문 응답</h3>
          <p className="muted">사용자용 설문 페이지로 이동해서 실제 응답 흐름을 확인할 수 있습니다.</p>
          <div className="button-row" style={{ marginTop: '12px' }}>
            <Link className="btn btn-primary" to="/survey">설문 열기</Link>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title" style={{ fontSize: '20px' }}>관리자 기능</h3>
          <p className="muted">응답 통계, CSV 다운로드, 설문 생성 기능을 관리자 페이지에서 확인할 수 있습니다.</p>
          <div className="button-row" style={{ marginTop: '12px' }}>
            <Link className="btn btn-secondary" to="/admin">관리자 이동</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
