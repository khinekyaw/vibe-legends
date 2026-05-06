import * as THREE from 'three'
import {
  MAP_LIMIT,
  MAP_ROTATION_Y,
  MAP_SURFACE_NAME_HINTS,
  MAP_WORLD_SIZE,
} from '../core/sceneConfig'

export type MapBounds = {
  maxX: number
  maxZ: number
  minX: number
  minZ: number
}

export function createDefaultMapBounds(): MapBounds {
  return {
    maxX: MAP_LIMIT,
    maxZ: MAP_LIMIT,
    minX: -MAP_LIMIT,
    minZ: -MAP_LIMIT,
  }
}

export function createFallbackGround() {
  const fallbackGround = new THREE.Group()

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(MAP_LIMIT, 80),
    new THREE.MeshStandardMaterial({
      color: 0x263242,
      metalness: 0,
      roughness: 0.82,
    }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  fallbackGround.add(ground)

  const grid = new THREE.GridHelper(MAP_LIMIT * 2, 18, 0x516070, 0x2c3644)
  grid.position.y = 0.01
  fallbackGround.add(grid)

  return fallbackGround
}

export function prepareMapModel(map: THREE.Group) {
  map.name = 'map-model'
  map.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false
      object.receiveShadow = true
      object.castShadow = false
    }
  })

  return normalizeMap(map)
}

function normalizeMap(map: THREE.Group) {
  const box = getMainMapLayerBox(map) ?? new THREE.Box3().setFromObject(map)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDimension = Math.max(size.x, size.z, 0.001)
  const scale = MAP_WORLD_SIZE / maxDimension
  const surfaceY = getMapSurfaceY(map, box)
  const centeredOffset = center.clone().multiplyScalar(scale)
  centeredOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), MAP_ROTATION_Y)

  map.scale.setScalar(scale)
  map.rotation.y = MAP_ROTATION_Y
  map.position.set(-centeredOffset.x, -surfaceY * scale, -centeredOffset.z)
  map.updateMatrixWorld(true)

  return getMapBounds(box, map.matrixWorld)
}

function getMapBounds(sourceBox: THREE.Box3, matrixWorld: THREE.Matrix4) {
  const bounds: MapBounds = {
    maxX: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
    minX: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
  }
  const transformedCorner = new THREE.Vector3()
  const corners = [
    [sourceBox.min.x, sourceBox.min.z],
    [sourceBox.min.x, sourceBox.max.z],
    [sourceBox.max.x, sourceBox.min.z],
    [sourceBox.max.x, sourceBox.max.z],
  ]

  corners.forEach(([x, z]) => {
    transformedCorner.set(x, sourceBox.min.y, z).applyMatrix4(matrixWorld)
    bounds.minX = Math.min(bounds.minX, transformedCorner.x)
    bounds.maxX = Math.max(bounds.maxX, transformedCorner.x)
    bounds.minZ = Math.min(bounds.minZ, transformedCorner.z)
    bounds.maxZ = Math.max(bounds.maxZ, transformedCorner.z)
  })

  return bounds
}

function getMainMapLayerBox(map: THREE.Group) {
  const fullBox = new THREE.Box3().setFromObject(map)
  const fullSize = fullBox.getSize(new THREE.Vector3())
  const minMainLayerY = fullBox.min.y + fullSize.y * 0.4
  let bestBox: THREE.Box3 | null = null
  let bestArea = 0

  map.traverse((object) => {
    if (object.children.length === 0) {
      return
    }

    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const area = size.x * size.z

    if (box.min.y >= minMainLayerY && area > bestArea) {
      bestBox = box
      bestArea = area
    }
  })

  return bestBox
}

function getMapSurfaceY(map: THREE.Group, mainLayerBox: THREE.Box3) {
  let surfaceY = mainLayerBox.min.y

  map.traverse((object) => {
    const name = object.name.toLowerCase()
    const isSurface = MAP_SURFACE_NAME_HINTS.some((hint) => name.includes(hint))

    if (!isSurface) {
      return
    }

    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())

    if (
      box.min.y >= mainLayerBox.min.y &&
      box.min.y <= mainLayerBox.max.y &&
      size.x > 2 &&
      size.z > 2
    ) {
      surfaceY = Math.max(surfaceY, box.min.y)
    }
  })

  return surfaceY
}
