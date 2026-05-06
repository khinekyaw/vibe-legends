import * as THREE from 'three'
import type { HeroInstance } from '../entities/HeroModel'
import { getHeroForward } from './CombatSystem'

export class CombatEffects {
  readonly group = new THREE.Group()

  constructor() {
    this.group.name = 'combat-effects'
  }

  update(now: number) {
    this.group.children
      .filter((object) => object.userData.expiresAt <= now)
      .forEach((object) => {
        object.removeFromParent()

        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
        }
      })
  }

  createCircle(center: THREE.Vector3, radius: number, color: number, duration: number) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.05, 48),
      new THREE.MeshBasicMaterial({
        color,
        depthWrite: false,
        opacity: 0.34,
        transparent: true,
      }),
    )

    mesh.position.set(center.x, 0.08, center.z)
    mesh.userData.expiresAt = performance.now() / 1000 + duration
    this.group.add(mesh)
  }

  createForward(
    hero: HeroInstance,
    range: number,
    width: number,
    color: number,
    duration: number,
  ) {
    const forward = getHeroForward(hero)
    const center = hero.anchor.clone().addScaledVector(forward, range / 2)
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.05, range),
      new THREE.MeshBasicMaterial({
        color,
        depthWrite: false,
        opacity: 0.34,
        transparent: true,
      }),
    )

    mesh.position.set(center.x, 0.09, center.z)
    mesh.rotation.y = hero.facingAngle
    mesh.userData.expiresAt = performance.now() / 1000 + duration
    this.group.add(mesh)
  }

  createLine(from: THREE.Vector3, to: THREE.Vector3, color: number, duration: number) {
    const start = from.clone()
    const end = to.clone()
    start.y = 0.7
    end.y = 0.7
    const direction = end.clone().sub(start)
    const length = direction.length()

    if (length === 0) {
      return
    }

    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, length, 16),
      new THREE.MeshBasicMaterial({
        color,
        depthWrite: false,
        opacity: 0.72,
        transparent: true,
      }),
    )

    mesh.position.copy(start.clone().add(end).multiplyScalar(0.5))
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    mesh.userData.expiresAt = performance.now() / 1000 + duration
    this.group.add(mesh)
  }
}
