const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Replace the findAndAdd logic in moveItemToContainer
const target = `const findAndAdd = (items: ItemTemplate[]): boolean => {
        const container = items.find(i => i.id === containerId);
        if (container) {
          if (!container.contents) container.contents = [];
          if (container.maxSlots && container.contents.length >= container.maxSlots) {
            // Can't fit
            return false;
          }
          container.contents.push(targetItem!);
          return true;
        }
        for (const i of items) {
          if (i.contents && findAndAdd(i.contents)) return true;
        }
        return false;
      };`;

const newCode = `const findAndAdd = (items: ItemTemplate[]): boolean => {
        const targetIdx = items.findIndex(i => i.id === containerId);
        if (targetIdx !== -1) {
          const container = items[targetIdx];
          // If it's a container, or we explicitly want to put inside it
          if (container.tags?.includes('container')) {
            if (!container.contents) container.contents = [];
            if (container.maxSlots && container.contents.length >= container.maxSlots) {
              return false;
            }
            container.contents.push(targetItem!);
            return true;
          } else {
            // Rearrange: insert before the target item
            items.splice(targetIdx, 0, targetItem!);
            return true;
          }
        }
        
        // Also check if containerId is 'root-inventory' or the id of the array itself?
        // handled before findAndAdd.

        for (const i of items) {
          if (i.contents && findAndAdd(i.contents)) return true;
        }
        return false;
      };`;

content = content.replace(target, newCode);

fs.writeFileSync('server.ts', content);
