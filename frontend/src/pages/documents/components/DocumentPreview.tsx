import type { Extraction } from '../../../api/documents'
import SectionHeading from './SectionHeading'
import styles from '../DocumentsPage.module.css'

export type DocumentStatus = 'idle' | 'extracting' | 'indexing'

type Props = {
  preview: Extraction | null
  status: DocumentStatus
  error: string
  indexedCount: number | null
  onIndex: () => void
}

function DocumentPreview({ preview, status, error, indexedCount, onIndex }: Props) {
  const chunks = preview?.pages.flatMap((page) =>
    page.chunks.map((chunk) => ({ ...chunk, page: page.page_number })),
  ) ?? []

  return (
    <section className={styles['preview-section']} aria-labelledby="preview-title">
      <SectionHeading number="02" title="Chunk preview" caption="EXPLORE YOUR DATA" id="preview-title" />
      {error && <div className={`${styles.message} ${styles.error}`} role="alert">{error}</div>}
      {status === 'extracting' && <div className={styles.message} role="status">Extracting text and preparing chunks…</div>}
      {!preview && status !== 'extracting' && (
        <div className={styles['empty-state']}><div className={styles['empty-icon']} aria-hidden="true">▧</div><h3>Nothing to preview yet</h3><p>Upload a PDF to see how it's split into chunks.</p></div>
      )}
      {preview && (
        <>
          <div className={styles['document-card']}>
            <div className={styles['document-main']}>
              <div className={styles['pdf-icon']}>PDF</div>
              <div className={styles['document-info']}>
                <strong title={preview.filename}>{preview.filename}</strong>
                <span>{preview.page_count} {preview.page_count === 1 ? 'page' : 'pages'} <b>·</b> {preview.chunk_count} {preview.chunk_count === 1 ? 'chunk' : 'chunks'}</span>
              </div>
            </div>
            <div className={styles['document-actions']}>
              <span className={styles['preview-badge']}>{indexedCount !== null ? 'Indexed' : 'Preview ready'}</span>
              <button className={styles['index-button']} type="button" onClick={onIndex} disabled={status !== 'idle' || preview.chunk_count === 0 || indexedCount !== null}>
                {status === 'indexing' ? 'Indexing…' : indexedCount !== null ? 'Indexed' : 'Index document'} <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
          <p className={styles['index-note']}>Indexing replaces any indexed document with the same filename.</p>
          {status === 'indexing' && <div className={styles.message} role="status">Creating embeddings and indexing your document…</div>}
          {indexedCount !== null && <div className={`${styles.message} ${styles.success}`} role="status">Successfully indexed {indexedCount} {indexedCount === 1 ? 'chunk' : 'chunks'}.</div>}
          {chunks.length === 0 ? <div className={styles.message}>No text could be extracted from this PDF. There are no chunks to index.</div> : (
            <div className={styles.chunks}>
              <div className={styles['chunks-header']}><span>EXTRACTED CHUNKS</span><span>{chunks.length} TOTAL</span></div>
              {chunks.map((chunk) => (
                <article className={styles.chunk} key={`${chunk.page}-${chunk.chunk_index}`}>
                  <div className={styles['chunk-meta']}><span className={styles['chunk-number']}>CHUNK {String(chunk.chunk_index).padStart(2, '0')}</span><span>PAGE {chunk.page}</span><span>{chunk.text.length} CHARS</span></div>
                  <p>{chunk.text}</p>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default DocumentPreview
