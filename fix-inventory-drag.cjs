const fs = require('fs');
let content = fs.readFileSync('src/components/game/Inventory.tsx', 'utf8');

const regex = /if \(sourceContainerId && targetContainer === 'root-inventory'\) \{[\s\S]*?\} else if \(\!sourceContainerId && targetContainer === 'root-inventory'\) \{[\s\S]*?\}/;

const replacement = `if (targetContainer === 'root-inventory') {
          if (sourceContainerId) {
            socket?.emit('removeItemFromContainer', itemId, sourceContainerId);
          } else {
            socket?.emit('moveItemToContainer', itemId, 'root-inventory');
          }
        } else {
          socket?.emit('moveItemToContainer', itemId, targetContainer);
        }`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/game/Inventory.tsx', content);
