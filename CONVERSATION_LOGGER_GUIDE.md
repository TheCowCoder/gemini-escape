# Conversation Logger - Complete Guide

## Overview
The Conversation Logger provides a **single source of truth** for all game inputs, outputs, and events. It hot-writes to a markdown-formatted log file that Playwright agents can access in real-time.

## File Location
```
./conversation-logs/current-session.log
```

## Log Format

### Structure
The log file uses markdown with clear delimiters for easy parsing:

```
================================================================================
🎮 CONVERSATION START
================================================================================
Session ID: abc123...
Level: freeplay-forest
Players: Player One, Player Two
Timestamp: 2026-04-26T12:34:56.789Z
--------------------------------------------------------------------------------

[2026-04-26T12:35:01.234Z] 👤 Player One (abc123de):
I walk toward the mysterious tree.

[2026-04-26T12:35:02.456Z] 🧠 MODEL THINKING:
  [1] The player approaches the ancient tree. I should describe...
  [2] Check inventory state: has axe, rope, lantern
  [3] Environmental response: tree reacts to presence

[2026-04-26T12:35:03.789Z] 🤖 MODEL OUTPUT:
📖 Narrative:
The tree's bark **pulses with soft blue light** as you draw near...

💬 NPC Dialogues:
🌳 Ancient Tree Spirit: "Ah, another seeker arrives at last..."

🎬 Cinematic Prompt:
[CAMERA]: First-person POV, eye-level perspective...

[2026-04-26T12:35:04.012Z] ✅ TURN RESOLUTION
Turn: 1
Actions: 1
Status: SUCCESS

[2026-04-26T12:35:04.500Z] 🎨 IMAGE GENERATION success
thoughtLength: 1234
imageUrl: /images/turn-1-scene.png

[2026-04-26T12:36:00.123Z] 👤 Player Two (def456gh):
I use the rope to climb the tree.

================================================================================
🛑 CONVERSATION END
================================================================================
Timestamp: 2026-04-26T12:37:15.456Z
Session ID: abc123...
================================================================================
```

## Event Types

### 🎮 CONVERSATION START
**When**: New session created  
**Logged data**:
- Session ID
- Level name
- List of players

```markdown
🎮 CONVERSATION START
Session ID: session-abc123
Level: the-chasm
Players: Alice, Bob
```

### 👤 PLAYER INPUT
**When**: Player locks in an action  
**Format**:
```
[TIMESTAMP] 👤 PLAYER_NAME (PLAYER_ID):
ACTION_TEXT
```

### 🧠 MODEL THINKING
**When**: Model generates internal reasoning  
**Format**:
```
[TIMESTAMP] 🧠 MODEL THINKING:
  [1] First thought
  [2] Second thought
  [3] Third thought
```

### 🤖 MODEL OUTPUT
**When**: Model returns narrative and metadata  
**Format**:
```
[TIMESTAMP] 🤖 MODEL OUTPUT:
📖 Narrative:
[narrative text with markdown formatting]

💬 NPC Dialogues:
🧑 NPC Name: "dialogue text"

🎬 Cinematic Prompt:
[detailed image generation prompt]
```

### 🔄 RETRY ATTEMPT
**When**: Turn or image generation retries  
**Format**:
```
[TIMESTAMP] 🔄 RETRY ATTEMPT #2
Type: transient_backoff
Backoff: 5s
```

### ✅ TURN RESOLUTION
**When**: Turn completes (success or failure)  
**Format**:
```
[TIMESTAMP] ✅ TURN RESOLUTION
Turn: 5
Actions: 2
Status: SUCCESS
```

**Or on error:**
```
[TIMESTAMP] ❌ TURN RESOLUTION
Turn: 5
Actions: 2
Error: Model returned invalid JSON
```

### 🎨 IMAGE GENERATION
**When**: Scene image generated  
**Format**:
```
[TIMESTAMP] 🎨 IMAGE GENERATION start
promptLength: 1250

[TIMESTAMP] ✅ IMAGE GENERATION success
thoughtLength: 456
imageUrl: /images/turn-5-scene.png

[TIMESTAMP] ❌ IMAGE GENERATION error
error: Rate limit exceeded - retry in 30s
```

### ❌ ERROR
**When**: Any error occurs  
**Format**:
```
[TIMESTAMP] ❌ ERROR:
Message: JSON parsing failed
Details: {...}
```

### 🏁 LEVEL COMPLETE
**When**: Level goal achieved  
**Format**:
```
[TIMESTAMP] 🏁 LEVEL COMPLETE
Level: the-chasm
Turns Taken: 12
```

### 🛑 CONVERSATION END
**When**: Session closes  
**Format**:
```
🛑 CONVERSATION END
Timestamp: 2026-04-26T12:45:30.123Z
Session ID: session-abc123
```

## Playwright Agent Access

### Reading the Log File
```typescript
import * as fs from 'fs';

const logPath = './conversation-logs/current-session.log';
const content = fs.readFileSync(logPath, 'utf-8');
```

### Parsing Events
```typescript
// Get all player inputs
const playerInputs = content.match(/\[.*?\] 👤 .+?\n(.*?)(?=\n\[|$)/gs);

// Get all errors
const errors = content.match(/\[.*?\] ❌ .+?\n(.*?)(?=\n\[|$)/gs);

// Get thinking logs
const thoughts = content.match(/\[.*?\] 🧠 MODEL THINKING:(.+?)(?=\n\[|$)/gs);

// Get retry attempts
const retries = content.match(/🔄 RETRY ATTEMPT/g)?.length || 0;
```

### Detecting Problems
```typescript
// Check for stuck streams (no MODEL OUTPUT after thinking)
const hasThinking = content.includes('🧠 MODEL THINKING');
const hasOutput = content.includes('🤖 MODEL OUTPUT');
if (hasThinking && !hasOutput) {
  console.log('Hang detected: model thinking but no output');
}

// Check for excessive retries
const retryCount = (content.match(/🔄 RETRY/g) || []).length;
if (retryCount > 5) {
  console.log(`Excessive retries: ${retryCount}`);
}

// Check for JSON parse errors
const parseErrors = content.match(/json_parse_error/g)?.length || 0;
if (parseErrors > 0) {
  console.log(`JSON parse errors: ${parseErrors}`);
}
```

## Archive Management

### Current Log
Active log is saved to:
```
./conversation-logs/current-session.log
```

### Archived Logs
When a session ends, the log is moved to:
```
./conversation-logs/archive/session-YYYY-MM-DDTHH-MM-SS-XXXZ-{reason}.log
```

Reasons:
- `normal`: Session ended normally
- `error`: Session ended with fatal error
- `shutdown`: Server shutdown while session active

### Cleanup
- **Automatic**: Keeps only last 50 archived logs
- **Manual**: Call `conversationLogger.archiveCurrentLog()`
- **On Exit**: Graceful shutdown archives current log

## Implementation Notes

### Hot Writing
- File is appended to immediately (no buffering)
- Playwright can read while game runs
- Timestamp precision: milliseconds

### Performance
- Minimal overhead (single append per event)
- No parsing/processing of logs in game code
- All heavy lifting deferred to agent

### Structured Data
- Markdown format for human readability
- Consistent timestamp format (ISO 8601)
- Emoji prefixes for quick visual scanning
- Preserves full response text (narrative, prompts, etc.)

## Usage Example for Playwright

```typescript
// Monitor for errors in real-time
const watchLogs = async (page: Page) => {
  let lastPosition = 0;
  
  setInterval(async () => {
    const logContent = fs.readFileSync('./conversation-logs/current-session.log', 'utf-8');
    const newContent = logContent.substring(lastPosition);
    lastPosition = logContent.length;
    
    if (newContent.includes('❌ ERROR')) {
      console.log('ERROR DETECTED:', newContent);
      // Take screenshot, pause game, prepare for recovery
      await page.screenshot({ path: 'error-screenshot.png' });
    }
    
    if ((newContent.match(/🔄 RETRY/g) || []).length > 3) {
      console.log('EXCESSIVE RETRIES DETECTED');
      // Check game state, consider different approach
    }
  }, 1000);
};

// Get specific turn output
const getTurnOutput = (turn: number) => {
  const content = fs.readFileSync('./conversation-logs/current-session.log', 'utf-8');
  const pattern = new RegExp(
    `Turn: ${turn}\\n[^]*?(?=\\[|🏁|🛑|$)`,
    'i'
  );
  return content.match(pattern)?.[0] || null;
};
```

