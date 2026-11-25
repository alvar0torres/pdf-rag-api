import DocumentExplorer from './components/DocumentExplorer'
import styles from './ExplorerPage.module.css'

function ExplorerPage() {
  return (
    <div className={styles.content}>
      <div className={styles.eyebrow}><span /> KNOWLEDGE BASE</div>
      <div className={styles.heading}>
        <div><h1>Document explorer</h1><p>Browse the documents and chunks in your index.</p></div>
        <span aria-hidden="true">✳</span>
      </div>
      <DocumentExplorer />
    </div>
  )
}

export default ExplorerPage
