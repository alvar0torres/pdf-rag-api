import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import styles from './AppLayout.module.css'

const pageTitles: Record<string, string> = {
  '/chat': 'Chat',
  '/explorer': 'Document explorer',
  '/evaluation': 'Evaluation',
  '/map': 'Embedding map',
}

function AppLayout() {
  const { pathname } = useLocation()
  const pageTitle = pageTitles[pathname] ?? 'Index documents'

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
            <svg className={styles.navIcon} aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M14 3v6h6M12 17v-5m-2 2 2-2 2 2" />
            </svg>
            Index documents <span className={styles['nav-indicator']} />
          </NavLink>
          <NavLink to="/explorer" className={({ isActive }) => `${styles.navLink} ${isActive ? styles['nav-active'] : ''}`}>
            <svg className={styles.navIcon} aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 19H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2" />
              <circle cx="16" cy="16" r="3" /><path d="m18.2 18.2 2.8 2.8" />
            </svg>
            Explorer <span className={styles['nav-indicator']} />
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => `${styles.navLink} ${isActive ? styles['nav-active'] : ''}`}>
            <svg className={styles.navIcon} aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="7" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="m8 7 8-1M7 9l4 7m6-8-4 8" />
            </svg>
            Embedding map <span className={styles['nav-indicator']} />
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => `${styles.navLink} ${isActive ? styles['nav-active'] : ''}`}>
            <svg className={styles.navIcon} aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
              <path d="M7 9h10M7 13h7" />
            </svg>
            Chat <span className={styles['nav-indicator']} />
          </NavLink>
          <NavLink to="/evaluation" className={({ isActive }) => `${styles.navLink} ${isActive ? styles['nav-active'] : ''}`}>
            <svg className={styles.navIcon} aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16M7 17v-5M12 17V5M17 17V9" />
            </svg>
            Evaluation <span className={styles['nav-indicator']} />
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
