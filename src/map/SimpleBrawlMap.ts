import * as THREE from "three"
import { WALL_COLLIDER_DEBUG_HEIGHT } from "../core/sceneConfig"
import type { AabbCollider, WorldCollider } from "../systems/CollisionSystem"
import type { MapBounds } from "./MapModel"

const MAP_LENGTH = 78
const LANE_WIDTH = 14
const WALL_THICKNESS = 1
const FLOOR_TEXTURE_URL = "/assets/images/map/floor.png"
const FLOOR_AO_TEXTURE_URL = "/assets/images/map/floor_ambient_occlusion_map.png"
const FLOOR_DISPLACEMENT_TEXTURE_URL = "/assets/images/map/floor_displacement_map.png"
const FLOOR_NORMAL_TEXTURE_URL = "/assets/images/map/floor_normal_map.png"
const FLOOR_SPECULAR_TEXTURE_URL = "/assets/images/map/floor_specular_map.png"
const WALL_TEXTURE_URL = "/assets/images/map/wall.png"

export const BRAWL_MAP_BOUNDS: MapBounds = {
  maxX: LANE_WIDTH / 2,
  maxZ: MAP_LENGTH / 2,
  minX: -LANE_WIDTH / 2,
  minZ: -MAP_LENGTH / 2,
}

const brawlMaterials = {
  void: new THREE.MeshBasicMaterial({
    color: 0x102036,
    transparent: true,
    opacity: 0.95,
  }),
}

export function createSimpleBrawlMap() {
  const group = new THREE.Group()
  group.name = "simple-brawl-map"

  const voidPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(46, MAP_LENGTH + 12),
    brawlMaterials.void,
  )
  voidPlane.name = "brawl-void-backdrop"
  voidPlane.rotation.x = -Math.PI / 2
  voidPlane.position.y = -0.09
  // group.add(voidPlane)

  const floorGroup = new THREE.Group()
  floorGroup.name = "brawl-floor"
  floorGroup.add(createFloorMesh())
  group.add(floorGroup)

  const edgeGroup = new THREE.Group()
  edgeGroup.name = "brawl-floor-edge-pieces"
  // createBridgeEdges(edgeGroup)
  group.add(edgeGroup)

  const wallGroup = new THREE.Group()
  wallGroup.name = "brawl-side-walls"
  createSideWalls(wallGroup)
  createEndWalls(wallGroup)
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
      id: "brawl-left-wall",
      maxX: -LANE_WIDTH / 2,
      maxZ: MAP_LENGTH / 2 - sideWallZInset,
      minX: -LANE_WIDTH / 2 - WALL_THICKNESS,
      minZ: -MAP_LENGTH / 2 + sideWallZInset,
    },
    {
      id: "brawl-right-wall",
      maxX: LANE_WIDTH / 2 + WALL_THICKNESS,
      maxZ: MAP_LENGTH / 2 - sideWallZInset,
      minX: LANE_WIDTH / 2,
      minZ: -MAP_LENGTH / 2 + sideWallZInset,
    },
    {
      id: "brawl-blue-end-wall",
      maxX: LANE_WIDTH / 2,
      maxZ: -MAP_LENGTH / 2,
      minX: -LANE_WIDTH / 2,
      minZ: -MAP_LENGTH / 2 - WALL_THICKNESS,
    },
    {
      id: "brawl-red-end-wall",
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

  debugGroup.name = "brawl-collider-debug"
  colliders.forEach((collider) => {
    if (collider.shape === "circle") {
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

function createFloorMesh() {
  const geometry = new THREE.BoxGeometry(LANE_WIDTH, 0.16, MAP_LENGTH, 24, 1, 128)
  const uv = geometry.getAttribute("uv")

  if (uv) {
    geometry.setAttribute("uv2", uv.clone())
  }

  const mesh = new THREE.Mesh(
    geometry,
    createFloorMaterial(),
  )

  mesh.name = "brawl-floor-plane"
  return mesh
}

// function createBridgeEdges(group: THREE.Group) {
//   const leftEdge = createEdgeMesh("brawl-left-edge")
//   leftEdge.position.x = -LANE_WIDTH / 2 - 0.35
//   group.add(leftEdge)

//   const rightEdge = createEdgeMesh("brawl-right-edge")
//   rightEdge.position.x = LANE_WIDTH / 2 + 0.35
//   group.add(rightEdge)
// }

function createSideWalls(group: THREE.Group) {
  const leftWall = createWallMesh("brawl-left-wall-visual")
  leftWall.position.x = -LANE_WIDTH / 2 - WALL_THICKNESS / 2
  group.add(leftWall)

  const rightWall = createWallMesh("brawl-right-wall-visual")
  rightWall.position.x = LANE_WIDTH / 2 + WALL_THICKNESS / 2
  group.add(rightWall)
}

function createEndWalls(group: THREE.Group) {
  const blueEndWall = createEndWallMesh("brawl-blue-end-wall-visual")
  blueEndWall.position.z = -MAP_LENGTH / 2 - WALL_THICKNESS / 2
  group.add(blueEndWall)

  const redEndWall = createEndWallMesh("brawl-red-end-wall-visual")
  redEndWall.position.z = MAP_LENGTH / 2 + WALL_THICKNESS / 2
  group.add(redEndWall)
}

// function createEdgeMesh(name: string) {
//   const mesh = new THREE.Mesh(
//     new THREE.BoxGeometry(0.7, 0.55, MAP_LENGTH + WALL_THICKNESS * 2),
//     createStandardTextureMaterial(WALL_TEXTURE_URL, MAP_LENGTH / 2, 1),
//   )
//   mesh.name = name
//   mesh.position.y = 0.12
//   return mesh
// }

function createWallMesh(name: string) {
  const blankMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, 1.8, MAP_LENGTH),
    [
      createStandardTextureMaterial(WALL_TEXTURE_URL, MAP_LENGTH / 2, 1),
      blankMaterial,
      createStandardTextureMaterial(
        WALL_TEXTURE_URL,
        MAP_LENGTH / 2,
        1,
        Math.PI / 2,
      ),
    ],
  )
  mesh.name = name
  mesh.position.y = 0.85
  return mesh
}

function createEndWallMesh(name: string) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(LANE_WIDTH + WALL_THICKNESS * 2, 1.8, WALL_THICKNESS),
    createStandardTextureMaterial(WALL_TEXTURE_URL, LANE_WIDTH / 2, 1),
  )
  mesh.name = name
  mesh.position.y = 0.85
  return mesh
}

function createFloorMaterial() {
  return new THREE.MeshPhysicalMaterial({
    aoMap: createLinearMapTexture(FLOOR_AO_TEXTURE_URL, 1, 1),
    aoMapIntensity: 0.72,
    color: 0xffffff,
    displacementBias: -0.015,
    displacementMap: createLinearMapTexture(FLOOR_DISPLACEMENT_TEXTURE_URL, 1, 1),
    displacementScale: 0.03,
    map: createMapTexture(FLOOR_TEXTURE_URL, 1, 1),
    metalness: 0,
    normalMap: createLinearMapTexture(FLOOR_NORMAL_TEXTURE_URL, 1, 1),
    normalScale: new THREE.Vector2(0.72, 0.72),
    roughness: 0.72,
    specularIntensity: 0.28,
    specularIntensityMap: createLinearMapTexture(FLOOR_SPECULAR_TEXTURE_URL, 1, 1),
  })
}

function createStandardTextureMaterial(
  url: string,
  repeatX: number,
  repeatY: number,
  rotation: number = 0, // Rotation in radians
) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createMapTexture(url, repeatX, repeatY, rotation),
    metalness: 0,
    roughness: 0.78,
  })
}

function createLinearMapTexture(
  url: string,
  repeatX: number,
  repeatY: number,
  rotation: number = 0,
) {
  const texture = createBaseTexture(url, repeatX, repeatY, rotation)
  texture.colorSpace = THREE.NoColorSpace
  return texture
}

function createMapTexture(
  url: string,
  repeatX: number,
  repeatY: number,
  rotation: number = 0, // Rotation in radians
) {
  const texture = createBaseTexture(url, repeatX, repeatY, rotation)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createBaseTexture(
  url: string,
  repeatX: number,
  repeatY: number,
  rotation: number = 0,
) {
  const texture = new THREE.TextureLoader().load(url)

  // Setup wrapping
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)

  // Apply rotation
  texture.rotation = rotation

  // Set pivot point to the center so it rotates in place
  texture.center.set(0.5, 0.5)

  return texture
}
