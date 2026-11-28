export type MapPoint = {
  id: string
  file_name: string
  page_number: number
  chunk_index: number
  text: string
  position: [number, number, number]
  cluster: number
}

export async function getEmbeddingMap(signal: AbortSignal): Promise<MapPoint[]> {
  let response: Response
  try {
    response = await fetch('/api/documents/map', { signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Could not reach the API. Make sure the backend is running.')
  }
  if (!response.ok) throw new Error(`Could not generate the map (${response.status}). Check the server logs.`)
  const result = await response.json() as { points: MapPoint[] }
  return result.points
}
