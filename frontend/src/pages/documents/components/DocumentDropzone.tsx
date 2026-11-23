import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import SectionHeading from './SectionHeading'
import styles from '../DocumentsPage.module.css'

type Props = {
  busy: boolean
  onSelect: (file: File) => void
  onError: (message: string) => void
}

function DocumentDropzone({ busy, onSelect, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (selected) onSelect(selected)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    if (event.dataTransfer.files.length !== 1) {
      onError('Please choose one PDF at a time.')
      return
    }
    onSelect(event.dataTransfer.files[0])
  }

  return (
    <section aria-labelledby="upload-title">
      <SectionHeading number="01" title="Add a document" caption="PDF DOCUMENTS" id="upload-title" />
      <div
        className={[styles.dropzone, dragging && styles['is-dragging'], busy && styles['is-busy']].filter(Boolean).join(' ')}
        onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
        onDrop={onDrop}
      >
        <div className={styles['upload-icon']} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>
        <h3>Drop your PDF here</h3>
        <p>or <button className={styles['browse-button']} type="button" disabled={busy} onClick={() => inputRef.current?.click()}>browse files</button> to upload</p>
        <span className={styles['file-hint']}>ONE PDF AT A TIME</span>
        <input ref={inputRef} className={styles['visually-hidden']} type="file" accept=".pdf,application/pdf" onChange={onFileChange} disabled={busy} aria-label="Choose a PDF file" />
      </div>
      <div className={styles['upload-note']}><span aria-hidden="true">ⓘ</span> Previewing extracts text only. Indexing uses the embedding API and may incur charges.</div>
    </section>
  )
}

export default DocumentDropzone
