import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  createObjectiveModelInstance,
  getObjectiveModelUrl,
  OBJECTIVE_LAYOUT,
} from '../map/ObjectiveStructures'

export function loadObjectiveModels(
  loader: GLTFLoader,
  objectiveModelSources: Map<string, THREE.Object3D>,
  objectiveStructures: THREE.Group,
) {
  const urls = [...new Set(OBJECTIVE_LAYOUT.map(getObjectiveModelUrl))]

  Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          loader.load(
            url,
            (gltf) => {
              objectiveModelSources.set(url, gltf.scene)
              resolve()
            },
            undefined,
            () => resolve(),
          )
        }),
    ),
  ).then(() => {
    OBJECTIVE_LAYOUT.forEach((objective) => {
      const source = objectiveModelSources.get(getObjectiveModelUrl(objective))
      const container = objectiveStructures.getObjectByName(objective.id)

      if (!source || !container) {
        return
      }

      disposeObjectivePlaceholder(container)
      container.clear()
      container.add(createObjectiveModelInstance(objective, source))
    })
  })
}

function disposeObjectivePlaceholder(object: THREE.Object3D) {
  object.children.forEach((child) => {
    child.traverse((descendant) => {
      if (descendant instanceof THREE.Mesh) {
        descendant.geometry.dispose()
        const materials = Array.isArray(descendant.material)
          ? descendant.material
          : [descendant.material]
        materials.forEach((material) => material.dispose())
      }
    })
  })
}
