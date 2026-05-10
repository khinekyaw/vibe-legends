export type MatchPace = 'normal' | 'quick'

export type MatchPaceConfig = {
  id: MatchPace
  label: string
  description: string
  /** Approximate target match length in minutes — for UI display only. */
  targetMinutes: number
  /** Multiplier applied to objective (tower + nexus) max HP. */
  objectiveHpMultiplier: number
}

export const MATCH_PACES: Record<MatchPace, MatchPaceConfig> = {
  normal: {
    id: 'normal',
    label: 'Normal',
    description: 'Standard objective HP',
    targetMinutes: 12,
    objectiveHpMultiplier: 1,
  },
  quick: {
    id: 'quick',
    label: 'Quick',
    description: 'Towers and nexus fall faster',
    targetMinutes: 5,
    objectiveHpMultiplier: 0.4,
  },
}

export const MATCH_PACE_LIST: MatchPaceConfig[] = [MATCH_PACES.normal, MATCH_PACES.quick]

export const DEFAULT_MATCH_PACE: MatchPace = 'normal'

export function getMatchPaceConfig(pace: MatchPace | null | undefined): MatchPaceConfig {
  if (pace && MATCH_PACES[pace]) {
    return MATCH_PACES[pace]
  }
  return MATCH_PACES[DEFAULT_MATCH_PACE]
}
