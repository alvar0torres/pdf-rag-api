import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import styles from './AppLayout.module.css'

function AppLayout() {
  const { pathname } = useLocation()
  const pageTitle = pathname === '/chat' ? 'Chat' : pathname === '/explorer' ? 'Document explorer' : 'Index documents'

  useEffect(() => {
    document.title = `${pageTitle} | RAG Lab`
  }, [pageTitle])

  return (
    <div className={styles['app-shell']}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles['brand-mark']}>✳</span>
          <span>rag<span className={styles['brand-light']}>lab</span></span>
        </div>
        <div className={styles['sidebar-label']}>WORKSPACE</div>
        <nav aria-label="Workspace">
          <NavLink to="/documents" className={({ isActive }) => `${styles.navLink} ${isActive ? styles['nav-active'] : ''}`}>
            <span aria-hidden="true">▤</span> Index documents <span className={styles['nav-indicator']} />
          </NavLink>
          <NavLink to="/explorer" className={({ isActive }) => `${styles.navLink} ${isActive ? styles['nav-active'] : ''}`}>
            <span aria-hidden="true">▧</span> Explorer <span className={styles['nav-indicator']} />
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => `${styles.navLink} ${isActive ? styles['nav-active'] : ''}`}>
            <span aria-hidden="true">✳</span> Chat <span className={styles['nav-indicator']} />
          </NavLink>
        </nav>
        <div className={styles['sidebar-footer']}>
          <span className={styles['footer-dot']} /> Your RAG workspace <small>Built for exploration</small>
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <span>Workspace <span className={styles.slash}>/</span> <strong>{pageTitle}</strong></span>
          <span className={styles['topbar-tag']}><span /> LOCAL WORKSPACE</span>
        </header>
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
