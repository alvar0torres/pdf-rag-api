import { useCallback, useEffect, useRef, useState } from 'react'
import { getEmbeddingMap } from '../../api/embeddingMap'
import type { MapPoint } from '../../api/embeddingMap'
import EmbeddingPlot from './EmbeddingPlot'
import { clusterColors } from './clusterColors'
import styles from './EmbeddingMapPage.module.css'

function EmbeddingMapPage() {
  const [points, setPoints] = useState<MapPoint[] | null>(null)
  const [selected, setSelected] = useState<MapPoint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plotError, setPlotError] = useState('')
  const request = useRef<AbortController | null>(null)
  const selectPoint = useCallback((point: MapPoint) => setSelected(point), [])

  useEffect(() => () => request.current?.abort(), [])

  async function generate() {
    if (loading) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setPlotError('')
    setPoints(null)
    setSelected(null)
    try {
      const result = await getEmbeddingMap(controller.signal)
      if (!controller.signal.aborted) setPoints(result)
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not generate the map.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const clusters = points ? [...new Set(points.map((point) => point.cluster))].sort((a, b) => a - b) : []

  return (
    <div className={styles.content}>
      <div className={styles.eyebrow}><span /> KNOWLEDGE BASE</div>
      <div className={styles.heading}>
        <div><h1>Embedding map</h1><p>Explore indexed chunks in three dimensions.</p></div>
        <span aria-hidden="true">✳</span>
      </div>
      <section className={styles.panel} aria-labelledby="map-title">
        <div className={styles.header}>
          <div><div className={styles.label}>VECTOR EXPLORER</div><h2 id="map-title">Your index in 3D</h2></div>
          <button type="button" onClick={() => void generate()} disabled={loading}>{loading ? 'Generating…' : points ? 'Regenerate map' : 'Generate map'}</button>
        </div>
        <p>Each sphere is an indexed chunk. Colors represent automatically grouped embeddings, not named topics. Drag to rotate, scroll to zoom, hover for a preview, and select a sphere to inspect it. The selected sphere is highlighted in pink.</p>
        <p>t-SNE approximates local similarity; distances between groups and axes are not meaningful measurements. Generating a map uses all indexed chunks and may take time and memory for large indexes.</p>
        {loading && <p className={styles.notice} role="status">Generating the map… This can take a while.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {points?.length === 0 && <p className={styles.notice}>No indexed chunks yet. Index a document to generate a map.</p>}
        {points && points.length > 0 && (
          <>
            <div className={styles.summary}>{points.length} {points.length === 1 ? 'CHUNK' : 'CHUNKS'} <span>·</span> {clusters.length} {clusters.length === 1 ? 'CLUSTER' : 'CLUSTERS'}</div>
            {plotError
              ? <p className={styles.error} role="alert">{plotError}</p>
              : <EmbeddingPlot points={points} selectedId={selected?.id ?? null} onSelect={selectPoint} onError={setPlotError} />}
            <div className={styles.legend} aria-label="Embedding clusters">
              {clusters.map((cluster) => <span key={cluster}><i style={{ backgroundColor: clusterColors[cluster % clusterColors.length] }} /> Cluster {cluster + 1}</span>)}
            </div>
            {selected && (
              <div className={styles.detail}>
                <strong>{selected.file_name} · page {selected.page_number} · chunk {selected.chunk_index}</strong>
                <p>{selected.text}</p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default EmbeddingMapPage
