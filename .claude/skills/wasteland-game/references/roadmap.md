# Roadmap

## Review backlog

Both earlier reviews (generated maps, AP gauge) have been worked through; nothing is open.
What they changed, so it isn't undone by accident:

- **Generated maps carry a fingerprint** (`generatorFingerprint`: biome id, `Biome.version`,
  exits). Saves store it per map and drop that map's chest/creature state on mismatch. Bump a
  biome's `version` whenever its generator changes what it builds for a seed.
- **The loaded player is checked** against the region reachable from `playerStart`; a save
  naming a map no longer in `WORLD` skips that map (or falls back to the start map).
- **Each exit has its own RNG stream** (`hashSeed(seed, 'exit', side, to)`) and keeps 3 tiles
  from other exits; `GridMap.parse` rejects exits that are defined but not placed.
- **Spawns keep `SAFE_SPAWN_DISTANCE`** (largest sight range + 3) from every entry, and
  `playabilityProblems(map)` checks arrival from every exit.
- **Generation retries** with `hashSeed(seed, 'retry', attempt)` (up to 10), and `travel()`
  catches a failure and fades back in. `canStamp` keeps prefabs off landmark and exit tiles.
- **The village builds an L-shaped road** from every entry, whatever its side.
- **No stepping onto exits mid-fight.**
- **AP gauge:** placed on whole pixels; starts from max AP, so an opening attack shows its
  "-N"; returns to straight above once an obstacle has gone (`STAY_BONUS` < `PREFERENCE_STEP`);
  the seal texture leaves the ring to the glow; the camera can scroll an extra combat bar plus
  a tile above the map in combat, so the gauge fits above the top row.

## Planned features

Roughly in the order discussed with the user:

- **Variety inside maps.** Replace the few hard-coded structures per biome with a weighted
  feature pool (crashed vertibird, radioactive dump, mutant nest, wandering trader, ruined
  chapel, hermit, minefield...), some rare or unique. Later: map modifiers (burnt forest,
  irradiated forest) and possibly a randomly generated world layout (which biome lies behind
  an exit). `data/world.ts` is already data, so it could be generated from the seed.
- **More biomes:** plains and caves (`smooth()` suits cave walls).
- **Touch controls** and mobile: an on-screen D-pad and action buttons, tap to attack and
  interact; package with Capacitor or as a PWA (Tauri or Electron for desktop).
- **A trader NPC with dialogue**, giving Charisma and item values a use.
- **Real sprite art** (a sprite sheet) replacing the generated placeholders.
