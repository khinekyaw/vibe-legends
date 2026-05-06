import * as THREE from 'three'
import { WALL_COLLIDER_DEBUG_HEIGHT } from '../core/sceneConfig'
import type { AabbCollider, WorldCollider } from '../systems/CollisionSystem'
import type { MapBounds } from './MapModel'

const MAP_LENGTH = 78
const LANE_WIDTH = 14
const WALL_THICKNESS = 1.45
const TILE_SIZE = 4

export const BRAWL_MAP_BOUNDS: MapBounds = {
  maxX: LANE_WIDTH / 2,
  maxZ: MAP_LENGTH / 2,
  minX: -LANE_WIDTH / 2,
  minZ: -MAP_LENGTH / 2,
}

const brawlMaterials = {
  edge: new THREE.MeshStandardMaterial({
    color: 0x6f8290,
    metalness: 0,
    roughness: 0.76,
  }),
  floorA: new THREE.MeshStandardMaterial({
    color: 0xa8b4ae,
    metalness: 0,
    roughness: 0.82,
  }),
  floorB: new THREE.MeshStandardMaterial({
    color: 0x8f9d9d,
    metalness: 0,
    roughness: 0.86,
  }),
  void: new THREE.MeshBasicMaterial({
    color: 0x102036,
    transparent: true,
    opacity: 0.95,
  }),
  wall: new THREE.MeshStandardMaterial({
    color: 0x536c7a,
    metalness: 0.04,
    roughness: 0.68,
  }),
}

export function createSimpleBrawlMap() {
  const group = new THREE.Group()
  group.name = 'simple-brawl-map'

  const voidPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(46, MAP_LENGTH + 12),
    brawlMaterials.void,
  )
  voidPlane.name = 'brawl-void-backdrop'
  voidPlane.rotation.x = -Math.PI / 2
  voidPlane.position.y = -0.09
  group.add(voidPlane)

  const floorGroup = new THREE.Group()
  floorGroup.name = 'brawl-floor-tiles'
  createFloorTiles(floorGroup)
  group.add(floorGroup)

  const edgeGroup = new THREE.Group()
  edgeGroup.name = 'brawl-floor-edge-pieces'
  createBridgeEdges(edgeGroup)
  group.add(edgeGroup)

  const wallGroup = new THREE.Group()
  wallGroup.name = 'brawl-side-walls'
  createSideWalls(wallGroup)
  group.add(wallGroup)

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.receiveShadow = true
    }
  })

  return group
}

export function createSimpleBrawlColliders(): AabbCollider[] {
  const sideWallZInset = 0.25

  return [
    {
      id: 'brawl-left-wall',
      maxX: -LANE_WIDTH / 2,
      maxZ: MAP_LENGTH / 2 - sideWallZInset,
      minX: -LANE_WIDTH / 2 - WALL_THICKNESS,
      minZ: -MAP_LENGTH / 2 + sideWallZInset,
    },
    {
      id: 'brawl-right-wall',
      maxX: LANE_WIDTH / 2 + WALL_THICKNESS,
      maxZ: MAP_LENGTH / 2 - sideWallZInset,
      minX: LANE_WIDTH / 2,
      minZ: -MAP_LENGTH / 2 + sideWallZInset,
    },
    {
      id: 'brawl-blue-end-wall',
      maxX: LANE_WIDTH / 2,
      maxZ: -MAP_LENGTH / 2,
      minX: -LANE_WIDTH / 2,
      minZ: -MAP_LENGTH / 2 - WALL_THICKNESS,
    },
    {
      id: 'brawl-red-end-wall',
      maxX: LANE_WIDTH / 2,
      maxZ: MAP_LENGTH / 2 + WALL_THICKNESS,
      minX: -LANE_WIDTH / 2,
      minZ: MAP_LENGTH / 2,
    },
  ]
}

export function createSimpleBrawlDebugGroup(colliders: WorldCollider[]) {
  const debugGroup = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({
    color: 0xff1f1f,
    depthTest: false,
    depthWrite: false,
    opacity: 0.26,
    transparent: true,
    wireframe: true,
  })

  debugGroup.name = 'brawl-collider-debug'
  colliders.forEach((collider) => {
    if (collider.shape === 'circle') {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(
          collider.radius,
          collider.radius,
          WALL_COLLIDER_DEBUG_HEIGHT,
          32,
        ),
        material,
      )
      mesh.position.set(collider.x, WALL_COLLIDER_DEBUG_HEIGHT / 2, collider.z)
      debugGroup.add(mesh)
      return
    }

    const width = collider.maxX - collider.minX
    const depth = collider.maxZ - collider.minZ

    if (width <= 0 || depth <= 0) {
      return
    }

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, WALL_COLLIDER_DEBUG_HEIGHT, depth),
      material,
    )
    mesh.position.set(
      collider.minX + width / 2,
      WALL_COLLIDER_DEBUG_HEIGHT / 2,
      collider.minZ + depth / 2,
    )
    debugGroup.add(mesh)
  })

  return debugGroup
}

function createFloorTiles(group: THREE.Group) {
  const columns = Math.floor(LANE_WIDTH / TILE_SIZE)
  const rows = Math.floor(MAP_LENGTH / TILE_SIZE)

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_SIZE - 0.08, 0.16, TILE_SIZE - 0.08),
        (row + column) % 2 === 0 ? brawlMaterials.floorA : brawlMaterials.floorB,
      )

      mesh.name = `brawl-floor-tile-${row}-${column}`
      mesh.position.set(
        -LANE_WIDTH / 2 + TILE_SIZE / 2 + column * TILE_SIZE + 1,
        0,
        -MAP_LENGTH / 2 + TILE_SIZE / 2 + row * TILE_SIZE + 1,
      )
      group.add(mesh)
    }
  }
}

function createBridgeEdges(group: THREE.Group) {
  const leftEdge = createEdgeMesh('brawl-left-edge')
  leftEdge.position.x = -LANE_WIDTH / 2 - 0.28
  group.add(leftEdge)

  const rightEdge = createEdgeMesh('brawl-right-edge')
  rightEdge.position.x = LANE_WIDTH / 2 + 0.28
  group.add(rightEdge)
}

function createSideWalls(group: THREE.Group) {
  const leftWall = createWallMesh('brawl-left-wall-visual')
  leftWall.position.x = -LANE_WIDTH / 2 - WALL_THICKNESS / 2
  group.add(leftWall)

  const rightWall = createWallMesh('brawl-right-wall-visual')
  rightWall.position.x = LANE_WIDTH / 2 + WALL_THICKNESS / 2
  group.add(rightWall)
}

function createEdgeMesh(name: string) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.55, MAP_LENGTH),
    brawlMaterials.edge,
  )
  mesh.name = name
  mesh.position.y = 0.12
  return mesh
}

function createWallMesh(name: string) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, 1.8, MAP_LENGTH),
    brawlMaterials.wall,
  )
  mesh.name = name
  mesh.position.y = 0.85
  return mesh
}
