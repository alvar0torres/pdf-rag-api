// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Extraction } from '../../../api/documents'
import DocumentPreview from './DocumentPreview'

afterEach(cleanup)

const preview: Extraction = {
  filename: 'document.pdf',
  page_count: 2,
  chunk_count: 2,
  pages: [
    { page_number: 1, chunks: [{ chunk_index: 1, text: 'First chunk' }] },
    { page_number: 2, chunks: [{ chunk_index: 1, text: 'Second chunk' }] },
  ],
}

describe('DocumentPreview', () => {
  it('shows chunks and invokes indexing only on request', () => {
    const onIndex = vi.fn()
    render(<DocumentPreview preview={preview} status="idle" error="" indexedCount={null} onIndex={onIndex} />)

    expect(screen.getByText('document.pdf')).toBeTruthy()
    expect(screen.getByText('First chunk')).toBeTruthy()
    expect(screen.getByText('Second chunk')).toBeTruthy()
    expect(screen.getByText('PAGE 2')).toBeTruthy()
    expect(onIndex).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Index document' }))
    expect(onIndex).toHaveBeenCalledOnce()
  })

  it('prevents indexing when no text was extracted or indexing is complete', () => {
    const empty = { ...preview, chunk_count: 0, pages: [] }
    const { rerender } = render(<DocumentPreview preview={empty} status="idle" error="" indexedCount={null} onIndex={vi.fn()} />)

    expect(screen.getByText(/No text could be extracted/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Index document' }) as HTMLButtonElement).disabled).toBe(true)

    rerender(<DocumentPreview preview={preview} status="idle" error="" indexedCount={2} onIndex={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toContain('Successfully indexed 2 chunks.')
    expect((screen.getByRole('button', { name: 'Indexed' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
