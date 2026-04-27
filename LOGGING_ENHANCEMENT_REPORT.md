# Comprehensive Logging Enhancement Report

## Objective
Enable autonomous Playwright test agent to detect errors, timeouts, hangs, and stalls overnight. All logs are structured and accessible for programmatic analysis.

## Summary of Changes

### 1. **Engine.ts (src/services/engine.ts)** - Model API Call Logging
Added granular logging around the most critical hotspots:

#### Stream Generation (generateStreamedResult)
- **api_call_init**: Initial API call with model name, content lengths, user parts count
- **api_call_success**: Successful API connection established
- **stream_connected**: Stream connection established, ready for chunks
- **stream_chunk**: Every chunk received - index, text length, thought parts, finish reason, raw parts
- **stream_chunk_parse_error**: Any parse errors during chunk processing
- **stream_empty_result**: No response received from stream
- **stream_complete**: Stream completed successfully - total chunks and final length
- **stream_error**: Stream failed - error message, stack trace, chunk index

#### Fallback Generation (generateFallbackResult)
- **api_call_init**: Same as stream (method='generateContent')
- **api_call_success**: Fallback API succeeded
- **fallback_complete**: Non-streaming call completed
- **fallback_error**: Non-streaming call failed

#### Error Handling & Retries
- **error_caught**: Initial error catch - isManualRetry, isStreamTimeout, error message/name
- **error_classification**: Error analysis - isRetryable status, error details
- **retry_triggered**: Each retry attempt - type (manual, stream_fallback, transient_backoff), backoff seconds, status code
- **fatal_error_handled**: Non-recoverable error - total attempts, useStreaming mode

#### JSON Parsing
- **normalize_complete**: Normalized JSON text (200-char sample)
- **json_parse_error**: JSON parsing failure - error message, position, response length, first 500 chars

**Benefit**: Playwright can detect:
- Timeout patterns (stream_idle_abort, stream_total_abort)
- API rate limiting (429 errors, transient retries)
- Truncated responses (json_parse_error with position < expected)
- Hanging streams (track chunk arrival times)

---

### 2. **Server.ts (server.ts)** - Session & Turn Management Logging
Enhanced server-side event tracking for the autonomous agent.

#### Socket Connection Events
- **SOCKET CONNECT**: Client socket ID logged
- **SOCKET DISCONNECT**: Client disconnected with ID
- **join**: Session ID, mode (freeplay/editor), level ID, player name
- **disconnect**: Player left the session

#### Turn Resolution
- **turn_resolution_start**: Turn number, action count, timestamp
- **turn_resolution_success**: New turn number
- **turn_resolution_fatal_error**: Error message, error name
- **error_caught**: In resolveTurn - error type, message, useStreaming mode
- **error_classification**: isRetryable, error status
- **api_call_init/success**: Model API calls within turn
- **retry_triggered**: All retry types with attempt numbers

#### Image Generation
- **image_generation_start**: Visual ID, prompt length
- **image_generation_retry**: Attempt number, backoff seconds, status
- **image_generation_success**: Visual ID
- **image_generation_error**: Error message
- **level_complete**: Level completion with ID and turn number

#### Bot Actions
- **BOT TURN**: Bot starting turn with player name
- **BOT ACTION LOCKED**: Action text (first 50 chars)
- **BOT ERROR**: Error message during decision/action

#### Game Events
- **lockAction**: Action text locked (first 60 chars)
- **pickupItem**: Item name picked up
- **giveItem**: Item name transferred to target player
- **resetSession**: Session reset
- **cancelImageGeneration**: Image generation cancelled
- **forceRetryTurn**: Manual turn retry forced

**Benefit**: Playwright can:
- Track session lifecycle and player actions
- Correlate image failures with turn resolution failures
- Detect bot stalls (missing BOT TURN logs)
- Monitor retry patterns and backoff sequences

---

### 3. **Client-Side Logger (src/services/logger.ts)** - NEW
Created centralized logging service accessible to Playwright:

```typescript
// Browser-accessible via window.__logs
window.__logs.getAll()           // All logs (max 500 in buffer)
window.__logs.getByContext('UI') // Logs from specific context
window.__logs.getByLevel('error') // Logs by severity
window.__logs.getRecent(50)      // Last 50 logs
window.__logs.buffer             // Raw log buffer
```

All logs are structured:
```json
{
  "timestamp": 1234567890,
  "level": "error|warn|info|debug|fatal",
  "context": "GameEngine|Socket|UI|etc",
  "message": "Human-readable message",
  "data": { "key": "value" },
  "error": { "message": "...", "stack": "...", "name": "..." }
}
```

**Benefit**: Playwright can query logs programmatically without parsing console output.

---

### 4. **Console Logging Strategy**
Added critical events to console.log for Playwright's `page.on('console')`:

**In server.ts:**
- `[SESSION ${id}] STARTING TURN RESOLUTION`
- `[SESSION ${id}] TURN RESOLVED SUCCESSFULLY`
- `[SESSION ${id}] ${event}: ${data}` (for errors, retries, aborts)
- `[SOCKET]` connection/disconnect events
- `[BOT ${id}]` actions and errors
- All errors and warnings prefixed with context `[CONTEXT]`

**Format**: Consistent `[CONTEXT] message` pattern enables:
- Easy regex filtering
- Correlation with session/socket IDs
- Classification of log types

---

## Hotspots Covered

### Critical Paths
✅ Model API calls (streaming & fallback)  
✅ JSON parsing errors (position, length, samples)  
✅ Timeout handling (idle vs total)  
✅ Retry mechanisms (manual, transient, stream fallback)  
✅ Image generation (start, retry, success, error)  
✅ Turn resolution (start, success, error)  
✅ Bot decision-making and action execution  
✅ Socket events (connect, disconnect, actions)  
✅ Level completion  

### Access Patterns for Playwright
```typescript
// Query console logs
page.on('console', msg => {
  if (msg.text().includes('[ERROR]')) {
    // Handle error logs
  }
});

// Query structured logs
const logs = await page.evaluate(() => window.__logs.getByLevel('error'));
const recentLogs = await page.evaluate(() => window.__logs.getRecent(20));

// Detect specific patterns
const timeoutLogs = await page.evaluate(() => 
  window.__logs.buffer.filter(log => log.message.includes('timeout'))
);

// Get full error details
const errors = await page.evaluate(() => 
  window.__logs.buffer.filter(log => log.error)
);
```

---

## Implementation Notes

### Server-Side Logs (console.log)
- Automatically captured by Playwright's `page.on('console')`
- Prefixed with context: `[SESSION id]`, `[BOT id]`, `[SOCKET id]`
- Structured JSON data logged for complex events

### Client-Side Logs (window.__logs)
- Centralized in-memory buffer (max 500 entries, auto-rotating)
- Accessible via `page.evaluate(() => window.__logs.*)`
- Timestamp included for temporal analysis
- Error stack traces preserved

### Socket Events (io.emit)
- `serverLog` events emitted to client with `{ timestamp, event, data }`
- Client can display and store these logs
- Provides real-time feedback to frontend

---

## Debugging the Autonomous Agent

### Detect Hangs
```typescript
// Check for missing turn resolution progress
const logs = await page.evaluate(() => window.__logs.getByContext('Session'));
const hasComplete = logs.some(l => l.message.includes('TURN RESOLVED'));
if (!hasComplete) {
  // Timeout detected - check for stuck stream
}
```

### Detect Retries
```typescript
const retries = await page.evaluate(() => 
  window.__logs.buffer.filter(l => l.data?.type?.includes('retry'))
);
```

### Detect JSON Parse Errors
```typescript
const parseErrors = await page.evaluate(() => 
  window.__logs.buffer.filter(l => l.event === 'json_parse_error')
);
parseErrors.forEach(e => {
  console.log(`JSON error at position ${e.data.position}, response: ${e.data.responseSample}`);
});
```

---

## Files Modified

1. **src/services/engine.ts**
   - Added api_call_init/success logs around streaming/fallback
   - Enhanced error_caught with classification details
   - Added comprehensive retry logging
   - Enhanced JSON parse error logging with position/sample

2. **server.ts**
   - Enhanced logEvent function to also console.log critical events
   - Added socket connection/disconnection logs
   - Added turn resolution event logs
   - Added image generation lifecycle logs
   - Added bot action logs with context
   - Added inventory/game action logs

3. **src/services/logger.ts** (NEW)
   - Centralized logger service
   - Browser-accessible via window.__logs
   - Structured logging with timestamp, level, context, data, error
   - Auto-rotating buffer

---

## Next Steps for Playwright Agent

1. **Capture logs continuously** during test runs
2. **Analyze patterns**:
   - Timeout frequency and timing
   - Retry counts and backoff patterns
   - API error codes and messages
3. **Take snapshots** of game state when errors occur
4. **Auto-fix** based on log analysis:
   - Adjust timeout values
   - Retry logic improvements
   - Token budget adjustments
5. **Report findings** with log excerpts and timestamps

---

## Testing the Logging

```bash
# Start the server
npm run dev

# In Playwright:
page.on('console', msg => console.log('PAGE LOG:', msg.text()));

const allLogs = await page.evaluate(() => window.__logs.getAll());
console.log('Total logs:', allLogs.length);
console.log('Errors:', allLogs.filter(l => l.level === 'error'));
```

