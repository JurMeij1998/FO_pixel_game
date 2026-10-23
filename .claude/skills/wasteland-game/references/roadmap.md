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
- **More from doors and locks** (`core/locks.ts`, `core/buildings.ts`): keys as items;
  picking an owned lock (which, like theft, always turns the owners hostile) only counting
  when someone can see you; owners for houses once villages have residents; closing doors in combat
  (today only walking into one opens it there); people opening doors outside combat (they
  stand still until a fight); lockpicks as an item that helps, as in Fallout.
- **More from weapon condition** (`core/condition.ts`, `core/repair.ts`): a Repair skill
  (cheaper or better repairs), other materials than scrap metal, armour wearing too, traders
  repairing for caps, and enemies' weapons (creature attacks don't wear today).
- **Tagged skills and traits at character creation** (`scenes/CreationScene.ts`, rules in
  `core/creation.ts`): choosing the tagged skills, as in Fallout (every character still tags
  Small Guns and Melee Weapons), and perhaps traits.
- **Give Perception more use.** So far it only adds to Lockpick: it could also set your
  sight range, the range penalty on ranged attacks, or noticing hidden things. Update its
  text in `SPECIAL_EFFECTS` (`core/stats.ts`) when it does.
- **More difficulty knobs** (`core/difficulty.ts`): beyond enemy hit chance and damage taken,
  for example damage dealt, loot amounts and prices.
