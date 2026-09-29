# COT-21 v0.18 Visual Rebuild

## Decision
Stop incremental visual patching. Preserve gameplay logic, but rebuild the visual layer from scratch.

## Quality target
Small commercial pixel game quality. Target consistency comparable to polished Kairosoft-style presentation:
- consistent pixel density
- consistent scale between ships / islands / rocks / UI
- unified shadows and outline rules
- cohesive palette
- readable UI at smartphone size
- animated game feel from a small number of frames
- screenshot should look like a finished game, not a prototype

## Locked gameplay assets
Keep as-is unless later playtesting requires change:
- tilt controls
- 4-direction movement
- horizontal primary / vertical auxiliary steering
- forced vertical scroll
- time = health/resource
- route graph
- Log Pose time costs
- C→F→I time trap
- pre-sail chart pauses
- live chart does not pause
- v0.13.2 difficulty baseline
- success/failure comedic tone

## v0.18 deliverables — NO implementation yet
Create four final-quality visual targets before touching game rendering:

### 1. Golden Gameplay Screen — S→A
Representative high-risk Marine route.
Must include:
- portrait top-down 2D view
- player pirate ship, always facing upward
- Marine ships as visible attack source
- cannon warnings/projectiles
- reefs
- pirate pursuer
- Sea King
- foam/wake/current surface detail
- three-block HUD: deadline / position / route+main hazard
- no damage gauge
- visual space still readable during mixed hazards
- normal Buggy-pop palette

### 2. Pre-sail World Chart
Not a debug graph. It must look like an in-world pixel map.
Must include:
- actual pixel islands rather than abstract nodes
- sea motifs / reefs / currents / silhouettes
- route ropes/dotted trails
- hazard identity in the geography
- sailing time and Log Pose time readable
- CFI still looks deceptively safe if user only watches risk
- current position and goal immediately understandable

### 3. Title Screen
Communicate the game in seconds.
Must convey:
- Buggy is the protagonist
- comedic panic
- Cross Guild pressure exists in the premise
- core loop: TILT / ROUTE / TIME
- bright pop palette
- no heavy Cross Guild dark palette during normal state

### 4. Failure Screen
Hard tonal break.
Must include:
- normal Buggy palette disappears
- black / deep red / antique gold Cross Guild palette
- horror-comedy pressure
- heading: 『……バギー。』
- apology: 『ごめんなさい。すいませんでした。二度としません。許してください。』

## Art rules
### Pixel base
- fixed internal pixel scale around 320×480-class portrait composition
- nearest-neighbor enlargement
- no mixed pixel densities
- no smooth vector gradients
- outlines use one consistent darkest ink color
- most sprites use 2–3 shade steps per material

### Normal palette
- Buggy Red #E43D45
- Circus Blue #2786C1
- Deep Sea Blue #165477
- Sky Cyan #55B8D0
- Cream #FFF1D6
- Bubblegum Pink #F19AAF
- Carnival Yellow #F4C84B
- Show Purple #7359A6
- Orange #E98438
- Sand #D7B576
- Ink Navy #172B3C
- Cloud White #F5F4ED

### Failure palette
- Obsidian #101217
- Cross Guild Wine #4B1017
- Blood Red #8C2028
- Antique Gold #C39A43
- Tarnished Gold #79612F
- Bone #E3DAC4
- Dead Gray #55545A

## Implementation gate
Do not resume production rendering until the user approves the Golden Gameplay Screen direction.
After approval:
- v0.19: convert approved visual targets into production asset sheets / tiles / UI atlas
- v0.20: integrate assets into the preserved game logic
- only then expand the same art rules to other routes.