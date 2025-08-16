const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');

class ClaudeAPIProxy {
  constructor(options = {}) {
    this.app = express();
    // Support configurable port via options, environment variable, or default to 3335
    this.port = parseInt(options.port || process.env.CLAUDE_CODE_TEMPLATES_API_PROXY_PORT || process.env.API_PROXY_PORT || '3335', 10);
    this.claudeDir = path.join(os.homedir(), '.claude');
    
    // Store active sessions and conversation contexts
    this.activeSessions = new Map();
    this.conversationContexts = new Map();
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }
  
  setupRoutes() {
    // Status/Info page
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Claude API Proxy',
        status: 'running',
        port: this.port,
        version: '1.0.0',
        description: 'Proxy service for bidirectional communication with Claude Code',
        endpoints: {
          '/': 'This status page',
          '/api/sessions': 'Get active Claude Code sessions',
          '/api/send-message': 'Send message to Claude Code (POST)',
          '/api/conversation/:sessionId': 'Get conversation history'
        },
        timestamp: new Date().toISOString()
      });
    });

    // Get active conversations/sessions
    this.app.get('/api/sessions', async (req, res) => {
      try {
        const sessions = await this.getActiveSessions();
        res.json({ sessions });
      } catch (error) {
        console.error('Error getting sessions:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Send message to Claude (main endpoint)
    this.app.post('/api/send-message', async (req, res) => {
      try {
        const { sessionId, message, projectPath } = req.body;
        
        if (!sessionId || !message) {
          return res.status(400).json({ error: 'sessionId and message are required' });
        }
        
        const result = await this.sendMessageToClaude(sessionId, message, projectPath);
        res.json(result);
        
      } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get conversation history
    this.app.get('/api/conversation/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const conversation = await this.getConversationHistory(sessionId);
        res.json({ conversation });
      } catch (error) {
        console.error('Error getting conversation:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }
  
  async getActiveSessions() {
    const projectsDir = path.join(this.claudeDir, 'projects');
    
    if (!(await fs.pathExists(projectsDir))) {
      return [];
    }
    
    const sessions = [];
    const projectDirs = await fs.readdir(projectsDir);
    
    for (const projectDir of projectDirs) {
      const projectPath = path.join(projectsDir, projectDir);
      const files = await fs.readdir(projectPath);
      
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const sessionId = path.basename(file, '.jsonl');
          const filePath = path.join(projectPath, file);
          const stats = await fs.stat(filePath);
          
          // Get basic info about the session
          const lastMessage = await this.getLastMessage(filePath);
          
          sessions.push({
            sessionId,
            projectPath: this.decodeProjectPath(projectDir),
            filePath,
            lastModified: stats.mtime,
            lastMessage: lastMessage?.content || 'No messages',
            messageCount: await this.getMessageCount(filePath)
          });
        }
      }
    }
    
    // Sort by most recent activity
    return sessions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  }
  
  decodeProjectPath(encodedPath) {
    return encodedPath.replace(/-/g, '/').replace(/^Users/, '/Users');
  }
  
  async getLastMessage(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return null;
      
      const lastLine = lines[lines.length - 1];
      const lastMessage = JSON.parse(lastLine);
      
      return {
        content: this.extractMessageContent(lastMessage),
        timestamp: lastMessage.timestamp,
        role: lastMessage.message?.role || lastMessage.type
      };
    } catch (error) {
      console.error('Error reading last message:', error);
      return null;
    }
  }
  
  async getMessageCount(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      return lines.length;
    } catch (error) {
      return 0;
    }
  }
  
  extractMessageContent(messageObj) {
    if (messageObj.message?.content) {
      if (typeof messageObj.message.content === 'string') {
        return messageObj.message.content;
      }
      if (Array.isArray(messageObj.message.content)) {
        const textContent = messageObj.message.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join(' ');
        return textContent || '[Tool use or other content]';
      }
    }
    return '[No content]';
  }
  
  async sendMessageToClaude(sessionId, messageContent, projectPath) {
    console.log(chalk.blue(`📤 Sending message to session ${sessionId}`));
    
    // Find the conversation file
    const conversationFile = await this.findConversationFile(sessionId, projectPath);
    
    if (!conversationFile) {
      throw new Error(`Conversation file not found for session ${sessionId}`);
    }
    
    // Get conversation context
    const context = await this.getConversationContext(conversationFile);
    
    // Create user message in Claude Code format
    const userMessage = this.createUserMessage(messageContent, context, sessionId);
    
    // Append to JSONL file
    await this.appendToConversation(conversationFile, userMessage);
    
    console.log(chalk.green(`✅ Message sent to ${conversationFile}`));
    
    // Try to notify Claude Code process about the file change and inject the message
    await this.notifyClaudeProcess(messageContent);
    
    // TODO: Monitor for Claude Code response
    
    return {
      success: true,
      messageId: userMessage.uuid,
      sessionId,
      message: 'Message sent to Claude Code conversation'
    };
  }
  
  async findConversationFile(sessionId, projectPath) {
    const projectsDir = path.join(this.claudeDir, 'projects');
    
    // If projectPath provided, look there first
    if (projectPath) {
      const encodedPath = this.encodeProjectPath(projectPath);
      const targetDir = path.join(projectsDir, encodedPath);
      const conversationFile = path.join(targetDir, `${sessionId}.jsonl`);
      
      if (await fs.pathExists(conversationFile)) {
        return conversationFile;
      }
    }
    
    // Otherwise, search all projects
    const projectDirs = await fs.readdir(projectsDir);
    
    for (const projectDir of projectDirs) {
      const conversationFile = path.join(projectsDir, projectDir, `${sessionId}.jsonl`);
      
      if (await fs.pathExists(conversationFile)) {
        return conversationFile;
      }
    }
    
    return null;
  }
  
  encodeProjectPath(projectPath) {
    return projectPath.replace(/\//g, '-').replace(/^-/, '');
  }
  
  async getConversationContext(conversationFile) {
    try {
      const content = await fs.readFile(conversationFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return { lastMessage: null, cwd: process.cwd(), version: '1.0.44' };
      }
      
      // Find the last valid JSON line (iterate backwards)
      let lastMessage = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        try {
          lastMessage = JSON.parse(line);
          break; // Found valid JSON, break out of loop
        } catch (jsonError) {
          // Skip invalid JSON lines
          console.warn(`Skipping invalid JSON line ${i + 1}: ${line.substring(0, 50)}...`);
          continue;
        }
      }
      
      if (!lastMessage) {
        console.warn('No valid JSON message found in conversation file');
        return { lastMessage: null, cwd: process.cwd(), version: '1.0.44' };
      }
      
      return {
        lastMessage,
        cwd: lastMessage.cwd || process.cwd(),
        version: lastMessage.version || '1.0.44',
        sessionId: lastMessage.sessionId
      };
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return { lastMessage: null, cwd: process.cwd(), version: '1.0.44' };
    }
  }
  
  createUserMessage(content, context, sessionId) {
    const uuid = uuidv4();
    const timestamp = new Date().toISOString();
    
    return {
      parentUuid: context.lastMessage?.uuid || null,
      isSidechain: false,
      userType: "external",
      cwd: context.cwd,
      sessionId: sessionId,
      version: context.version,
      type: "user",
      message: {
        role: "user",
        content: content
      },
      uuid: uuid,
      timestamp: timestamp
    };
  }
  
  async appendToConversation(conversationFile, messageObj) {
    const messageJson = JSON.stringify(messageObj);
    await fs.appendFile(conversationFile, messageJson + '\n');
    
    // Force file system change notification by touching the file
    const now = new Date();
    await fs.utimes(conversationFile, now, now);
    
    console.log(chalk.green(`📝 Message appended to ${path.basename(conversationFile)}`));
  }
  
  async getConversationHistory(sessionId) {
    const conversationFile = await this.findConversationFile(sessionId);
    
    if (!conversationFile) {
      throw new Error(`Conversation not found for session ${sessionId}`);
    }
    
    const content = await fs.readFile(conversationFile, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const messages = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(msg => msg !== null);
    
    return messages;
  }
  
  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(chalk.green(`🌉 Claude API Proxy running on http://localhost:${this.port}`));
        console.log(chalk.blue(`📡 Ready to intercept and send messages to Claude Code`));
        resolve();
      });
    });
  }
  
  stop() {
    if (this.server) {
      this.server.close();
      console.log(chalk.yellow(`🔌 Claude API Proxy stopped`));
    }
  }
}

module.exports = ClaudeAPIProxy;

// Simplified message injection for Claude Code
ClaudeAPIProxy.prototype.notifyClaudeProcess = async function(messageText = '') {
  try {
    console.log(chalk.blue(`🎯 Injecting "${messageText}" into Claude Code...`));
    
    // Only try Warp AppleScript injection - simple and focused
    if (process.platform === 'darwin' && messageText) {
      this.tryAppleScriptNotification(messageText);
    } else {
      console.log(chalk.yellow('⚠️ Message injection only supported on macOS with Warp terminal'));
    }
    
  } catch (error) {
    console.log(chalk.red(`❌ Injection failed: ${error.message}`));
  }
};

// Terminal.app-only message injection (reliable AppleScript support)
ClaudeAPIProxy.prototype.tryAppleScriptNotification = function(messageText = '') {
  try {
    const { exec } = require('child_process');
    
    console.log(chalk.blue(`🎯 Targeting Terminal.app for message: "${messageText}"`));
    
    // First, get the Claude process TTY
    exec('ps -o tty -p $(pgrep -x claude) | tail -1', (error, stdout) => {
      if (error) {
        console.log(chalk.red(`❌ Could not find Claude process TTY: ${error.message}`));
        return;
      }
      
      const claudeTTY = `/dev/${stdout.trim()}`;
      console.log(chalk.blue(`🔍 Found Claude running on TTY: ${claudeTTY}`));
      
      // Now use the actual TTY in AppleScript
      const appleScript = `
        set messageText to "${messageText.replace(/"/g, '\\"')}"
        set success to false
        
        tell application "Terminal"
          set claudeFound to false
          repeat with w in windows
            repeat with t in tabs of w
              try
                set tabTTY to (tty of t)
                if (tabTTY is "${claudeTTY}") then
                set claudeFound to true
                set selected tab of w to t
                set frontmost of w to true
                activate
                delay 0.5
                do script messageText & return in t
                set success to true
                exit repeat
              end if
            end try
          end repeat
          if claudeFound then exit repeat
        end repeat
      end tell
      
      return success
    `;
    
      exec(`osascript -e '${appleScript.replace(/'/g, "\\'")}'`, (error, stdout) => {
        if (error) {
          console.log(chalk.red(`❌ Terminal.app injection failed: ${error.message}`));
          console.log(chalk.yellow('💡 Make sure Claude Code is running in Terminal.app and has Accessibility permissions'));
        } else {
          const success = stdout.trim() === 'true';
          if (success) {
            console.log(chalk.green(`✅ Successfully sent "${messageText}" to Claude Code in Terminal.app`));
          } else {
            console.log(chalk.yellow(`⚠️ Could not find Claude Code session in Terminal.app TTY: ${claudeTTY}`));
            console.log(chalk.blue('💡 Ensure Claude Code is running in Terminal.app'));
          }
        }
      });
    });
    
  } catch (error) {
    console.log(chalk.red(`❌ AppleScript error: ${error.message}`));
  }
};


// If run directly
if (require.main === module) {
  const proxy = new ClaudeAPIProxy();
  proxy.start();
  
  process.on('SIGINT', () => {
    proxy.stop();
    process.exit(0);
  });
}