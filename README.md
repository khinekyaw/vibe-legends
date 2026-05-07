# MLBB Web Prototype

Web-based Mobile Legends-style MOBA prototype built with Vite, React, TypeScript, and Three.js.

Read `AGENTS.md` and `PLANS.md` before starting feature work.

## Current State

- Local single-player MOBA lane prototype.
- Minimal hero select with 3D preview and Start Match.
- 3v3 local match: 1 blue player hero, 2 allied blue AI heroes, and 3 red AI heroes.
- Alice, Ruby, and Layla are playable with basic attacks, 3 skills, cooldowns, damage, death, respawn, levels, and scaling HP/damage.
- AI heroes move down lane, steer around objectives, attack valid targets, and cast skills when useful.
- Minions spawn in waves, move down lane, and attack minions, heroes, towers, and nexuses.
- Towers and nexuses have local targeting, health bars, attack VFX/SFX, and match-ending Victory/Defeat rules.
- HUD includes match clock, kill count, player HP/XP/level, nearest enemy HP/level, skill cooldowns, respawn countdown, minimap, and match result overlay.
- World-space bars use team colors: allied health is green and enemies are red.
- Audio first pass is wired for looping BGM, hero basic/skill cues, minion attacks, and tower attacks.

## Run

```bash
npm install
npm run dev
npm run build
```

Local app: `http://127.0.0.1:5173/`

## Important Files

- `src/core/SceneManager.ts`: Main Three.js scene orchestration and match update loop.
- `src/core/sceneConfig.ts`: Hero asset mappings, map constants, shared scene status types.
- `src/core/matchTypes.ts`: Match/team/entity state types shared by scene helpers.
- `src/core/matchRoster.ts`: Local 3v3 roster setup.
- `src/core/sceneHud.ts`: World-to-HUD/minimap status projection helpers.
- `src/core/sceneMath.ts`: Shared scene math helpers.
- `src/core/objectiveModels.ts`: Objective model loading helpers.
- `src/entities/HeroModel.ts`: Hero GLB setup, placeholder heroes, animation actions and state transitions.
- `src/systems/AudioManager.ts`: Audio preload/playback, volume buses, and event cue helpers.
- `src/core/InputManager.ts`: WASD/arrows, Space attack, click/tap move pointer commands.
- `src/App.tsx`: React shell and compact HUD.
- `src/App.css`: fullscreen canvas and HUD styling.
- `PLANS.md`: milestone roadmap.
- `AGENTS.md`: coding-agent rules and asset-request policy.

## Asset Paths

```text
public/assets/models/alice/model.glb
public/assets/models/ruby/model.glb
public/assets/models/layla/model.glb
public/assets/models/minion/model.glb
public/assets/models/map/tower1.glb
public/assets/models/map/tower2.glb
public/assets/models/map/nexus.glb

public/assets/audio/music/match_theme.mp3
public/assets/audio/heroes/alice/basic_attack.mp3
public/assets/audio/heroes/alice/skill1.mp3
public/assets/audio/heroes/alice/skill2.mp3
public/assets/audio/heroes/alice/skill3.mp3
public/assets/audio/heroes/ruby/basic_attack.mp3
public/assets/audio/heroes/ruby/skill1.mp3
public/assets/audio/heroes/ruby/skill2.mp3
public/assets/audio/heroes/ruby/skill3.mp3
public/assets/audio/heroes/layla/basic_attack.mp3
public/assets/audio/heroes/layla/skill1.mp3
public/assets/audio/heroes/layla/skill2.mp3
public/assets/audio/heroes/layla/skill3.mp3
public/assets/audio/minions/basic_attack.mp3
public/assets/audio/objectives/tower_attack.mp3
```

Do not invent final production assets silently. If a milestone needs a new model, animation file, sound, texture, UI art, VFX sprite, or branded reference asset, ask the user first.

## Character Notes

Hero GLBs contain their own animations. Use the model clips directly; do not add procedural character animation unless the user asks.

Current clip mappings:

- Alice: `fight_idle`, `run`, `attack1`, `dead`
- Ruby: `fight_idle`, `run`, `attack1`, `dead`
- Layla: configured in `src/core/sceneConfig.ts`

Controls:

- WASD/arrows move selected hero
- Click/tap moves selected hero toward the clicked map point
- Space triggers attack
- Q/E/R trigger hero skills

Ruby had an off-center rotation issue because her weapon affects the bounding box. The fix uses skeleton/body pivot names in `src/entities/HeroModel.ts` instead of centering only by full mesh bounds.

## Map Notes

The current arena is a modular single-lane Brawl-style bridge built from primitive geometry, textures, wall colliders, and objective model slots. Towers and nexuses use supplied GLB files under `public/assets/models/map/`.

Keep objective and roster data structured. Local player/AI state already includes stable IDs, team, controller, and spawn metadata so the gameplay layer can later be adapted for network multiplayer without rewriting every entity reference.

Current map constants and hero stats live in `src/core/sceneConfig.ts`.

## Audio Notes

Audio is managed through `src/systems/AudioManager.ts` with separate buses for music, heroes, minions, objectives, and UI. Match music starts from the Start Match button so browser audio unlock happens from a user gesture.

The prototype currently uses `.mp3` files. For final web assets, prefer trimmed `.ogg` files with `.mp3` fallback where needed.

## UI Direction

Keep in-app UI compact and game-like. Do not add paragraphs explaining controls, implementation details, milestone notes, or asset status inside the app UI. Put that information in docs or assistant replies.

## Next Likely Work

- Tune AI priorities, wave timing, attack timing, and combat balance after playtesting.
- Add kill feed and polish minimap/HUD layout.
- Add UI/match result sounds, hero death/level-up sounds, and per-skin audio mapping.
- Continue splitting `SceneManager.ts` when new systems become stable enough to extract.
- Multiplayer remains deferred; keep new gameplay events deterministic and data-driven so they can later be serialized.
