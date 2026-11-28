// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getEmbeddingMap } from '../../api/embeddingMap'
import type { MapPoint } from '../../api/embeddingMap'
import EmbeddingMapPage from './EmbeddingMapPage'

vi.mock('../../api/embeddingMap', () => ({ getEmbeddingMap: vi.fn() }))
vi.mock('./EmbeddingPlot', () => ({
  default: ({ points, selectedId, onSelect }: { points: MapPoint[]; selectedId: string | null; onSelect: (point: MapPoint) => void }) =>
    <button type="button" data-selected={selectedId} onClick={() => onSelect(points[0])}>Select sphere</button>,
}))

beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

const points: MapPoint[] = [
  { id: '1', file_name: 'a.pdf', page_number: 1, chunk_index: 1, text: 'First chunk', position: [1, 2, 3], cluster: 0 },
  { id: '2', file_name: 'b.pdf', page_number: 2, chunk_index: 1, text: 'Second chunk', position: [3, 2, 1], cluster: 1 },
]

it('generates a map on request and allows selecting chunks', async () => {
  vi.mocked(getEmbeddingMap).mockResolvedValue(points)
  render(<EmbeddingMapPage />)
  expect(getEmbeddingMap).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Generate map' }))
  expect(await screen.findByText(/2 CHUNKS/)).toBeTruthy()
  expect(screen.getByText('Cluster 1')).toBeTruthy()
  expect(screen.getByText('Cluster 2')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Select sphere' }))
  expect(screen.getByText('First chunk')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Select sphere' }).getAttribute('data-selected')).toBe('1')
  expect(screen.queryByRole('combobox')).toBeNull()
})

it('shows an empty index and can regenerate', async () => {
  vi.mocked(getEmbeddingMap).mockResolvedValueOnce([]).mockResolvedValueOnce(points)
  render(<EmbeddingMapPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Generate map' }))
  expect(await screen.findByText(/No indexed chunks yet/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate map' }))
  expect(await screen.findByText(/2 CHUNKS/)).toBeTruthy()
})

it('shows a generation error and allows retry', async () => {
  vi.mocked(getEmbeddingMap).mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValueOnce([])
  render(<EmbeddingMapPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Generate map' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Database unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Generate map' }))
  expect(await screen.findByText(/No indexed chunks yet/)).toBeTruthy()
})
