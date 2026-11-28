// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { deleteDocument, getDocumentChunks, listDocuments } from '../../../api/documents'
import DocumentExplorer from './DocumentExplorer'

vi.mock('../../../api/documents', () => ({ deleteDocument: vi.fn(), getDocumentChunks: vi.fn(), listDocuments: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('lists indexed documents and opens their stored chunks', async () => {
  vi.mocked(listDocuments).mockResolvedValue([{ filename: 'a.pdf', chunk_count: 1, page_count: 1 }])
  vi.mocked(getDocumentChunks).mockResolvedValue([{ file_name: 'a.pdf', page_number: 2, chunk_index: 1, text: 'Stored text' }])
  render(<DocumentExplorer />)

  fireEvent.click(await screen.findByRole('button', { name: /^a\.pdf/ }))
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
  expect(await screen.findByRole('button', { name: /^new\.pdf/ })).toBeTruthy()
})

it('confirms removal and clears the selected document and its chunks', async () => {
  vi.mocked(listDocuments).mockResolvedValue([{ filename: 'a.pdf', chunk_count: 1, page_count: 1 }])
  vi.mocked(getDocumentChunks).mockResolvedValue([{ file_name: 'a.pdf', page_number: 1, chunk_index: 1, text: 'Stored text' }])
  vi.mocked(deleteDocument).mockResolvedValue()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  render(<DocumentExplorer />)

  fireEvent.click(await screen.findByRole('button', { name: /^a.pdf/ }))
  await screen.findByText('Stored text')
  fireEvent.click(screen.getByRole('button', { name: 'Remove a.pdf' }))
  expect(deleteDocument).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Remove a.pdf' }))

  expect(await screen.findByText('No documents indexed yet.')).toBeTruthy()
  expect(deleteDocument).toHaveBeenCalledOnce()
  expect(deleteDocument).toHaveBeenCalledWith('a.pdf')
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('a.pdf'))
  expect(screen.queryByText('Stored text')).toBeNull()
})

it('keeps the document and shows an error when removal fails, then allows retry', async () => {
  vi.mocked(listDocuments).mockResolvedValue([{ filename: 'a.pdf', chunk_count: 1, page_count: 1 }])
  vi.mocked(deleteDocument).mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValueOnce()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<DocumentExplorer />)

  fireEvent.click(await screen.findByRole('button', { name: 'Remove a.pdf' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Database unavailable')
  expect(screen.getByRole('button', { name: /^a.pdf/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Remove a.pdf' }))
  expect(await screen.findByText('No documents indexed yet.')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('prevents refresh and repeated removal while deletion is pending', async () => {
  vi.mocked(listDocuments).mockResolvedValue([{ filename: 'a.pdf', chunk_count: 1, page_count: 1 }])
  let resolveDelete!: () => void
  vi.mocked(deleteDocument).mockReturnValue(new Promise((resolve) => { resolveDelete = resolve }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<DocumentExplorer />)

  fireEvent.click(await screen.findByRole('button', { name: 'Remove a.pdf' }))
  expect(screen.getByRole('button', { name: 'Remove a.pdf' }).matches(':disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Refresh' }).matches(':disabled')).toBe(true)
  await act(async () => { resolveDelete() })
  expect(await screen.findByText('No documents indexed yet.')).toBeTruthy()
})
