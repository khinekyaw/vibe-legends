import * as THREE from 'three'

export type AabbCollider = {
  id: string
  maxX: number
  maxZ: number
  minX: number
  minZ: number
}

export type CollisionResult = {
  collided: boolean
}

export function resolveAabbCollisions(
  center: THREE.Vector3,
  halfSize: number,
  colliders: AabbCollider[],
): CollisionResult {
  let collided = false

  for (let pass = 0; pass < 4; pass += 1) {
    let resolvedThisPass = false

    for (const collider of colliders) {
      const bodyMinX = center.x - halfSize
      const bodyMaxX = center.x + halfSize
      const bodyMinZ = center.z - halfSize
      const bodyMaxZ = center.z + halfSize

      if (
        bodyMaxX <= collider.minX ||
        bodyMinX >= collider.maxX ||
        bodyMaxZ <= collider.minZ ||
        bodyMinZ >= collider.maxZ
      ) {
        continue
      }

      const pushLeft = collider.minX - bodyMaxX
      const pushRight = collider.maxX - bodyMinX
      const pushDown = collider.minZ - bodyMaxZ
      const pushUp = collider.maxZ - bodyMinZ
      const pushX = Math.abs(pushLeft) < Math.abs(pushRight) ? pushLeft : pushRight
      const pushZ = Math.abs(pushDown) < Math.abs(pushUp) ? pushDown : pushUp

      if (Math.abs(pushX) < Math.abs(pushZ)) {
        center.x += pushX
      } else {
        center.z += pushZ
      }

      collided = true
      resolvedThisPass = true
    }

    if (!resolvedThisPass) {
      break
    }
  }

  return { collided }
}
