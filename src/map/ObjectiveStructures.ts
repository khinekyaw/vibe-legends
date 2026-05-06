import * as THREE from 'three'
import type { WorldCollider } from '../systems/CollisionSystem'

type ObjectiveKind = 'base' | 'tower'
type ObjectiveModelKey = 'nexus' | 'tower1' | 'tower2'
type ObjectiveTeam = 'blue' | 'red'
type ObjectiveLane = 'inner' | 'mid' | 'outer'

export type ObjectiveDefinition = {
  colliderHalfSize: number
  colliderRadius?: number
  id: string
  kind: ObjectiveKind
  lane?: ObjectiveLane
  modelKey: ObjectiveModelKey
  position: THREE.Vector3
  team: ObjectiveTeam
  visualHeight: number
}

const TEAM_COLORS: Record<ObjectiveTeam, { accent: number; body: number; glow: number }> = {
  blue: {
    accent: 0x43d5ff,
    body: 0x2266d8,
    glow: 0x86edff,
  },
  red: {
    accent: 0xff5368,
    body: 0xd8344d,
    glow: 0xffb1bb,
  },
}

export const OBJECTIVE_MODEL_URLS: Record<ObjectiveModelKey, string> = {
  nexus: '/assets/models/map/nexus.glb',
  tower1: '/assets/models/map/tower1.glb',
  tower2: '/assets/models/map/tower2.glb',
}

export const OBJECTIVE_LAYOUT: ObjectiveDefinition[] = [
  {
    colliderHalfSize: 1.08,
    colliderRadius: 0.88,
    id: 'blue-outer-tower',
    kind: 'tower',
    lane: 'outer',
    modelKey: 'tower1',
    position: new THREE.Vector3(0, 0, -20),
    team: 'blue',
    visualHeight: 3.2,
  },
  {
    colliderHalfSize: 1.08,
    colliderRadius: 0.88,
    id: 'blue-inner-tower',
    kind: 'tower',
    lane: 'inner',
    modelKey: 'tower2',
    position: new THREE.Vector3(0, 0, -8),
    team: 'blue',
    visualHeight: 3.1,
  },
  {
    colliderHalfSize: 2.55,
    id: 'blue-base',
    kind: 'base',
    modelKey: 'nexus',
    position: new THREE.Vector3(0, 0, -33),
    team: 'blue',
    visualHeight: 2.65,
  },
  {
    colliderHalfSize: 1.08,
    colliderRadius: 0.88,
    id: 'red-inner-tower',
    kind: 'tower',
    lane: 'inner',
    modelKey: 'tower2',
    position: new THREE.Vector3(0, 0, 8),
    team: 'red',
    visualHeight: 3.1,
  },
  {
    colliderHalfSize: 1.08,
    colliderRadius: 0.88,
    id: 'red-outer-tower',
    kind: 'tower',
    lane: 'outer',
    modelKey: 'tower1',
    position: new THREE.Vector3(0, 0, 20),
    team: 'red',
    visualHeight: 3.2,
  },
  {
    colliderHalfSize: 2.55,
    id: 'red-base',
    kind: 'base',
    modelKey: 'nexus',
    position: new THREE.Vector3(0, 0, 33),
    team: 'red',
    visualHeight: 2.65,
  },
]

export function createObjectiveStructures(layout = OBJECTIVE_LAYOUT) {
  const group = new THREE.Group()
  group.name = 'objective-structures'

  layout.forEach((objective) => {
    group.add(createObjective(objective))
  })

  return group
}

export function createObjectiveColliders(layout = OBJECTIVE_LAYOUT): WorldCollider[] {
  return layout.map((objective) => {
    if (objective.kind === 'tower') {
      return {
        id: objective.id,
        radius: objective.colliderRadius ?? objective.colliderHalfSize,
        shape: 'circle',
        x: objective.position.x,
        z: objective.position.z,
      }
    }

    return {
      id: objective.id,
      maxX: objective.position.x + objective.colliderHalfSize,
      maxZ: objective.position.z + objective.colliderHalfSize,
      minX: objective.position.x - objective.colliderHalfSize,
      minZ: objective.position.z - objective.colliderHalfSize,
    }
  })
}

export function hideBakedMapTowers(map: THREE.Group) {
  map.traverse((object) => {
    const name = object.name.toLowerCase()

    if (
      name.includes('statue') ||
      name.includes('jidiblue') ||
      name.includes('jidired') ||
      name.includes('bluejidi') ||
      name.includes('redjidi')
    ) {
      object.visible = false
    }
  })
}

export function getObjectiveModelUrl(objective: ObjectiveDefinition) {
  return OBJECTIVE_MODEL_URLS[objective.modelKey]
}

export function getObjectiveRotationY(objective: ObjectiveDefinition) {
  return objective.team === 'red' ? Math.PI : 0
}

export function createObjectiveModelInstance(
  objective: ObjectiveDefinition,
  source: THREE.Object3D,
) {
  const model = source.clone(true)

  model.name = `${objective.id}-model`
  model.rotation.y = getObjectiveRotationY(objective)
  normalizeObjectiveModel(model, objective.visualHeight)

  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })

  return model
}

function createObjective(objective: ObjectiveDefinition) {
  const group = new THREE.Group()
  group.name = objective.id
  group.position.copy(objective.position)

  const colors = TEAM_COLORS[objective.team]

  if (objective.kind === 'base') {
    group.add(createCylinder(1.95, 2.2, 0.4, colors.body, 0.42))
    group.add(createCylinder(1.48, 1.68, 0.62, colors.accent, 0.86))
    group.add(createCylinder(0.92, 1.06, 1.9, colors.body, 1.92))
    group.add(createCylinder(0.48, 0.68, 2.45, colors.glow, 3.05))
  } else {
    group.add(createCylinder(1.12, 1.32, 0.34, colors.body, 0.34))
    group.add(createCylinder(0.62, 0.78, 1.42, colors.body, 1.14))
    group.add(createCylinder(0.78, 0.94, 0.42, colors.accent, 2.05))
    group.add(createCylinder(0.34, 0.46, 0.58, colors.glow, 2.55))
  }

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })

  return group
}

function normalizeObjectiveModel(model: THREE.Object3D, targetHeight: number) {
  model.updateMatrixWorld(true)

  const initialBox = new THREE.Box3().setFromObject(model)
  const initialSize = initialBox.getSize(new THREE.Vector3())
  const scale = initialSize.y > 0 ? targetHeight / initialSize.y : 1

  model.scale.multiplyScalar(scale)
  model.updateMatrixWorld(true)

  const scaledBox = new THREE.Box3().setFromObject(model)
  const center = scaledBox.getCenter(new THREE.Vector3())
  model.position.set(-center.x, -scaledBox.min.y, -center.z)
}

function createCylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: number,
  y: number,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32),
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.08,
      roughness: 0.46,
    }),
  )

  mesh.position.y = y
  return mesh
}
