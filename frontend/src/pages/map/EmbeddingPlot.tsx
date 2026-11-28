import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { MapPoint } from '../../api/embeddingMap'
import { clusterColors } from './clusterColors'
import styles from './EmbeddingPlot.module.css'

type Props = {
  points: MapPoint[]
  selectedId: string | null
  onSelect: (point: MapPoint) => void
  onError: (message: string) => void
}

function EmbeddingPlot({ points, selectedId, onSelect, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const spheresRef = useRef<THREE.InstancedMesh | null>(null)
  const [hovered, setHovered] = useState<MapPoint | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      onError('Could not open the 3D view. Check that your browser supports WebGL.')
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor('#f6faf7')
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(6, 5, 8)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 2
    controls.maxDistance = 30
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc3d3c8, 2))
    const light = new THREE.DirectionalLight(0xffffff, 2)
    light.position.set(4, 8, 6)
    scene.add(light)

    const positions = points.map((point) => new THREE.Vector3(...point.position))
    const bounds = new THREE.Box3().setFromPoints(positions)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const scale = 6 / (Math.max(size.x, size.y, size.z) || 1)
    const geometry = new THREE.SphereGeometry(0.09, 16, 12)
    const material = new THREE.MeshStandardMaterial({ roughness: 0.6 })
    const spheres = new THREE.InstancedMesh(geometry, material, points.length)
    const matrix = new THREE.Matrix4()
    points.forEach((point, index) => {
      const position = positions[index].sub(center).multiplyScalar(scale)
      spheres.setMatrixAt(index, matrix.makeTranslation(position.x, position.y, position.z))
      spheres.setColorAt(index, new THREE.Color(clusterColors[point.cluster % clusterColors.length]))
    })
    spheres.instanceMatrix.needsUpdate = true
    if (spheres.instanceColor) spheres.instanceColor.needsUpdate = true
    spheres.computeBoundingSphere()
    scene.add(spheres)
    spheresRef.current = spheres

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerDown = { x: 0, y: 0 }
    const pointAt = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObject(spheres)[0]
      return hit?.instanceId === undefined ? null : points[hit.instanceId]
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.buttons !== 0) {
        setHovered(null)
        return
      }
      const point = pointAt(event)
      setHovered((current) => current?.id === point?.id ? current : point)
      renderer.domElement.style.cursor = point ? 'pointer' : ''
    }
    const onPointerLeave = () => {
      setHovered(null)
      renderer.domElement.style.cursor = ''
    }
    const onPointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY }
      onPointerLeave()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return
      const point = pointAt(event)
      if (point) onSelect(point)
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    let frame = 0
    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      spheresRef.current = null
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [points, onSelect, onError])

  useEffect(() => {
    const spheres = spheresRef.current
    if (!spheres) return

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    points.forEach((point, index) => {
      const selected = point.id === selectedId
      spheres.getMatrixAt(index, matrix)
      position.setFromMatrixPosition(matrix)
      matrix.makeScale(selected ? 1.5 : 1, selected ? 1.5 : 1, selected ? 1.5 : 1)
      matrix.setPosition(position)
      spheres.setMatrixAt(index, matrix)
      spheres.setColorAt(index, new THREE.Color(selected ? '#e6004c' : clusterColors[point.cluster % clusterColors.length]))
    })
    spheres.instanceMatrix.needsUpdate = true
    if (spheres.instanceColor) spheres.instanceColor.needsUpdate = true
    spheres.computeBoundingSphere()
  }, [points, selectedId])

  return (
    <div className={styles.plot} ref={containerRef}>
      {hovered && (
        <div className={styles.preview} aria-hidden="true">
          <strong>{hovered.file_name}</strong>
          <span>Page {hovered.page_number} · chunk {hovered.chunk_index} · cluster {hovered.cluster + 1}</span>
          <p>{hovered.text.length > 160 ? `${hovered.text.slice(0, 160)}…` : hovered.text}</p>
        </div>
      )}
    </div>
  )
}

export default EmbeddingPlot
