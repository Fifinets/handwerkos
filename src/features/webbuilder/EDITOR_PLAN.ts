export const EDITOR_LAYOUT_PLAN = `
# Visual Editor Layout Plan

## Core Components
1. **Sidebar (Left)** - 300px width, collapsible
   - Tabs: Blocks, Design, Pages
   - Blocks Panel: List of available blocks (draggable)
   - Design Panel: Global theme settings (colors, fonts)
   - Pages Panel: Site structure tree

2. **Canvas (Center)** - Flexible width
   - Device Simulation wrapper (Desktop/Mobile/Tablet)
   - Iframe or scoped container for the user's site
   - "Add Block" drop zones between existing blocks

3. **Top Bar** - 60px height
   - Site Title (renamable)
   - Device Switching Icons
   - Undo/Redo
   - Preview / Publish buttons

## Technical Implementation
- **Route**: \`/webbuilder/editor/:siteId\`
- **State**: \`useWebBuilderStore\` will be hydrated with site data on load.
- **DndKit**: Use @dnd-kit for drag-and-drop of blocks.
- **Tailwind**: Use arbitrary values for precise layout control.

## File Structure
- src/features/webbuilder/pages/WebBuilderEditor.tsx (Main Layout)
- src/features/webbuilder/components/editor/EditorSidebar.tsx
- src/features/webbuilder/components/editor/EditorCanvas.tsx
- src/features/webbuilder/components/editor/EditorTopBar.tsx
`;
