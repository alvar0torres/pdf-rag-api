export type Chunk = { chunk_index: number; text: string }
export type Page = { page_number: number; chunks: Chunk[] }
export type Extraction = {
  filename: string
  page_count: number
  chunk_count: number
  pages: Page[]
}
type Ingestion = { indexed_count: number }
export type IndexedDocument = { filename: string; chunk_count: number; page_count: number }
export type IndexedChunk = Chunk & { file_name: string; page_number: number }

async function uploadPdf<T>(path: string, file: File): Promise<T> {
  const body = new FormData()
  body.append('file', file)
  let response: Response
  try {
    response = await fetch(`/api${path}`, { method: 'POST', body })
  } catch {
    throw new Error('Could not reach the API. Make sure the backend is running.')
  }
  if (!response.ok) {
    let detail: unknown
    try {
      detail = (await response.json()).detail
    } catch {
      throw new Error(`Request failed (${response.status}). Check that the backend is running.`)
    }
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export function extractDocument(file: File) {
  return uploadPdf<Extraction>('/documents/extract', file)
}

export function ingestDocument(file: File) {
  return uploadPdf<Ingestion>('/documents/ingest', file)
}

async function getDocuments<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { signal })
  if (!response.ok) {
    throw new Error(`Could not load indexed documents (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export async function listDocuments(signal: AbortSignal): Promise<IndexedDocument[]> {
  const result = await getDocuments<{ documents: IndexedDocument[] }>('/documents', signal)
  return result.documents
}

export async function getDocumentChunks(filename: string, signal: AbortSignal): Promise<IndexedChunk[]> {
  const query = new URLSearchParams({ filename })
  const result = await getDocuments<{ chunks: IndexedChunk[] }>(`/documents/chunks?${query}`, signal)
  return result.chunks
}
