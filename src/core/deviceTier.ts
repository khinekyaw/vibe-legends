/**
 * Device tier detection used to pick renderer quality presets.
 * Kept centralized so every renderer (match scene + hero preview) makes
 * the same call, and so we have one place to retune the heuristic.
 */

export type DeviceTier = 'low' | 'high'

let cachedTier: DeviceTier | null = null

export function getDeviceTier(): DeviceTier {
  if (cachedTier) {
    return cachedTier
  }
  if (typeof window === 'undefined') {
    cachedTier = 'high'
    return cachedTier
  }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const lowMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const lowCpu = navigator.hardwareConcurrency
  const memTier = lowMem !== undefined && lowMem <= 4
  const cpuTier = lowCpu !== undefined && lowCpu <= 4
  cachedTier = coarse || memTier || cpuTier ? 'low' : 'high'
  return cachedTier
}

export function isLowPowerDevice() {
  return getDeviceTier() === 'low'
}

export type RendererQuality = {
  antialias: boolean
  /** Cap for `renderer.setPixelRatio`. */
  pixelRatioCap: number
  shadowsEnabled: boolean
  /** Shadow map resolution; ignored when shadowsEnabled is false. */
  shadowMapSize: number
  /** When false, use Linear / NoToneMapping for cheaper shaders. */
  highQualityToneMapping: boolean
  /** Minimum ms between rendered frames (0 = uncapped). */
  frameIntervalMs: number
  /** Minimum ms between React HUD status emits. */
  statusEmitIntervalMs: number
}

export function getRendererQuality(): RendererQuality {
  if (isLowPowerDevice()) {
    return {
      antialias: false,
      pixelRatioCap: 1,
      shadowsEnabled: false,
      shadowMapSize: 1024,
      highQualityToneMapping: false,
      frameIntervalMs: 33,
      statusEmitIntervalMs: 100,
    }
  }
  return {
    antialias: true,
    pixelRatioCap: 2,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    highQualityToneMapping: true,
    frameIntervalMs: 0,
    statusEmitIntervalMs: 33,
  }
}
