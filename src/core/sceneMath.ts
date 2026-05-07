import * as THREE from 'three'

export function dampAngle(current: number, target: number, lambda: number, delta: number) {
  const shortestDelta = THREE.MathUtils.euclideanModulo(
    target - current + Math.PI,
    Math.PI * 2,
  ) - Math.PI

  return current + shortestDelta * (1 - Math.exp(-lambda * delta))
}
