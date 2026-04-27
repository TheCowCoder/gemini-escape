const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// CONFIGURATION
const RESPONSE_FILE = 'response.txt';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Enhanced parser designed for the Semantic Physics System format.
 * Maps file paths (from headers or plain lines) to the subsequent code block.
 */
function parseSemanticResponse(text) {
    const blocks = [];
    const lines = text.split(/\r?\n/);
    
    let currentPath = null;
    let insideBlock = false;
    let currentContent = [];
    let captureFence = '';

    // Patterns for matching paths:
    // 1. ### `path/to/file.js` (Header with backticks)
    // 2. path/to/file.js (Plain path on its own line)
    const headerRegex = /^###\s+(?:\d+\.\s+)?`?([\w\.\/\-\\@]+\.[a-z0-9]+)`?/i;
    const plainPathRegex = /^([\w\.\/\-\\@]+\.[a-z0-9]+)$/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines when looking for a path
        if (!line && !insideBlock) continue;

        // 1. Detect Block Start
        const blockStartMatch = line.match(/^(`{3,})(.*)$/);
        if (blockStartMatch && !insideBlock) {
            if (currentPath) {
                insideBlock = true;
                captureFence = blockStartMatch[1];
                currentContent = [];
            }
            continue;
        }

        // 2. Detect Block End
        if (insideBlock) {
            if (line === captureFence) {
                blocks.push({
                    path: currentPath,
                    content: currentContent.join('\n')
                });
                insideBlock = false;
                currentPath = null; 
            } else {
                // We use the original line from lines array to preserve leading whitespace in code
                currentContent.push(lines[i]);
            }
            continue;
        }

        // 3. Detect File Path (If not inside a block)
        const headerMatch = line.match(headerRegex);
        const plainMatch = line.match(plainPathRegex);
        
        if (headerMatch) {
            currentPath = headerMatch[1];
        } else if (plainMatch) {
            currentPath = plainMatch[1];
        }
    }

    return blocks;
}

function runCommand(command) {
    try {
        execSync(command, { stdio: 'pipe' });
        return true;
    } catch (e) {
        return false;
    }
}

async function main() {
    console.log("🛠️  \x1b[35mSemantic Micro-Engineering Agent\x1b[0m");

    if (!fs.existsSync(RESPONSE_FILE)) {
        console.error(`❌ Missing ${RESPONSE_FILE}`);
        process.exit(1);
    }

    const rawText = fs.readFileSync(RESPONSE_FILE, 'utf-8');
    const filesToUpdate = parseSemanticResponse(rawText);

    if (filesToUpdate.length === 0) {
        console.log("⚠️  No files identified. Ensure the file path is directly above the code block.");
        process.exit(0);
    }

    console.log(`\n📦 Detected ${filesToUpdate.length} updates...`);

    // Git Safety Check
    if (fs.existsSync('.git')) {
        console.log("💾 Creating git checkpoint...");
        runCommand('git add .');
        runCommand('git commit -m "Pre-Semantic Update" --no-verify');
    }

    // Apply Files
    filesToUpdate.forEach(file => {
        try {
            const fullPath = path.resolve(process.cwd(), file.path);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, file.content);
            console.log(`   \x1b[32m[WRITE]\x1b[0m ${file.path}`);
        } catch (err) {
            console.error(`   \x1b[31m[ERROR]\x1b[0m Failed to write ${file.path}: ${err.message}`);
        }
    });

    rl.question('\nKeep changes? (y/n): ', (answer) => {
        if (answer.toLowerCase() !== 'y') {
            console.log("\x1b[31mReverting...\x1b[0m");
            runCommand('git reset --hard HEAD');
        } else {
            console.log("\x1b[32mSystem Updated.\x1b[0m");
        }
        rl.close();
    });
}

main();