# User Guide

This document is the user guide for BT Visualizer. It assumes you already know what a behavior tree is and have the app open.

> This document is updated as features ship. Last updated: 2026.05.10.

## Keyboard reference

| Shortcut              | Action                                          |
| --------------------- | ----------------------------------------------- |
| Shift + Click         | Add to or remove from selection                 |
| Shift + Drag          | Box-select nodes (node edges must be clicked)   |
| Ctrl / Cmd + A        | Select every node and edge                      |
| Delete / Backspace    | Remove every selected node and edge (one step)  |
| Ctrl / Cmd + D        | Duplicate selected objects in place             |
| Ctrl / Cmd + Z        | Undo the previous action                        |
| Ctrl / Cmd + Shift + Z| Redo the previous undo                          |
| Ctrl / Cmd + S        | Save the current tree to a JSON file            |
| Ctrl / Cmd + O        | Open a tree from a JSON file                    |

## Common workflows

### Build a tree

1. Drag a node kind from the left-hand palette onto the canvas.
2. Connect nodes by dragging from a parent's bottom handle to a child's top handle. Action and Condition nodes are leaves — they have no bottom handle by design.
3. Click a node to edit its **name** and **node type (kind)** in the right-hand property panel. The Root node's kind is locked, but its name is editable.

### Select multiple items

- `Shift + click` a second node to add it to the selection.
- `Shift + drag` on empty canvas to box-select several nodes at once. Box-select covers nodes only; select edges by clicking them.
- `Ctrl/Cmd+A` selects everything, including edges.

Selecting more than one thing replaces the property panel with a summary like `2 nodes, 1 edge selected`. 

### Delete

Select one or more items and press `Delete` or `Backspace`.

- **Root cannot be deleted.** This is intentional design.
- When you delete a parent, its children become orphans (no parent). They're still on the canvas, just disconnected. The Validate panel will flag them as R8 warnings.

### Undo and redo

History keeps **up to 10 steps** and is shared across every tab. Ctrl/Cmd+Z always undoes the most recent action, such as adding a node, renaming Main, or deleting a tab.

### Save and open

- **Save** downloads the current tree to your default download location. The format meaning is documented in [`bt-json-format.md`](./docs/bt-json-format.md).
- **Open** replaces the current tree. 
- If the file is malformed or fails validation, the toolbar shows an error and the current tree is kept.

### Multiple trees

A document can hold several behavior trees. The **tab bar** above the canvas is one tab per tree. The first tab **Main** is the document's entry point and cannot be deleted.

- **Switch trees:** Click a tab to switch to another tree's canvas.
- **Create a new tree:** Click the **+** button. **It sits at the right end of the tab bar**. New trees auto-name as `Tree 2`, `Tree 3`, …
- **Rename a tree:** Double-click the tab name. Renaming a tree also updates every `SubTree` node that referenced its old name.
- **Delete a tree:** Hover over a non-Main tab and click the **×** that appears on the right side. SubTree nodes that pointed at the deleted tree become invalid references and will surface as validation issues at save time.

### Validate

Click **Validate** in the toolbar. The bottom panel lists structural issues, errors first. Click a row to select the offending node on the canvas — the property panel jumps to it so you can fix it in place.

Validate is a point-in-time check; it does not run continuously. After you edit, run it again.

## Understanding validation rules

Each rule is documented in full in [`bt-json-format.md` §5](./docs/bt-json-format.md). 

Summaries:

| ID  | Severity | Meaning                                           | Typical fix                                           |
| --- | -------- | ------------------------------------------------- | ----------------------------------------------------- |
| R1  | error    | Exactly one Root node; its id is `rootId`.        | Should never fire from the UI — indicates a bad file. |
| R2  | error    | Root has exactly one child.                       | Connect Root to a single top-level composite.         |
| R3  | error    | Action and Condition have no children.            | Remove outgoing connections; these are leaves.        |
| R4  | error    | Sequence / Fallback / Parallel have ≥ 1 child.    | Connect at least one child, or change the kind.       |
| R5  | error    | Decorator has exactly 1 child.                    | Add or remove a child so the count is 1.              |
| R6  | error    | No cycles in the tree.                            | Break the loop by deleting a back-edge.               |
| R7  | error    | A non-Root node has at most 1 parent.             | Delete the extra incoming connection.                 |
| R8  | warning  | A non-Root node has no parent (orphan).           | Connect it to a parent, or delete it.                 |
