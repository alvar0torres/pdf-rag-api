// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getDocumentChunks, listDocuments } from '../../../api/documents'
import DocumentExplorer from './DocumentExplorer'

vi.mock('../../../api/documents', () => ({ getDocumentChunks: vi.fn(), listDocuments: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

it('lists indexed documents and opens their stored chunks', async () => {
  vi.mocked(listDocuments).mockResolvedValue([{ filename: 'a.pdf', chunk_count: 1, page_count: 1 }])
  vi.mocked(getDocumentChunks).mockResolvedValue([{ file_name: 'a.pdf', page_number: 2, chunk_index: 1, text: 'Stored text' }])
  render(<DocumentExplorer />)

  fireEvent.click(await screen.findByRole('button', { name: /a.pdf/ }))
  expect(await screen.findByText('Stored text')).toBeTruthy()
  expect(screen.getByText('PAGE 2 · CHUNK 1')).toBeTruthy()
  expect(vi.mocked(getDocumentChunks).mock.calls[0][0]).toBe('a.pdf')
})

it('shows errors and retries loading the document list', async () => {
  vi.mocked(listDocuments).mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValueOnce([])
  render(<DocumentExplorer />)

  expect((await screen.findByRole('alert')).textContent).toBe('Database unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('No documents indexed yet.')).toBeTruthy()
})

it('refreshes documents on request', async () => {
  vi.mocked(listDocuments).mockResolvedValueOnce([]).mockResolvedValueOnce([{ filename: 'new.pdf', chunk_count: 1, page_count: 1 }])
  render(<DocumentExplorer />)
  expect(await screen.findByText('No documents indexed yet.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByRole('button', { name: /new.pdf/ })).toBeTruthy()
})
