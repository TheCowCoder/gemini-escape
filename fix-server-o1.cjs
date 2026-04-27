const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const helperCode = `
const getInventoryLookup = (inventory: any[]) => {
  const lookup = new Map<string, { item: any, parentList: any[], index: number }>();
  const traverse = (list: any[]) => {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item.id) {
        lookup.set(item.id, { item, parentList: list, index: i });
      }
      if (item.contents) traverse(item.contents);
    }
  };
  traverse(inventory);
  return lookup;
};
`;

// Insert helperCode before findItemRecursive
content = content.replace('const findItemRecursive', helperCode + '\nconst findItemRecursive');

// Update moveItemToContainer to use lookup
const moveTarget = `    socket.on('moveItemToContainer', (itemId: string, containerId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const targetItem = removeItemRecursive(player.inventory, itemId);
      if (!targetItem) return;

      if (containerId === 'root-inventory') {
        player.inventory.push(targetItem);
      } else {
        const found = findItemRecursive(player.inventory, containerId);
        if (found && found.item.tags?.includes('container')) {
          if (!found.item.contents) found.item.contents = [];
          if (found.item.maxSlots && found.item.contents.length >= found.item.maxSlots) {
            player.inventory.push(targetItem); // Revert if full
          } else {
            found.item.contents.push(targetItem);
          }
        } else if (found) {
          // Rearrange: insert before the target item
          found.ownerList.splice(found.index, 0, targetItem);
        } else {
          // Fallback to root
          player.inventory.push(targetItem);
        }
      }

      broadcastState(session);
    });`;

const moveNew = `    socket.on('moveItemToContainer', (itemId: string, containerId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(itemId);
      if (!entry) return;

      // Remove from old location
      entry.parentList.splice(entry.index, 1);
      const targetItem = entry.item;

      if (containerId === 'root-inventory') {
        player.inventory.push(targetItem);
      } else {
        const containerEntry = lookup.get(containerId);
        if (containerEntry && containerEntry.item.tags?.includes('container')) {
          const container = containerEntry.item;
          if (!container.contents) container.contents = [];
          if (container.maxSlots && container.contents.length >= container.maxSlots) {
            player.inventory.push(targetItem); // Revert if full
          } else {
            container.contents.push(targetItem);
          }
        } else if (containerEntry) {
          // Rearrange: insert before the target item
          containerEntry.parentList.splice(containerEntry.index, 0, targetItem);
        } else {
          player.inventory.push(targetItem);
        }
      }

      broadcastState(session);
    });`;

content = content.replace(moveTarget, moveNew);

// Update removeItemFromContainer
const removeTarget = `    socket.on('removeItemFromContainer', (itemId: string, containerId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const targetItem = removeItemRecursive(player.inventory, itemId);
      if (targetItem) {
        player.inventory.push(targetItem);
        broadcastState(session);
      }
    });`;

const removeNew = `    socket.on('removeItemFromContainer', (itemId: string, containerId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(itemId);
      if (entry) {
        entry.parentList.splice(entry.index, 1);
        player.inventory.push(entry.item);
        broadcastState(session);
      }
    });`;

content = content.replace(removeTarget, removeNew);

// Update dropItem
const dropTarget = `    socket.on('dropItem', (itemId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const item = removeItemRecursive(player.inventory, itemId);
      if (item) {
        addChatMessage(session, { 
          type: 'narrative', 
          text: \`\${player.name} dropped the \${item.name}.\` 
        });
        broadcastState(session);
      }
    });`;

const dropNew = `    socket.on('dropItem', (itemId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(itemId);
      if (entry) {
        entry.parentList.splice(entry.index, 1);
        const item = entry.item;
        addChatMessage(session, { 
          type: 'narrative', 
          text: \`\${player.name} dropped the \${item.name}.\` 
        });
        broadcastState(session);
      }
    });`;

content = content.replace(dropTarget, dropNew);

fs.writeFileSync('server.ts', content);
