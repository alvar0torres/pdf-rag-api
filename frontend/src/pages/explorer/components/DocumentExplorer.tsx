import { useEffect, useState } from 'react'
import { deleteDocument, getDocumentChunks, listDocuments } from '../../../api/documents'
import type { IndexedChunk, IndexedDocument } from '../../../api/documents'
import styles from './DocumentExplorer.module.css'

type ListResult = { key: string; documents: IndexedDocument[]; error: string }
type ChunkResult = { key: string; chunks: IndexedChunk[]; error: string }

function DocumentExplorer() {
  const [listResult, setListResult] = useState<ListResult | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [chunkResult, setChunkResult] = useState<ChunkResult | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const listKey = String(refresh)
  const chunkKey = `${listKey}:${selected}`
  const loadingDocuments = listResult?.key !== listKey
  const documents = loadingDocuments ? [] : listResult.documents
  const listError = loadingDocuments ? '' : listResult.error
  const loadingChunks = chunkResult?.key !== chunkKey
  const chunks = loadingChunks ? [] : chunkResult.chunks
  const chunkError = loadingChunks ? '' : chunkResult.error
  const selectedIsPresent = documents.some((document) => document.filename === selected)

  useEffect(() => {
    const controller = new AbortController()
    listDocuments(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setListResult({ key: listKey, documents: result, error: '' })
        setSelected((current) => current && result.some((item) => item.filename === current) ? current : null)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setListResult({ key: listKey, documents: [], error: error instanceof Error ? error.message : 'Could not load indexed documents.' })
        }
      })
    return () => controller.abort()
  }, [listKey])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    getDocumentChunks(selected, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setChunkResult({ key: chunkKey, chunks: result, error: '' })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setChunkResult({ key: chunkKey, chunks: [], error: error instanceof Error ? error.message : 'Could not load document chunks.' })
        }
      })
    return () => controller.abort()
  }, [selected, chunkKey])

  async function removeDocument(filename: string) {
    if (deleting || !window.confirm(`Remove "${filename}" from the index? Its indexed chunks will be deleted.`)) return
    setDeleteError('')
    setDeleting(filename)
    try {
      await deleteDocument(filename)
      setListResult((current) => current && {
        ...current,
        documents: current.documents.filter((document) => document.filename !== filename),
      })
      setSelected((current) => current === filename ? null : current)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not remove document.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section className={styles.explorer} aria-labelledby="explorer-title">
      <h2 className={styles.heading} id="explorer-title">Indexed documents</h2>
      <p className={styles.description}>Explore stored text chunks. Original PDFs are not stored in the index.</p>
      <button className={styles.refresh} type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loadingDocuments || deleting !== null}>Refresh</button>
      {loadingDocuments && <p className={styles.notice} role="status">Loading indexed documents…</p>}
      {listError && <p className={styles.error} role="alert">{listError}</p>}
      {deleteError && <p className={styles.error} role="alert">{deleteError}</p>}
      {!loadingDocuments && !listError && documents.length === 0 && <p className={styles.notice}>No documents indexed yet.</p>}
      {!loadingDocuments && !listError && documents.length > 0 && (
        <div className={styles.list}>
          {documents.map((document) => (
            <div className={styles.documentRow} key={document.filename}>
              <button type="button" className={styles.document} aria-expanded={selected === document.filename} onClick={() => { setChunkResult(null); setSelected(selected === document.filename ? null : document.filename) }}>
                <span><strong>{document.filename}</strong><small>{document.chunk_count} {document.chunk_count === 1 ? 'chunk' : 'chunks'} · {document.page_count} {document.page_count === 1 ? 'page with text' : 'pages with text'}</small></span>
                <span aria-hidden="true">{selected === document.filename ? '−' : '+'}</span>
              </button>
              <button type="button" className={styles.delete} aria-label={`Remove ${document.filename}`} disabled={deleting !== null} onClick={() => void removeDocument(document.filename)}>
                {deleting === document.filename ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
      {selected && selectedIsPresent && !listError && (
        <div className={styles.detail}>
          <h3>Chunks in {selected}</h3>
          {loadingChunks && <p className={styles.notice} role="status">Loading chunks…</p>}
          {chunkError && <p className={styles.error} role="alert">{chunkError}</p>}
          {!loadingChunks && !chunkError && chunks.map((chunk, index) => (
            <article className={styles.chunk} key={`${chunk.page_number}-${chunk.chunk_index}-${index}`}>
              <div>PAGE {chunk.page_number} · CHUNK {chunk.chunk_index}</div>
              <p>{chunk.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default DocumentExplorer
