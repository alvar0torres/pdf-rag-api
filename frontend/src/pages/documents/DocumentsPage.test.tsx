// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractDocument, ingestDocument } from '../../api/documents'
import DocumentsPage from './DocumentsPage'

vi.mock('../../api/documents', () => ({
  extractDocument: vi.fn(),
  ingestDocument: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})
afterEach(cleanup)

const preview = {
  filename: 'document.pdf',
  page_count: 1,
  chunk_count: 1,
  pages: [{ page_number: 1, chunks: [{ chunk_index: 1, text: 'A chunk of text' }] }],
}

function chooseFile(name: string) {
  const file = new File(['content'], name, { type: 'application/pdf' })
  fireEvent.change(screen.getByLabelText('Choose a PDF file'), { target: { files: [file] } })
  return file
}

describe('DocumentsPage', () => {
  it('previews a PDF before explicitly indexing it', async () => {
    vi.mocked(extractDocument).mockResolvedValue(preview)
    vi.mocked(ingestDocument).mockResolvedValue({ indexed_count: 1 })
    render(<DocumentsPage />)

    const file = chooseFile('document.pdf')
    expect(await screen.findByText('A chunk of text')).toBeTruthy()
    expect(extractDocument).toHaveBeenCalledWith(file)
    expect(ingestDocument).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Index document' }))
    expect(await screen.findByText('Successfully indexed 1 chunk.')).toBeTruthy()
    expect(ingestDocument).toHaveBeenCalledWith(file)
  })

  it('rejects non-PDF files without making an API call', () => {
    render(<DocumentsPage />)
    chooseFile('notes.txt')

    expect(screen.getByRole('alert').textContent).toBe('Please choose a PDF file.')
    expect(extractDocument).not.toHaveBeenCalled()
  })

  it('shows extraction errors and allows another file to be selected', async () => {
    vi.mocked(extractDocument).mockRejectedValueOnce(new Error('Extraction failed.')).mockResolvedValueOnce(preview)
    render(<DocumentsPage />)

    chooseFile('broken.pdf')
    expect((await screen.findByRole('alert')).textContent).toBe('Extraction failed.')
    chooseFile('document.pdf')
    expect(await screen.findByText('A chunk of text')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the preview and allows retry after an indexing failure', async () => {
    vi.mocked(extractDocument).mockResolvedValue(preview)
    vi.mocked(ingestDocument).mockRejectedValueOnce(new Error('Indexing failed.')).mockResolvedValueOnce({ indexed_count: 1 })
    render(<DocumentsPage />)

    chooseFile('document.pdf')
    await screen.findByText('A chunk of text')
    fireEvent.click(screen.getByRole('button', { name: 'Index document' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Indexing failed.')
    expect(screen.getByText('A chunk of text')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Index document' }))
    expect(await screen.findByText('Successfully indexed 1 chunk.')).toBeTruthy()
    expect(ingestDocument).toHaveBeenCalledTimes(2)
  })
})
