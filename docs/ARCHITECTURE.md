# Hesabu Lab architecture

Hesabu Lab is a static web app: TypeScript, Three.js for the 3D scene and Rapier (a Rust physics
engine compiled to WebAssembly) for the marbles. There is no server or database. Everything runs
in the player's browser.

The diagrams below use [Mermaid](https://mermaid.js.org/), which GitHub renders automatically.

1. [Project structure](#1-project-structure)
2. [From source to the player's browser](#2-from-source-to-the-players-browser)
3. [Module dependencies](#3-module-dependencies)
4. [Layers and responsibilities](#4-layers-and-responsibilities)
5. [One round of play](#5-one-round-of-play)
6. [The frame loop](#6-the-frame-loop)
7. [Screen layouts and camera framing](#7-screen-layouts-and-camera-framing)

## 1. Project structure

```mermaid
flowchart LR
    root["hesabu-lab/"]

    root --> src["src/<br/>game code"]
    root --> blender["blender/<br/>model scripts"]
    root --> public["public/<br/>static files"]
    root --> scripts["scripts/<br/>play-testing"]
    root --> gh[".github/workflows/<br/>CI/CD"]
    root --> cfg["index.html · vite.config.ts<br/>package.json · tsconfig.json"]

    src --> main["main.ts<br/>startup, menu, round loop"]
    src --> modes["modes/<br/>addition · subtraction<br/>multiplication · division"]
    src --> core["factory.ts · world.ts · physics.ts<br/>hud.ts · fx.ts · audio.ts · marbles.ts"]
    src --> math["math/<br/>generators + diagnose + tests"]
    src --> css["style.css"]

    blender --> bpy["crate.py · truck.py · common.py"]
    blender --> previews["previews/<br/>render of each model"]
    public --> models["models/<br/>crate.glb · truck.glb"]
    public --> headers["_headers<br/>Cloudflare caching"]
    scripts --> playtest["playtest.py<br/>headless round + screenshots"]
    gh --> ci["ci.yml"]
```

| Folder | Role |
|---|---|
| `src/math/` | Pure maths logic with no graphics: problem generators and `diagnose*` functions that name the mistake behind a wrong answer. Unit-tested with Vitest. |
| `src/modes/` | One script per game mode. Each reads like the lesson: show, ask, check, hint. |
| `src/factory.ts` | Shared game mechanics that modes call: build a number, seal a crate, open a crate, take away, share to trucks. |
| `src/world.ts` | The Three.js scene, lights, bloom, layout constants and camera framing. |
| `src/physics.ts` | Rapier marble physics inside the tube. |
| `src/hud.ts` | Everything in the DOM: written sum, messages, action buttons, keypad. |
| `src/fx.ts` · `src/audio.ts` | Tweens, particles, camera shake, and synthesised sound effects. |
| `blender/` | Python scripts that build the 3D models headlessly in Blender. |
| `scripts/playtest.py` | Plays a full round in headless Chromium on desktop, phone or tablet screens. |

## 2. From source to the player's browser

```mermaid
flowchart TB
    subgraph Local["Developer's machine"]
        direction LR
        bpy["blender/*.py"] -->|"Blender, headless"| glb["public/models/*.glb"]
        src["src/ · index.html<br/>public/_headers"]
    end

    subgraph CI["GitHub Actions: ci.yml"]
        direction LR
        check["check job<br/>tsc · vitest · vite build"] --> deploy["deploy job<br/>check token · wrangler pages deploy"]
    end

    glb --> repo[("GitHub repo")]
    src -->|"git push to main"| repo
    repo --> check
    deploy -->|"dist/ with API token"| pages[("Cloudflare Pages<br/>hesabu-lab.pages.dev")]
    src -.->|"pnpm run deploy<br/>with wrangler login"| pages
    pages -->|"HTML, hashed JS and CSS, models"| browser["Player's browser"]
    fonts[("Google Fonts<br/>Baloo 2")] --> browser
```

Pull requests run only the `check` job. Pushes to `main` that pass are deployed with the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets. A manual `pnpm run deploy`
uses your own `wrangler login` session instead, so it works even when the CI token doesn't.
Vite gives the built JS and CSS a content hash in their file names, and `public/_headers`
lets browsers keep the hashed JS and CSS for a year, keep models for a day, and always re-check
the HTML so updates appear straight away.

## 3. Module dependencies

Arrows point from a module to what it imports.

```mermaid
flowchart TD
    main["main.ts"]

    subgraph Modes["src/modes/"]
        add["addition.ts"]
        sub["subtraction.ts"]
        mul["multiplication.ts"]
        div["division.ts"]
    end

    subgraph Engine["Game engine"]
        factory["factory.ts"]
        world["world.ts"]
        physics["physics.ts"]
        marbles["marbles.ts"]
        fx["fx.ts"]
        audio["audio.ts"]
        hud["hud.ts"]
    end

    subgraph Maths["src/math/ (pure, tested)"]
        madd["addition.ts"]
        msub["subtraction.ts"]
        mmul["multiplication.ts"]
        mdiv["division.ts"]
        util["util.ts"]
    end

    subgraph Libs["Libraries"]
        three(["three"])
        rapier(["@dimforge/rapier3d-compat"])
    end

    main --> Modes
    main --> factory & world & physics & fx & hud & audio

    add --> madd
    sub --> msub
    mul --> mmul
    div --> mdiv
    Modes --> hud & fx & audio
    Modes -.->|"type only"| factory

    madd & msub & mmul & mdiv --> util

    factory --> world & physics & marbles & fx & hud & audio
    physics --> world & marbles
    physics --> rapier
    world --> marbles
    world & factory & fx & marbles & physics --> three
    hud -.->|"type only"| world
```

Two rules keep this tidy:

- `src/math/` imports nothing from the rest of the game, so it can be tested on its own and
  later ported to Rust/WASM without touching the graphics.
- Modes never touch Three.js or Rapier directly. They call `Factory` for anything physical and
  `hud` for anything written, so each mode script reads like the lesson it teaches.

## 4. Layers and responsibilities

```mermaid
flowchart TB
    player(["Player: tap, click or keyboard"])

    subgraph UI["Presentation"]
        hudL["hud.ts + style.css<br/>sum panel · messages · buttons · keypad"]
        worldL["world.ts<br/>Three.js scene · bloom · CSS2D labels · camera"]
    end

    subgraph Lesson["Lesson scripts"]
        modeL["modes/*.ts<br/>show → ask → check → hint"]
    end

    subgraph Mechanics["Mechanics"]
        factoryL["factory.ts<br/>build · seal · openCrate · takeAway · shareRound"]
        physicsL["physics.ts<br/>Rapier marbles in the tube"]
        juice["fx.ts + audio.ts<br/>tweens · particles · shake · sounds"]
    end

    subgraph Logic["Pure logic"]
        mathL["math/*.ts<br/>makeProblem · diagnose"]
    end

    player <--> hudL
    worldL --> player
    hudL <-->|"ask() / askNumber() resolve with the answer"| modeL
    modeL -->|"makeProblem, diagnose"| mathL
    modeL -->|"await f.seal(), f.openCrate()..."| factoryL
    factoryL --> physicsL
    factoryL --> worldL
    factoryL --> juice
    factoryL -->|"messages, e.g. TEN marbles! Seal it!"| hudL
```

## 5. One round of play

An addition round, for example 27 + 5. The other modes follow the same pattern with different
mechanics (open a crate, take away, add a group, share to trucks).

```mermaid
sequenceDiagram
    autonumber
    actor P as Player
    participant M as main.ts
    participant A as modes/addition.ts
    participant Q as math/addition.ts
    participant H as hud.ts
    participant F as factory.ts
    participant W as world + physics

    M->>A: playAddition(factory, level)
    A->>Q: makeProblem(level)
    Q-->>A: { a: 27, b: 5 }
    A->>H: renderColumn("+", 27, 5)
    A->>F: build(27)
    F->>W: 2 crates on the shelf, 7 marbles in the tube

    loop until 5 marbles are dropped
        A->>H: ask([DROP])
        P->>H: tap DROP (or Space)
        H-->>A: "drop"
        A->>F: dropMarble()
        F->>W: Rapier marble falls into the tube
        opt tube reaches 10
            A->>F: seal(onFormed), where onFormed shows the carry
            F->>H: say("TEN marbles! Seal it!")
            F->>W: lid closes, crate forms and slides to the shelf
            F->>H: onFormed() shows the carried 1 as the crate forms
        end
    end

    A->>H: askNumber()
    P->>H: types 22 on the keypad
    H-->>A: 22
    A->>Q: diagnose(problem, 22)
    Q-->>A: "forgot-carry"
    A->>H: say(hint), pulseCarry()
    A->>F: hopCrates()
    P->>H: types 32
    H-->>A: 32
    A->>Q: diagnose(problem, 32)
    Q-->>A: "correct"
    A-->>M: "27 + 5 = 32"
    M->>H: stars + "YES!"
    M->>F: celebrate(), then clearAll() for the next round
```

After 3 correct answers at level 1, `main.ts` moves the player to level 2 (bigger numbers).

## 6. The frame loop

`main.ts` drives one loop through `renderer.setAnimationLoop`. Mode scripts run alongside it as
`async` functions: `await wait(0.5)` and `await f.seal()` resolve when the loop has advanced
the matching tweens.

```mermaid
flowchart LR
    tick(["each frame"]) --> dt["dt = min(delta, 0.05 s)<br/>0.25 s with ?test"]
    dt --> phys["physics.update<br/>Rapier step, sync marble meshes"]
    phys --> tw["updateTweens<br/>resolves awaited animations"]
    tw --> part["particles.update"]
    part --> shake["shake.update"]
    shake --> wu["world.update<br/>gears, quality guard"]
    wu --> render["world.render<br/>bloom composer + CSS2D labels"]
    render --> tick
```

The quality guard in `world.update` measures the frame rate for the first few seconds. If it is
under 40 fps, it lowers the render resolution in steps, down to 1× on phones.

## 7. Screen layouts and camera framing

CSS decides where the HUD goes. The camera then fits the 3D scene into whatever space is left.

```mermaid
flowchart TD
    resize(["page load, resize, rotate"]) --> mq{"CSS media query"}
    mq -->|"wider than tall,<br/>taller than 520px"| desk["Desktop layout<br/>sum + keypad in a right column"]
    mq -->|"taller than wide"| port["Upright phone or tablet<br/>bottom dock: sum + keypad or buttons"]
    mq -->|"wider than tall,<br/>520px or less"| land["Sideways phone<br/>slim right column"]

    desk --> none["no --scene-* insets"]
    port --> ins["--scene-top / right / bottom / left<br/>on #hud"]
    land --> ins

    none --> read["hud.sceneInsets()"]
    ins --> read
    read --> wr["world.resize(insets)"]
    wr -->|"null"| fixed["Desktop camera:<br/>fixed distance, tuned look-at"]
    wr -->|"insets"| fit["Fit CONTENT box into the free area:<br/>camera distance sets the zoom,<br/>setViewOffset centres it"]
    fit --> fog["Fog follows the camera distance"]
    fixed --> fog
```
