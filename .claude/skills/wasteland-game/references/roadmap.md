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
  the seal texture leaves the ring to the glow; the camera can scroll a tile above the map in
  combat, so the gauge fits above the top row. (There's no top bar any more: the HUD is the
  message log, the health bar and a floating combat label.)

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
- **More people.** So far: Gus the village shopkeeper (dialog, Charisma-based barter), the
  store's guard (both turn hostile on attack or theft), and Rosa in the starting shack, who
  explains the area. Likely next: dialog that depends on state (quests, reputation), traders
  restocking over time, theft that needs a witness, creatures tracking ammo (the guard's
  pistol never runs dry), people taking sides in fights with monsters, and keeping the store
  out of a provoked guard's sight of the village entrances (today he can see some of them).
- **Real sprite art** (a sprite sheet) replacing the generated placeholders.
- **Doors, locks and lockpicking.** Doors as a tile or map object that opens and closes
  (blocks walking and sight while closed), some of them locked. A new Lockpick skill (a
  fourth entry in `SKILLS`, taggable, raised with skill points) gives the chance to pick a
  lock; maybe keys as items. Door state (open, locked, picked) is saved per map like chests.
  Locked doors could guard loot rooms, and picking an owned door could count as theft.
- **Weapon deterioration and maintenance.** Weapons wear with use and work worse as they do
  (lower damage or hit chance, guns jamming), until repaired at a weapon workbench using scrap
  metal or other materials. Needs a per-weapon condition, which items don't have today:
  identical items share one stack (`ItemContainer`), so a weapon's condition has to live
  somewhere else, e.g. per equipped slot like the loaded rounds, or stacks split by condition.
- **More character creation** (`scenes/CreationScene.ts`, rules in `core/creation.ts`; name,
  gender, S.P.E.C.I.A.L. and difficulty are done): choosing the tagged skills, as in Fallout
  (every character still tags Small Guns and Melee Weapons), and perhaps traits.
- **Give Perception a use.** It has no effect yet (the character sheet says so): for example
  your sight range, the range penalty on ranged attacks, or noticing hidden things. When it
  gets one, update its text in `SPECIAL_EFFECTS` (`core/stats.ts`).
- **More difficulty knobs.** Easy/normal/hard exist (`core/difficulty.ts`, chosen at character
  creation, saved): they change how often enemies hit you and how much damage you take. Other
  candidates: damage dealt, loot amounts, prices.
