
goals:
- very minimal vector drawing app
- easy to embed anywhere, eg Gradio for doing AI vector drawing
- support enough features to allow humans to "do it the hard way" for datasets
- act enough like a canvas to make designers relatively comfortable using it

todo:
- [ ] basic bézier curve drawing (via bezier.js)
  - [x] correct bounding box
  - [x] add point on curve
  - [ ] pen tool draw out points
  - [x] select & move points
- [ ] arrow keys for moving points and shapes
  - [ ] basic arrow key movement
  - [ ] shift+arrow keys for moving faster
- [ ] save/load
  - [ ] save/load localStorage
  - [ ] save/load to/from clipboard
- [ ] inspector panel?
  - [ ] show selected shape properties
  - [ ] edit selected shape properties
