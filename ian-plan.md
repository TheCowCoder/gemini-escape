# Ian Plan

## Goal

Turn Gemini Escape into a chat-first invention game where semantic physics, crafting, salvage, and improvised problem solving are the main loop instead of a spawn-menu toybox.

Multiplayer is a core constraint:
- the full game, Freeplay, and authored levels should all support online multiplayer
- design for any number of players rather than a fixed small party size

The player should solve authored levels by:
- finding items through play
- inventing multi-step plans in natural language
- constructing new objects entirely through chat
- partially deconstructing or salvaging existing objects through chat
- carrying all discovered or created physical objects as item cards

## Requested Product Direction

### Semantic invention is the main fantasy

The core action should support prompts like:

"I take the ladder, climb up the tree, cast the 50m rope around the tree, tie a heavy stone to one end of the rope. Get on the ground, tie the other end of the rope to me, drop the stone. Do I fly to the other end of the chasm?"

This is not a rigid combine command. It is a freeform, multi-step, physical invention prompt. The engine should judge plausibility, resolve consequences, and update world state plus inventory cards.

### Crafting and deconstruction happen in chat

Examples to support:
- "Combine the stick and string to make a bow."
- "Use another stick and a knife to make an arrow."
- "Deconstruct the bow into 1m rope and a bent stick."
- "Untie the rope from the catapult."

Expected semantics:
- construction can consume some ingredients while preserving tools
- deconstruction can return plausible remnants instead of pristine originals
- partial deconstruction can extract a part while leaving the parent object intact
- any picked up, crafted, salvaged, or newly revealed object must become a card

### Card behavior expectations

Examples called out explicitly:
- stick + string -> bow
- another stick + knife -> arrow, while the knife remains
- bow deconstruction -> bent stick + 5m rope
- 50m rope + stick -> bow + 45m rope remaining
- untie the rope from a full catapult -> rope card added while the catapult remains

### Item presentation

Replace tiny neutral item markers with large representative emoji for items. The model is good at assigning emoji, so the card system should preserve a model-provided emoji when available and only fall back to local inference when needed.

Note from current repo state:
- the main inventory cards already display large emoji
- dot bullets still exist in world-list surfaces such as the world panel exits
- confirm later whether the "replace the dot" request targets another item list, all item surfaces globally, or both

## Authored Content and Editor Requests

These are the explicit requested changes for the next planning branch:

1. Remove the spawn menu as the core progression mechanic. The player should find items through play, not pull them from a modal toybox.
2. Add a real main menu with separate entry points for Online Play, Level Editor, and Freeplay.
3. Move authored level content out of constants.ts and into a levels/ folder.
4. Store level facts in JSON files, not markdown. The base should remain close to LevelData: id, title, levelDescription, and levelGoal.
5. Add starting inventory to authored level data as the first practical extension, since it is currently trapped in server.ts.
6. Keep system prompts and user prompts as separate markdown artifacts, not as a single merged blob.
7. Build the level editor as a separate route that clones the real game display for playtesting, with a reset button and tight edit-run-reset loops.
8. Make the level editor prose-centric and prompt-centric. The important authored surface is the longform level description plus prompt markdown, not a complex scene-graph schema.
9. Keep item discovery semantic. The current planning direction is that the model owns discovery truth more than explicit hidden item placement does, so the editor should focus on world prose, prompt rules, guardrails, and debugging rather than rigid item hotspots.
10. Preserve strong debugging surfaces in the editor: preview using the real game UI, reset/replay flow, and visibility into prompt composition and model behavior.
11. Treat the current semantic card refactor as useful groundwork, but expect the spawn-related parts to be removed or reshaped once the level-editor branch starts.

## Current Architecture Snapshot

Verified from the current codebase:
- authored level data lives in constants.ts
- starting inventory is created in server.ts during player join
- the runtime still exposes a spawnMenu in game state and in the inventory UI
- the engine already supports semantic multi-step actions and deterministic inventory add/remove deltas
- the engine prompt already instructs the model to preserve tools, allow salvage, and assign emoji to new cards
- the app currently has a single join/game flow, not a routed main-menu/editor structure

This means the semantic crafting foundation exists, but it is still wrapped in a spawn-driven sandbox architecture.

## Suggested Runtime Direction

### Keep authoring light, make runtime cards richer

Authored levels should stay prose-first and prompt-first.

Runtime item cards should gain just enough structure to support reliable semantic physics without turning the editor into a complex data-entry tool.

Suggested optional item-card fields beyond the current shape:
- affordances: semantic verbs or capabilities such as tie, cut, bend, wedge, float, anchor
- materials: wood, rope, steel, glass, flesh, cloth
- measurements: length, weight, volume, count, charge, sharpness, durability
- condition: intact, bent, frayed, cracked, soaked, lit, radioactive
- madeWith: a lightweight note describing what the item was made with or what key parts matter for salvage
- provenance: found, crafted, salvaged, world-discovered

This can stay runtime-generated and model-maintained. It does not need to become a heavy authored schema.

Planning decision captured:
- use curated physical quantities, not full numeric simulation
- explicitly track quantities that matter for gameplay such as rope length, liquid volume, charges or ammo, container fill state, durability, and notable weight when relevant
- keep all other physical detail semantic and narrative unless it becomes gameplay-critical

### Inventory operations should model transformation, not full rewrites

The current remove-and-add delta approach is a good base, but the prompt and schema should explicitly support these cases:
- consume entire item
- consume partial quantity and return remainder as a new card
- preserve tools used during construction
- replace one constructed object with salvage remnants
- extract a component from a composite object while leaving the parent object intact
- create cards for newly discovered world objects when players obtain them

Even if the wire format remains remove-plus-add, the semantic contract should explicitly cover remainder and extraction cases.

### Composite objects should be semantically reversible without heavy structure

Default direction chosen during planning:
- most crafted-card reversibility should stay model-inferred
- instead of a heavy component graph, add a lightweight `madeWith` entry when it helps preserve salvage logic
- keep exact numbers in curated measurement fields when conservation matters

Example:
- Bow
  - materials: wood, rope
  - measurements: ropeUsed = 5m
  - madeWith: ash stick and 5m rope

That still supports later outcomes like:
- bow -> bent stick + 5m rope
- cut bowstring -> bow frame remains, rope/string is extracted, bow loses function

### Discovery should stay in-world

The current spawn toybox is useful as a brainstorming reference but should not be a player-facing progression surface.

Updated planning decision:
- the toybox should not remain in authored progression levels
- it should survive as a separate Freeplay mode with an intentionally sandbox-like spawn-plus-prompt experience
- editor/debug tooling may still expose fast injectors, but that is distinct from the player-facing Freeplay mode

Initial Freeplay seed concept captured from planning:
- starting level prose: "The player is in a flat grassy lightly packed forest with friendly wildlife"
- extremely broad spawn menu with fun and chaotic items
- the point is open-ended invention play, not authored level progression

### The world should expand procedurally from a seeded start

New direction clarified during planning:
- `level.json` should define the starting situation, not the full hidden world
- the model should be able to reveal or invent downstream facts such as what lies down a path, what is at the bottom of the chasm, whether there are villages, and other logically connected world details
- once those facts are established in a run, they should remain canon for that session instead of drifting turn to turn

The safest implementation shape is:
- authored files provide the seed world and prompt guardrails
- runtime keeps a hidden session-world-canon artifact in memory
- the model should propose structured patches to that session canon whenever it procedurally generates new world truth
- the deterministic layer applies those patches and includes the updated canon in later prompts
- resetting the level/editor resets the session canon back to the authored seed

Important note:
- this session-world-canon artifact should be runtime state, not a file write back to the authored markdown or JSON
- the model may conceptually "patch" its active world memory, but the app should own that state explicitly rather than relying on raw model memory alone
- planning decision captured: every procedural world-generation step should also emit a session-canon memory update so continuity does not drift

## Suggested Level Package Layout

One likely shape:

levels/
- level-001/
  - level.json
  - system-prompt.md
  - user-prompt.md
- level-002/
  - level.json
  - system-prompt.md
  - user-prompt.md

Suggested level.json shape:
- id
- title
- levelDescription
- levelGoal
- startingInventory

Possible later optional fields:
- authorNotes
- debugOverrides
- tags

## Main Menu and Routing Direction

The app should grow from a single join screen into at least three surfaces:
- Main Menu
- Online Play for authored levels
- Level Editor
- Freeplay

Suggested route shape:
- /
- /play
- /editor/:levelId
- /freeplay

The editor route should reuse the real multiplayer play surface for preview rather than invent a separate fake renderer.

## Level Editor Direction

The editor should optimize for fast prompt iteration, not scene-graph authoring.

Primary editing surfaces:
- longform level description
- system prompt markdown
- user prompt markdown
- starting inventory
- debug tools showing prompt composition and model outputs

Primary editor workflow:
1. edit prose or prompt artifacts
2. run the real play view
3. submit actions
4. inspect prompt/model/debug state
5. reset the simulation instantly
6. repeat

Multiplayer editor requirement captured during planning:
- the editor should test against the real online multiplayer runtime, not a single-player-only shortcut
- authored levels and Freeplay should both support any number of connected players

Important debugging surfaces to preserve:
- rendered final prompt composition
- raw model JSON response
- inventory delta output
- environment update output
- retry/error state visibility
- reset and replay controls

Planning decision captured:
- in the level editor, full debug surfaces should be visible by default rather than hidden behind an advanced toggle
- authors should always be able to inspect prompt layers, session canon, raw model output, retries, and delta application while playtesting

## Planning Implications For The Engine

The engine prompt should eventually be split into:
- global system behavior rules
- level-authored system prompt artifact
- level-authored user prompt artifact
- runtime state serialization
- hidden session-world-canon serialization

Recommended prompt composition per turn:
- stable system rules: semantic physics rules, inventory invariants, output schema rules, anti-cheese rules
- authored level seed: starting world prose, goal, authored constraints, authored tone, authored discovery guardrails
- mutable session canon: newly established truths from this run such as discovered routes, settlements, hazards, revealed geography, NPC facts, and irreversible world changes
- live runtime state: current environment snapshot, current inventory cards, current turn number, current multiplayer state
- player action input: the actual freeform action text for this turn

Important implementation note:
- this does not require the model to perform read-tool calls during play
- the app/server should already hold the authored artifacts, current runtime state, and session canon in memory
- each turn, the engine should compose one effective prompt from those layers and send it to the model
- if the SDK only accepts a single prompt string, keep these as separate artifacts in code and concatenate them deliberately at request time

Recommended separation of concerns:
- stable rules belong in the system-level layer
- the authored level seed and mutable session canon should remain distinct blocks even if they are both sent as hidden high-priority context
- the player action should remain the user-turn content

Planning decision captured:
- use layered hidden context, not a single mutable prompt blob
- stable rules stay hidden and stable
- level seed stays hidden and authored
- session canon stays hidden and mutable per run
- player action remains the explicit user-turn input

Why keep session canon separate instead of rewriting the system rules:
- the model still has equal access to the canon because it is included every turn
- stable rules stay stable
- world facts become patchable without risking accidental rule drift
- editor debugging becomes much clearer because authored rules, authored seed, and runtime discoveries can be inspected independently

The model should remain responsible for:
- semantic plausibility judgment
- discovery and invention narration
- card creation details such as emoji, naming, and semantic notes
- deciding what is consumed, preserved, extracted, or transformed
- proposing new world canon when the player pushes beyond the authored starting facts

The deterministic layer should remain responsible for:
- applying inventory operations exactly as returned
- validating allowed schema shape
- preserving untouched cards
- keeping editor resets and replay deterministic from the same starting state
- applying structured session-world-canon patches instead of trusting implicit prompt memory

## Recommended First Implementation Slice

When implementation starts, a sensible first vertical slice is:

1. Move level data into levels/ with JSON plus separate prompt markdown files.
2. Move starting inventory into authored level data.
3. Add a simple main menu and route split for play versus editor.
4. Move the spawn UI out of the live player inventory and, if still needed, behind editor-only debug tools.
5. Strengthen the engine prompt/schema for partial consumption, salvage remnants, and composite extraction.
6. Add editor debug panels for prompt composition and raw model response.

## Planning Status

This planning pass has resolved the major product-direction questions captured so far.

The next useful step is likely implementation planning: file layout changes, schema drafts, route structure, and staged refactor order.

## Next Decision To Resolve

The next planning question is not whether the world can expand. It can.

The real question is what newly generated facts must be elevated into explicit session canon so the world remains stable.

Possible answers range from:
- minimal canon: only visited locations, acquired items, NPCs met, and irreversible changes
- medium canon: the above plus newly revealed landmarks, routes, hazards, and settlements
- maximal canon: almost every concrete new fact the model invents becomes structured session memory

That choice will determine how reliable long-form continuity feels and how much debug visibility the editor needs.