const fs = require('fs');
let content = fs.readFileSync('src/components/game/Inventory.tsx', 'utf8');

content = content.replace(
  `} else if (!sourceContainerId && targetContainer !== 'root-inventory') {
          // move from root to current container
          socket?.emit('moveItemToContainer', itemId, targetContainer);
        }`,
  `} else if (!sourceContainerId && targetContainer !== 'root-inventory') {
          // move from root to current container
          socket?.emit('moveItemToContainer', itemId, targetContainer);
        } else if (!sourceContainerId && targetContainer === 'root-inventory') {
          socket?.emit('moveItemToContainer', itemId, 'root-inventory');
        }`
);

fs.writeFileSync('src/components/game/Inventory.tsx', content);
