import * as THREE from 'three'
import type { AabbCollider } from '../systems/CollisionSystem'

type ObjectiveKind = 'base' | 'tower'
type ObjectiveTeam = 'blue' | 'red'
type ObjectiveLane = 'bottom' | 'mid' | 'top'

export type ObjectiveDefinition = {
  colliderHalfSize: number
  id: string
  kind: ObjectiveKind
  lane?: ObjectiveLane
  position: THREE.Vector3
  team: ObjectiveTeam
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

export const OBJECTIVE_LAYOUT: ObjectiveDefinition[] = [
  {
    colliderHalfSize: 1.65,
    id: 'blue-top-tower',
    kind: 'tower',
    lane: 'top',
    position: new THREE.Vector3(-12, 0, -7),
    team: 'blue',
  },
  {
    colliderHalfSize: 1.65,
    id: 'blue-mid-tower',
    kind: 'tower',
    lane: 'mid',
    position: new THREE.Vector3(0, 0, -9),
    team: 'blue',
  },
  {
    colliderHalfSize: 1.65,
    id: 'blue-bottom-tower',
    kind: 'tower',
    lane: 'bottom',
    position: new THREE.Vector3(12, 0, -7),
    team: 'blue',
  },
  {
    colliderHalfSize: 2.55,
    id: 'blue-base',
    kind: 'base',
    position: new THREE.Vector3(0, 0, -30),
    team: 'blue',
  },
  {
    colliderHalfSize: 1.65,
    id: 'red-top-tower',
    kind: 'tower',
    lane: 'top',
    position: new THREE.Vector3(-12, 0, 7),
    team: 'red',
  },
  {
    colliderHalfSize: 1.65,
    id: 'red-mid-tower',
    kind: 'tower',
    lane: 'mid',
    position: new THREE.Vector3(0, 0, 9),
    team: 'red',
  },
  {
    colliderHalfSize: 1.65,
    id: 'red-bottom-tower',
    kind: 'tower',
    lane: 'bottom',
    position: new THREE.Vector3(12, 0, 7),
    team: 'red',
  },
  {
    colliderHalfSize: 2.55,
    id: 'red-base',
    kind: 'base',
    position: new THREE.Vector3(0, 0, 30),
    team: 'red',
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

export function createObjectiveColliders(layout = OBJECTIVE_LAYOUT): AabbCollider[] {
  return layout.map((objective) => ({
    id: objective.id,
    maxX: objective.position.x + objective.colliderHalfSize,
    maxZ: objective.position.z + objective.colliderHalfSize,
    minX: objective.position.x - objective.colliderHalfSize,
    minZ: objective.position.z - objective.colliderHalfSize,
  }))
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

function createObjective(objective: ObjectiveDefinition) {
  const group = new THREE.Group()
  group.name = objective.id
  group.position.copy(objective.position)

  const colors = TEAM_COLORS[objective.team]

  if (objective.kind === 'base') {
    group.add(createCylinder(2.7, 2.95, 0.46, colors.body, 0.6))
    group.add(createCylinder(2.08, 2.28, 0.78, colors.accent, 1.02))
    group.add(createCylinder(1.24, 1.42, 2.45, colors.body, 2.36))
    group.add(createCylinder(0.72, 0.98, 3.2, colors.glow, 3.7))
  } else {
    group.add(createCylinder(1.55, 1.78, 0.42, colors.body, 0.42))
    group.add(createCylinder(0.92, 1.06, 1.95, colors.body, 1.48))
    group.add(createCylinder(1.1, 1.28, 0.52, colors.accent, 2.68))
    group.add(createCylinder(0.48, 0.62, 0.72, colors.glow, 3.3))
  }

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })

  return group
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
