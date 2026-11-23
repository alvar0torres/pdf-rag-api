export type Chunk = { chunk_index: number; text: string }
export type Page = { page_number: number; chunks: Chunk[] }
export type Extraction = {
  filename: string
  page_count: number
  chunk_count: number
  pages: Page[]
}
type Ingestion = { indexed_count: number }

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
