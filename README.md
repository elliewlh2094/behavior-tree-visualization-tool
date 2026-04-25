# Behavior Tree Visualization Tool

An offline-first PWA for authoring, visualizing, and validating behavior trees.

## Quickstart

```bash
npm install
npm run dev        # open http://localhost:5173
```

Drag nodes from the palette onto the canvas, connect them by dragging between ports, and hit **Validate** to check the tree. Use **Save** / **Open** to read and write `.json` files. Works offline after first load.

## Build

```bash
npm run build      # produces dist/ — deploy any static host
npm run preview    # preview the production build locally
```

## JSON format

See [`docs/bt-json-format.md`](docs/bt-json-format.md) for the on-disk schema.
