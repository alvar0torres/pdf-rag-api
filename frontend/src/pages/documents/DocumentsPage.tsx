import { useState } from 'react'
import { extractDocument, ingestDocument } from '../../api/documents'
import type { Extraction } from '../../api/documents'
import DocumentDropzone from './components/DocumentDropzone'
import DocumentPreview from './components/DocumentPreview'
import type { DocumentStatus } from './components/DocumentPreview'
import styles from './DocumentsPage.module.css'

function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Extraction | null>(null)
  const [status, setStatus] = useState<DocumentStatus>('idle')
  const [error, setError] = useState('')
  const [indexedCount, setIndexedCount] = useState<number | null>(null)

  async function selectFile(selected: File) {
    setError('')
    setPreview(null)
    setFile(null)
    setIndexedCount(null)
    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      return
    }
    setFile(selected)
    setStatus('extracting')
    try {
      setPreview(await extractDocument(selected))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract this PDF.')
    } finally {
      setStatus('idle')
    }
  }

  async function indexDocument() {
    if (!file || !preview || preview.chunk_count === 0) return
    setError('')
    setStatus('indexing')
    try {
      const result = await ingestDocument(file)
      setIndexedCount(result.indexed_count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not index this PDF.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className={styles.content}>
      <div className={styles.eyebrow}><span /> KNOWLEDGE BASE</div>
      <div className={styles['heading-row']}>
        <div><h1>Documents</h1><p>Bring your knowledge in. See how it comes together.</p></div>
        <div className={styles['heading-icon']} aria-hidden="true">✳</div>
      </div>
      <DocumentDropzone busy={status !== 'idle'} onSelect={(selected) => void selectFile(selected)} onError={setError} />
      <DocumentPreview preview={preview} status={status} error={error} indexedCount={indexedCount} onIndex={() => void indexDocument()} />
      <footer className={styles['page-footer']}><span>RAG LAB <span> / </span> DOCUMENTS</span></footer>
    </div>
  )
}

export default DocumentsPage
