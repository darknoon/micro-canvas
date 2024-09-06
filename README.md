

goals:
- very minimal vector drawing app
- easy to embed anywhere, eg Gradio for doing AI vector drawing
- support enough features to allow humans to "do it the hard way" for datasets
- act enough like a canvas to make designers relatively comfortable using it
- lightweight and performant for smooth drawing experience

todo:
- [ ] basic bézier curve drawing (via bezier.js)
  - [x] correct bounding box
  - [x] add point on curve
  - [ ] pen tool draw out points
  - [x] select & move points
- [ ] canvas stuff
  - [ ] zoom (with mouse wheel and pinch gestures)
  - [x] pan
  - [ ] resize controls
- [ ] misc pen tool stuff
  - [ ] option-click to remove point
  - [ ] double-click to convert between curve and corner points
- [ ] arrow keys for moving points and shapes
  - [ ] basic arrow key movement
  - [ ] shift+arrow keys for moving faster
  - [ ] ctrl/cmd+arrow keys for pixel-perfect adjustments
- [ ] save/load
  - [ ] save/load localStorage
  - [ ] save/load to/from clipboard
  - [ ] export to SVG and PNG formats
- [ ] undo/redo
  - [ ] undo/redo stack
  - [ ] handle coalescing multiple actions
  - [ ] keyboard shortcuts (ctrl/cmd+Z, ctrl/cmd+shift+Z)
- [ ] inspector panel?
  - [ ] show selected shape properties
  - [ ] edit selected shape properties
  - [ ] color picker for fill and stroke
- [ ] layer management
  - [ ] create, delete, and reorder layers
  - [ ] toggle layer visibility
