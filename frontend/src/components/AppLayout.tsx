import type { ReactNode } from 'react'
import styles from './AppLayout.module.css'

type Props = { children: ReactNode }

function AppLayout({ children }: Props) {
  return (
    <div className={styles['app-shell']}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles['brand-mark']}>✳</span>
          <span>rag<span className={styles['brand-light']}>lab</span></span>
        </div>
        <div className={styles['sidebar-label']}>WORKSPACE</div>
        <nav aria-label="Workspace">
          <div className={styles['nav-active']}>
            <span aria-hidden="true">▤</span> Documents <span className={styles['nav-indicator']} />
          </div>
        </nav>
        <div className={styles['sidebar-footer']}>
          <span className={styles['footer-dot']} /> Your RAG workspace <small>Built for exploration</small>
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <span>Workspace <span className={styles.slash}>/</span> <strong>Documents</strong></span>
          <span className={styles['topbar-tag']}><span /> LOCAL WORKSPACE</span>
        </header>
        {children}
      </main>
    </div>
  )
}

export default AppLayout
