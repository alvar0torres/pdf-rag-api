import { afterEach, expect, it, vi } from 'vitest'
import { deleteDocument } from './documents'

afterEach(() => vi.unstubAllGlobals())

it('encodes filenames when deleting an indexed document', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  await deleteDocument('a & b.pdf')

  expect(fetchMock).toHaveBeenCalledWith('/api/documents/delete?filename=a+%26+b.pdf', { method: 'DELETE' })
})

it('surfaces a deletion error from the API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ detail: 'Deletion failed.' }), { status: 500 }),
  ))

  await expect(deleteDocument('a.pdf')).rejects.toThrow('Deletion failed.')
})
