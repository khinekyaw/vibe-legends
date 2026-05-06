import * as THREE from 'three'
import type { WorldCollider } from '../systems/CollisionSystem'

type ObjectiveKind = 'base' | 'tower'
type ObjectiveModelKey = 'nexus' | 'tower1' | 'tower2'
type ObjectiveTeam = 'blue' | 'red'
type ObjectiveLane = 'inner' | 'mid' | 'outer'

export type ObjectiveDefinition = {
  attackDamage: number
  attackRange: number
  attackSeconds: number
  colliderHalfSize: number
  colliderRadius?: number
  healthBarHeight: number
  id: string
  kind: ObjectiveKind
  lane?: ObjectiveLane
  modelKey: ObjectiveModelKey
  position: THREE.Vector3
  team: ObjectiveTeam
  visualHeight: number
  maxHp: number
}

export const OBJECTIVE_MODEL_URLS: Record<ObjectiveModelKey, string> = {
  nexus: '/assets/models/map/nexus.glb',
  tower1: '/assets/models/map/tower1.glb',
  tower2: '/assets/models/map/tower2.glb',
}

export const OBJECTIVE_LAYOUT: ObjectiveDefinition[] = [
  {
    attackDamage: 95,
    attackRange: 6.6,
    attackSeconds: 1.15,
    colliderHalfSize: 1.08,
    colliderRadius: 0.88,
    healthBarHeight: 3.65,
    id: 'blue-outer-tower',
    kind: 'tower',
    lane: 'outer',
    modelKey: 'tower1',
    position: new THREE.Vector3(0, 0, 20),
    team: 'blue',
    visualHeight: 3.2,
    maxHp: 2200,
  },
  {
    attackDamage: 115,
    attackRange: 6.6,
    attackSeconds: 1.05,
    colliderHalfSize: 1.08,
    colliderRadius: 0.88,
    healthBarHeight: 3.55,
    id: 'blue-inner-tower',
    kind: 'tower',
    lane: 'inner',
    modelKey: 'tower2',
    position: new THREE.Vector3(0, 0, 8),
    team: 'blue',
    visualHeight: 3.1,
    maxHp: 2400,
  },
  {
    attackDamage: 150,
    attackRange: 7.2,
    attackSeconds: 1.25,
    colliderHalfSize: 2.55,
    colliderRadius: 1.35,
    healthBarHeight: 3.05,
    id: 'blue-base',
    kind: 'base',
    modelKey: 'nexus',
    position: new THREE.Vector3(0, 0, 33),
    team: 'blue',
    visualHeight: 2.65,
    maxHp: 3600,
  },
  {
    attackDamage: 115,
    attackRange: 6.6,
    attackSeconds: 1.05,
    colliderHalfSize: 1.08,
    colliderRadius: 0.88,
    healthBarHeight: 3.55,
    id: 'red-inner-tower',
    kind: 'tower',
    lane: 'inner',
    modelKey: 'tower2',
    position: new THREE.Vector3(0, 0, -8),
    team: 'red',
    visualHeight: 3.1,
    maxHp: 2400,
  },
  {
    attackDamage: 95,
    attackRange: 6.6,
    attackSeconds: 1.15,
    colliderHalfSize: 1.08,
    colliderRadius: 0.88,
    healthBarHeight: 3.65,
    id: 'red-outer-tower',
    kind: 'tower',
    lane: 'outer',
    modelKey: 'tower1',
    position: new THREE.Vector3(0, 0, -20),
    team: 'red',
    visualHeight: 3.2,
    maxHp: 2200,
  },
  {
    attackDamage: 150,
    attackRange: 7.2,
    attackSeconds: 1.25,
    colliderHalfSize: 2.55,
    colliderRadius: 1.35,
    healthBarHeight: 3.05,
    id: 'red-base',
    kind: 'base',
    modelKey: 'nexus',
    position: new THREE.Vector3(0, 0, -33),
    team: 'red',
    visualHeight: 2.65,
    maxHp: 3600,
  },
]

export function createObjectiveStructures(layout = OBJECTIVE_LAYOUT) {
  const group = new THREE.Group()
  group.name = 'objective-structures'

  layout.forEach((objective) => {
    const container = new THREE.Group()
    container.name = objective.id
    container.position.copy(objective.position)
    group.add(container)
  })

  return group
}

export function createObjectiveColliders(layout = OBJECTIVE_LAYOUT): WorldCollider[] {
  return layout.map((objective) => {
    if (objective.colliderRadius !== undefined) {
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
  return objective.team === 'blue' ? Math.PI : 0
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
