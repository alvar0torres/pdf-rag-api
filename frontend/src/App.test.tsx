// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'
import { extractDocument, ingestDocument, listDocuments } from './api/documents'
import { getEvaluationInfo } from './api/evaluations'

vi.mock('./api/documents', () => ({
  extractDocument: vi.fn(),
  ingestDocument: vi.fn(),
  listDocuments: vi.fn(),
  getDocumentChunks: vi.fn(),
}))
vi.mock('./api/evaluations', () => ({ getEvaluationInfo: vi.fn(), runEvaluation: vi.fn() }))
afterEach(cleanup)

it('opens a fresh explorer after indexing and navigates back to indexing', async () => {
  window.history.replaceState({}, '', '/documents')
  vi.mocked(extractDocument).mockResolvedValue({
    filename: 'new.pdf', page_count: 1, chunk_count: 1,
    pages: [{ page_number: 1, chunks: [{ chunk_index: 1, text: 'Preview text' }] }],
  })

  vi.mocked(ingestDocument).mockResolvedValue({ indexed_count: 1 })
  vi.mocked(listDocuments).mockResolvedValue([{ filename: 'new.pdf', chunk_count: 1, page_count: 1 }])
  render(<App />)

  const file = new File(['pdf'], 'new.pdf', { type: 'application/pdf' })
  fireEvent.change(screen.getByLabelText('Choose a PDF file'), { target: { files: [file] } })
  await screen.findByText('Preview text')
  fireEvent.click(screen.getByRole('button', { name: 'Index document' }))
  await screen.findByText('Successfully indexed 1 chunk.')
  expect(listDocuments).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('link', { name: 'Explorer' }))
  expect(await screen.findByRole('button', { name: /new.pdf/ })).toBeTruthy()
  expect(screen.queryByLabelText('Choose a PDF file')).toBeNull()
  expect(document.title).toBe('Document explorer | RAG Lab')

  fireEvent.click(screen.getByRole('link', { name: 'Index documents' }))
  expect(screen.getByLabelText('Choose a PDF file')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Indexed documents' })).toBeNull()
})

it('navigates to the evaluation page', async () => {
  window.history.replaceState({}, '', '/documents')
  vi.mocked(getEvaluationInfo).mockResolvedValue({
    title: 'Test benchmark', source_file: 'test.pdf', question_count: 2,
    top_k: 5, candidate_limit: 20, modes: ['dense'],
  })
  render(<App />)

  fireEvent.click(screen.getByRole('link', { name: 'Evaluation' }))
  expect(await screen.findByText('Test benchmark')).toBeTruthy()
  expect(document.title).toBe('Evaluation | RAG Lab')
})
