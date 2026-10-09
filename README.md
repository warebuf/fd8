# fd8 · Robattle

A bare-bones copy of the Medabots (Metabee / Rokusho, GBA) robattle system: you play both sides.

    node server.js      # then open http://localhost:8000/

- `data.js`: parts, attack types, leg types, terrain, presets. **All numbers are placeholders.**
- `game.js`: the battle engine (no DOM). Rules and tuning constants are at the top.
- `index.html`: the setup screen (build 3 medabots per side) and the battle screen.
