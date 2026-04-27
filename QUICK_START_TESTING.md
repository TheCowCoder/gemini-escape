# 🚀 Quick Start: Testing the Logging System

## 1. Start the Server

```bash
npm run dev
```

Expected output:
```
VITE v... running at:
  ➜  Local:   http://localhost:5173/
  ➜  Network: use `--host` to access from network
  📝 Server running on port 3000
  [SESSION] Initializing session management...
```

## 2. Monitor the Log File (Terminal 2)

```bash
tail -f ./conversation-logs/current-session.log
```

You should see:
```
================================================================================
🎮 CONVERSATION START
================================================================================
Session ID: ...
Level: freeplay-forest
Timestamp: 2026-04-26T12:34:56.789Z
```

## 3. Join a Game Session (Browser)

1. Open http://localhost:5173
2. Click "Join Game"
3. Select a level or "Freeplay"
4. Wait for starter image/text to load

In terminal 2, you'll see:
```
[2026-04-26T12:35:01.234Z] 🎨 IMAGE GENERATION start
promptLength: 1250
```

## 4. Perform Player Actions

1. Type an action in the chat box (e.g., "I approach the tree")
2. Click "Lock In Action" or press Enter
3. Wait for model response

Watch terminal 2 for:
```
[2026-04-26T12:35:01.234Z] 👤 Player (ID):
I approach the tree

[2026-04-26T12:35:02.456Z] 🧠 MODEL THINKING:
  [1] Player approaching tree...
  [2] Check inventory state...

[2026-04-26T12:35:03.789Z] 🤖 MODEL OUTPUT:
📖 Narrative:
The tree's bark glows as you approach...

💬 NPC Dialogues:
🌳 Tree Spirit: "Welcome, seeker..."

🎬 Cinematic Prompt:
[CAMERA]: First-person POV...
```

## 5. Check Browser Logs

Open Developer Tools (F12) and run in console:

```javascript
// View all logs
window.__logs.getAll()

// View just errors
window.__logs.getByLevel('error')

// View by context
window.__logs.getByContext('api_call')

// View recent 5 entries
window.__logs.getRecent(5)

// Clear logs
window.__logs.clearLogs()

// View full buffer
window.__logs
```

Expected output:
```javascript
[
  {
    context: "api_call_init",
    level: "info",
    message: "Turn resolution started: T=1",
    timestamp: 1234567890123,
    data: { turnNumber: 1, playerCount: 2 }
  },
  {
    context: "stream_chunk",
    level: "debug",
    message: "Received chunk [45-67]",
    timestamp: 1234567890450,
    data: { index: 45, length: 22 }
  },
  ...
]
```

## 6. Trigger an Error (Optional)

To test error logging, you can intentionally cause an error:

1. Open browser Developer Tools (F12)
2. Run: `window.__gameSession.gameState.players = null` (destroys game state)
3. Trigger a turn resolution
4. Watch for error logs

Terminal 2 will show:
```
[2026-04-26T12:36:00.123Z] ❌ ERROR:
Message: Cannot read properties of null
Details: GameState validation failed
```

## 7. Complete a Level (Optional)

1. Work through the level's goal
2. Once goal is met, you'll see:

```
[2026-04-26T12:37:15.456Z] 🏁 LEVEL COMPLETE
Level: freeplay-forest
Turns Taken: 5
```

## 8. Close the Session

1. Press Ctrl+C in the server terminal
2. Watch for graceful shutdown:

```
[SERVER] Received shutdown signal, archiving logs...
[2026-04-26T12:37:16.789Z] 🛑 CONVERSATION END
Timestamp: 2026-04-26T12:37:16.789Z
Session ID: ...

Archived to: ./conversation-logs/archive/session-2026-04-26T12-37-16Z-shutdown.log
```

3. Check that archive was created:

```bash
ls -la ./conversation-logs/archive/
# Should show: session-2026-04-26T...log
```

## 9. Inspect Archive

```bash
cat ./conversation-logs/archive/session-2026-04-26T*.log | head -50
```

Shows complete conversation history in readable format.

---

## Troubleshooting

### No conversation-logs directory created
**Fix**: Server creates it automatically on first run. If missing:
```bash
mkdir -p ./conversation-logs/archive
```

### Logs not being written
**Check**:
1. Is `npm run dev` running? (look for "Server running on port 3000")
2. Is conversationLogger.ts file present? (`ls src/services/conversationLogger.ts`)
3. Check server console for errors: `[ERROR] Failed to write log...`

### window.__logs undefined
**Check**:
1. Did page fully load? (Check Network tab for all resources)
2. Open console and check for JS errors
3. Reload page and try again: `window.__logs.getAll()`

### Can't tail the log file
**Try**:
```bash
# Instead of tail -f (which may not work on all systems)
watch cat ./conversation-logs/current-session.log
# Or
less +F ./conversation-logs/current-session.log
# Or use VS Code to open and watch the file
```

---

## Expected Behavior

### During Normal Gameplay
- New log entries appear every 1-5 seconds
- Player actions logged within 100ms
- Model thinking logged within 1-2 seconds of API call
- Model output logged within 5-10 seconds of thinking
- Image generation starts after model output
- Turn resolution completes within 30 seconds total

### Log File Growth
- ~500-1000 bytes per turn
- 1 hour of gameplay ≈ 5-10 MB
- Archive automatically keeps last 50 sessions

### Browser Logs (window.__logs)
- Entries rotated when buffer hits 500 items
- Queryable by context, level, timestamp
- Useful for detecting patterns in current session

---

## Next: Playwright Integration

Once you've verified logs are working:

1. **Save** current logs for reference:
   ```bash
   cp ./conversation-logs/current-session.log sample-session.log
   ```

2. **Read** the guide:
   - [CONVERSATION_LOGGER_GUIDE.md](./CONVERSATION_LOGGER_GUIDE.md) for parsing patterns
   - [LOGGING_ARCHITECTURE.md](./LOGGING_ARCHITECTURE.md) for architecture overview

3. **Implement** Playwright agent to:
   - Monitor log file with fs.watch()
   - Parse emoji markers for event types
   - Detect errors and hangs
   - Take screenshots on failures
   - Log findings for automated testing

---

## Support Files

- **LOGGING_IMPLEMENTATION_SUMMARY.md** - What was delivered
- **LOGGING_CHECKLIST.md** - Verification checklist
- **LOGGING_ARCHITECTURE.md** - Architecture diagrams
- **LOGGING_ENHANCEMENT_REPORT.md** - Technical details
- **CONVERSATION_LOGGER_GUIDE.md** - Playwright usage patterns

---

**Status**: 🟢 Ready to test  
**Estimated Test Time**: 10-15 minutes  
**Questions?** Check the relevant guide file above
