import * as fs from 'fs';
import * as path from 'path';

/**
 * Centralized Conversation Logger
 * Single source of truth for all game inputs, outputs, and state changes
 * Hot-written file for real-time Playwright agent access
 * 
 * File location: ./conversation-logs/current-session.log
 * Format: Markdown with special delimiters for structure
 */

interface ConversationEntry {
  timestamp: number;
  type: 'conversation_start' | 'user_input' | 'model_thinking' | 'model_output' | 'error' | 'retry' | 'image_generation' | 'level_complete' | 'conversation_end';
  sessionId?: string;
  data: Record<string, any>;
}

const LOG_DIR = path.join(process.cwd(), 'conversation-logs');
const LOG_FILE = path.join(LOG_DIR, 'current-session.log');
const ARCHIVE_DIR = path.join(LOG_DIR, 'archive');

// Ensure directories exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
if (!fs.existsSync(ARCHIVE_DIR)) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

export const conversationLogger = {
  /**
   * Log conversation start
   */
  logConversationStart: (sessionId: string, levelId: string, players: string[]) => {
    const entry = `
${'='.repeat(80)}
🎮 CONVERSATION START
${'='.repeat(80)}
Session ID: ${sessionId}
Level: ${levelId}
Players: ${players.join(', ')}
Timestamp: ${new Date().toISOString()}
${'-'.repeat(80)}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log player action/input
   */
  logPlayerInput: (sessionId: string, playerId: string, playerName: string, action: string) => {
    const entry = `
[${new Date().toISOString()}] 👤 ${playerName} (${playerId.substring(0, 8)}):
${action}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log model thinking process
   */
  logModelThinking: (sessionId: string, thoughtLog: string[]) => {
    if (!thoughtLog || thoughtLog.length === 0) return;
    
    const entry = `
[${new Date().toISOString()}] 🧠 MODEL THINKING:
${thoughtLog.map((t, i) => `  [${i + 1}] ${t}`).join('\n')}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log model response/narrative
   */
  logModelOutput: (sessionId: string, narrative: string, npcDialogues: any[] = [], cinematicPrompt?: string) => {
    let entry = `
[${new Date().toISOString()}] 🤖 MODEL OUTPUT:
📖 Narrative:
${narrative}
`;

    if (npcDialogues && npcDialogues.length > 0) {
      entry += `

💬 NPC Dialogues:
${npcDialogues.map(npc => `  ${npc.emoji} ${npc.name}: "${npc.text}"`).join('\n')}
`;
    }

    if (cinematicPrompt) {
      entry += `

🎬 Cinematic Prompt:
${cinematicPrompt}
`;
    }

    entry += '\n';
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log error event
   */
  logError: (sessionId: string, errorMessage: string, errorDetails?: any) => {
    const entry = `
[${new Date().toISOString()}] ❌ ERROR:
Message: ${errorMessage}
${errorDetails ? `Details: ${JSON.stringify(errorDetails, null, 2)}` : ''}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log retry attempt
   */
  logRetry: (sessionId: string, attempt: number, type: string, backoffSeconds?: number) => {
    const entry = `
[${new Date().toISOString()}] 🔄 RETRY ATTEMPT #${attempt}
Type: ${type}
${backoffSeconds ? `Backoff: ${backoffSeconds}s` : 'Backoff: 1s'}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log image generation
   */
  logImageGeneration: (sessionId: string, status: 'start' | 'success' | 'error', details?: any) => {
    let symbol = status === 'start' ? '🎨' : status === 'success' ? '✅' : '❌';
    const entry = `
[${new Date().toISOString()}] ${symbol} IMAGE GENERATION ${status.toUpperCase()}
${details ? JSON.stringify(details, null, 2) : ''}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log turn resolution summary
   */
  logTurnResolution: (sessionId: string, turnNumber: number, actionCount: number, success: boolean, errorMessage?: string) => {
    const entry = `
[${new Date().toISOString()}] ${success ? '✅' : '❌'} TURN RESOLUTION
Turn: ${turnNumber}
Actions: ${actionCount}
${errorMessage ? `Error: ${errorMessage}` : 'Status: SUCCESS'}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log level completion
   */
  logLevelComplete: (sessionId: string, levelId: string, turnNumber: number) => {
    const entry = `
[${new Date().toISOString()}] 🏁 LEVEL COMPLETE
Level: ${levelId}
Turns Taken: ${turnNumber}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Log conversation end
   */
  logConversationEnd: (sessionId: string) => {
    const entry = `
${'='.repeat(80)}
🛑 CONVERSATION END
${'='.repeat(80)}
Timestamp: ${new Date().toISOString()}
Session ID: ${sessionId}
${'='.repeat(80)}

`;
    fs.appendFileSync(LOG_FILE, entry);
  },

  /**
   * Gracefully close current log and archive it
   */
  archiveCurrentLog: (reason: 'normal' | 'error' | 'shutdown' = 'normal') => {
    try {
      if (fs.existsSync(LOG_FILE)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveName = `session-${timestamp}-${reason}.log`;
        const archivePath = path.join(ARCHIVE_DIR, archiveName);
        
        fs.renameSync(LOG_FILE, archivePath);
        console.log(`[LOGGER] Archived log: ${archiveName}`);
        
        // Keep only last 50 archived logs
        const files = fs.readdirSync(ARCHIVE_DIR);
        if (files.length > 50) {
          const filesToDelete = files.sort().slice(0, files.length - 50);
          filesToDelete.forEach(f => {
            fs.unlinkSync(path.join(ARCHIVE_DIR, f));
          });
          console.log(`[LOGGER] Cleaned up old logs (kept last 50)`);
        }
      }
    } catch (e) {
      console.error('[LOGGER] Error archiving log:', e);
    }
  },

  /**
   * Get current log path (for Playwright access)
   */
  getLogPath: () => LOG_FILE,

  /**
   * Get archive directory path
   */
  getArchivePath: () => ARCHIVE_DIR,

  /**
   * Read current log file (for Playwright to fetch)
   */
  readCurrentLog: () => {
    try {
      return fs.readFileSync(LOG_FILE, 'utf-8');
    } catch (e) {
      return '';
    }
  }
};

// Setup graceful shutdown
const cleanup = (reason: 'normal' | 'error' | 'shutdown') => {
  console.log(`[LOGGER] Cleanup triggered: ${reason}`);
  conversationLogger.archiveCurrentLog(reason);
};

process.on('SIGINT', () => cleanup('shutdown'));
process.on('SIGTERM', () => cleanup('shutdown'));
process.on('exit', () => cleanup('shutdown'));

// Catch uncaught exceptions and log them
process.on('uncaughtException', (error) => {
  conversationLogger.logError('system', 'Uncaught Exception', { message: error.message, stack: error.stack });
  cleanup('error');
});
