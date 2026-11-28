// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { MapPoint } from '../../api/embeddingMap'
import { clusterColors } from './clusterColors'
import EmbeddingPlot from './EmbeddingPlot'

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>()
  return {
    ...three,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      setPixelRatio() {}
      setClearColor() {}
      setSize() {}
      render() {}
      dispose() {}
    },
  }
})
vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    enableDamping = false
    minDistance = 0
    maxDistance = 0
    update() {}
    dispose() {}
  },
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('previews hovered metadata, hides it on leave, and keeps click selection', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('PointerEvent', MouseEvent)
  const raycast = vi.spyOn(THREE.Raycaster.prototype, 'intersectObject').mockReturnValue([
    { distance: 1, point: new THREE.Vector3(), object: new THREE.Object3D(), instanceId: 0 },
  ])
  const point: MapPoint = {
    id: '1', file_name: 'a.pdf', page_number: 2, chunk_index: 3,
    cluster: 1, text: 'Example chunk', position: [0, 0, 0],
  }
  const select = vi.fn()
  const { container } = render(<EmbeddingPlot points={[point]} selectedId={null} onSelect={select} onError={vi.fn()} />)
  const canvas = container.querySelector('canvas')
  if (!canvas) throw new Error('Plot canvas not found')

  fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 })
  expect(screen.getByText('a.pdf')).toBeTruthy()
  expect(screen.getByText('Page 2 · chunk 3 · cluster 2')).toBeTruthy()
  expect(screen.getByText('Example chunk')).toBeTruthy()
  raycast.mockReturnValueOnce([])
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 })
  expect(screen.queryByText('Example chunk')).toBeNull()
  fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 })
  expect(screen.getByText('Example chunk')).toBeTruthy()
  fireEvent.pointerLeave(canvas)
  expect(screen.queryByText('Example chunk')).toBeNull()

  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 })
  fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10 })
  expect(select).toHaveBeenCalledWith(point)
})

it('highlights the selected sphere and restores its cluster color when selection changes', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const setColor = vi.spyOn(THREE.InstancedMesh.prototype, 'setColorAt')
  const points: MapPoint[] = [
    { id: '1', file_name: 'a.pdf', page_number: 1, chunk_index: 1, cluster: 0, text: 'First', position: [0, 0, 0] },
    { id: '2', file_name: 'b.pdf', page_number: 1, chunk_index: 1, cluster: 1, text: 'Second', position: [1, 0, 0] },
  ]
  const onSelect = vi.fn()
  const onError = vi.fn()
  const { rerender } = render(<EmbeddingPlot points={points} selectedId={null} onSelect={onSelect} onError={onError} />)
  const spheres = setColor.mock.instances[0]
  if (!(spheres instanceof THREE.InstancedMesh)) throw new Error('Plot spheres not found')
  const matrix = new THREE.Matrix4()

  setColor.mockClear()
  rerender(<EmbeddingPlot points={points} selectedId="1" onSelect={onSelect} onError={onError} />)
  expect(setColor).toHaveBeenCalledWith(0, new THREE.Color('#e6004c'))
  expect(setColor).toHaveBeenCalledWith(1, new THREE.Color(clusterColors[1]))
  spheres.getMatrixAt(0, matrix)
  expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(1.5)

  setColor.mockClear()
  rerender(<EmbeddingPlot points={points} selectedId="2" onSelect={onSelect} onError={onError} />)
  expect(setColor).toHaveBeenCalledWith(0, new THREE.Color(clusterColors[0]))
  expect(setColor).toHaveBeenCalledWith(1, new THREE.Color('#e6004c'))
  spheres.getMatrixAt(0, matrix)
  expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(1)
  spheres.getMatrixAt(1, matrix)
  expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(1.5)
})
