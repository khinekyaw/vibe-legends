import * as THREE from 'three'
import { HERO_ASSETS } from './sceneConfig'
import type { MatchHeroSlot } from './matchTypes'

export function createMatchHeroSlots(playerHeroName: string): MatchHeroSlot[] {
  const playerAsset = HERO_ASSETS.find((asset) => asset.name === playerHeroName) ?? HERO_ASSETS[0]
  const supportAssets = HERO_ASSETS.filter((asset) => asset.name !== playerAsset.name)
  const blueAssets = [
    playerAsset,
    supportAssets[0] ?? HERO_ASSETS[1],
    supportAssets[1] ?? HERO_ASSETS[2],
  ]
  const redAssets = [
    HERO_ASSETS[0],
    HERO_ASSETS[1],
    HERO_ASSETS[2],
  ]

  return [
    {
      asset: blueAssets[0],
      controller: 'player',
      id: 'blue-player',
      spawnOffset: new THREE.Vector2(0, 0),
      team: 'blue',
    },
    {
      asset: blueAssets[1],
      controller: 'ai',
      id: 'blue-ai-1',
      spawnOffset: new THREE.Vector2(-1.9, 0.9),
      team: 'blue',
    },
    {
      asset: blueAssets[2],
      controller: 'ai',
      id: 'blue-ai-2',
      spawnOffset: new THREE.Vector2(1.9, 0.9),
      team: 'blue',
    },
    {
      asset: redAssets[0],
      controller: 'ai',
      id: 'red-ai-1',
      spawnOffset: new THREE.Vector2(0, 0),
      team: 'red',
    },
    {
      asset: redAssets[1],
      controller: 'ai',
      id: 'red-ai-2',
      spawnOffset: new THREE.Vector2(-1.9, 0.9),
      team: 'red',
    },
    {
      asset: redAssets[2],
      controller: 'ai',
      id: 'red-ai-3',
      spawnOffset: new THREE.Vector2(1.9, 0.9),
      team: 'red',
    },
  ]
}
