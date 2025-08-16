# Claude Code Templates - Patched Version with Configurable Port

This is a patched version of Claude Code Templates that adds support for configurable ports, resolving the "address in use" error when port 3333 is already occupied.

## What's Changed

✅ **Added configurable port support** - The analytics dashboard can now run on custom ports  
✅ **Multiple configuration methods** - Support for command-line options, environment variables, and defaults  
✅ **Backward compatibility** - Still defaults to port 3333 if no custom port is specified  

## Installation

### Method 1: From Source (Recommended)

1. **Clone and install the patched version:**
```bash
cd /Users/lennox/development/utilities/Claude-Code-Templates/claude-code-templates-patched/cli-tool
npm install --legacy-peer-deps
npm install -g .
```

2. **Verify installation:**
```bash
create-claude-config --help
```
You should see the new `--port` option listed in the help output.

### Method 2: Manual Build

If you need to customize further:

1. **Clone the original repository:**
```bash
git clone https://github.com/davila7/claude-code-templates.git
cd claude-code-templates/cli-tool
```

2. **Apply the patches manually** (copy the changes from this patched version)

3. **Install dependencies and link globally:**
```bash
npm install --legacy-peer-deps
npm install -g .
```

## Usage

The patched version supports three ways to specify a custom port:

### Option 1: Command Line Flag (Recommended)
```bash
# Start analytics dashboard on port 3334
create-claude-config --analytics --port 3334

# Start agents dashboard on port 4000
create-claude-config --agents --port 4000

# Use with other options
create-claude-config --analytics --port 3334 --verbose
```

### Option 2: Environment Variable
```bash
# Set environment variable
export CLAUDE_CODE_TEMPLATES_PORT=3334

# Run without --port flag
create-claude-config --analytics

# Or use standard PORT variable
export PORT=4000
create-claude-config --analytics
```

### Option 3: In Scripts
Create a wrapper script for convenience:

```bash
#!/bin/bash
# save as claude-analytics-alt.sh
create-claude-config --analytics --port 3334 "$@"
```

Make it executable:
```bash
chmod +x claude-analytics-alt.sh
./claude-analytics-alt.sh
```

## Examples

### Basic Usage
```bash
# Start on custom port to avoid conflicts
create-claude-config --analytics --port 3334
```

### Multiple Instances
Run multiple instances on different ports:
```bash
# Terminal 1 - Analytics on port 3334
create-claude-config --analytics --port 3334

# Terminal 2 - Agents dashboard on port 3335  
create-claude-config --agents --port 3335
```

### With Cloudflare Tunnel
```bash
# Use custom port with secure tunnel
create-claude-config --analytics --port 3334 --tunnel
```

## Port Priority Order

The patched version checks for ports in this order:
1. `--port` command line option (highest priority)
2. `CLAUDE_CODE_TEMPLATES_PORT` environment variable
3. `PORT` environment variable  
4. Default port 3333 (lowest priority)

## Common Use Cases

### Scenario 1: Port 3333 Already in Use
```bash
# Error: listen EADDRINUSE: address already in use :::3333
# Solution: Use a different port
create-claude-config --analytics --port 3334
```

### Scenario 2: Running Multiple Projects
```bash
# Project A
cd /path/to/project-a
CLAUDE_CODE_TEMPLATES_PORT=3334 create-claude-config --analytics

# Project B  
cd /path/to/project-b
CLAUDE_CODE_TEMPLATES_PORT=3335 create-claude-config --analytics
```

### Scenario 3: Corporate Firewalls
```bash
# Use a port that's allowed through corporate firewall
create-claude-config --analytics --port 8080
```

## Troubleshooting

### Port Still in Use?
If your chosen port is also in use:
```bash
# Check what's using the port
lsof -i :3334

# Try a different port
create-claude-config --analytics --port 3335
```

### Find Available Ports
```bash
# Find available ports in range
for port in {3334..3340}; do
  if ! lsof -i :$port > /dev/null 2>&1; then
    echo "Port $port is available"
  fi
done
```

### Reset to Original Version
If you want to go back to the original version:
```bash
npm uninstall -g claude-code-templates
npm install -g claude-code-templates@latest
```

## Advanced Configuration

### Persistent Configuration
Add to your shell profile (`~/.zshrc`, `~/.bashrc`):
```bash
# Set default port for Claude Code Templates
export CLAUDE_CODE_TEMPLATES_PORT=3334
```

### Docker Usage
If running in Docker:
```bash
# Map container port to host port
docker run -p 3334:3334 -e CLAUDE_CODE_TEMPLATES_PORT=3334 your-image
```

## Changes Made to Original

The following files were modified in this patched version:

1. **`src/analytics.js`** - Line 29: Added configurable port support
   ```javascript
   // Before:
   this.port = 3333;
   
   // After:
   this.port = parseInt(options.port || process.env.CLAUDE_CODE_TEMPLATES_PORT || process.env.PORT || '3333', 10);
   ```

2. **`bin/create-claude-config.js`** - Line 68: Added `--port` command line option
   ```javascript
   .option('-p, --port <port>', 'specify port for analytics dashboard (default: 3333)')
   ```

## Support

This patched version maintains full compatibility with all original features. The only addition is configurable port support.

**Original repository:** https://github.com/davila7/claude-code-templates  
**Original documentation:** https://docs.aitmpl.com

For issues specific to the port configuration, please check:
1. Port availability: `lsof -i :PORT_NUMBER`
2. Environment variables: `echo $CLAUDE_CODE_TEMPLATES_PORT`
3. Command syntax: `create-claude-config --help`

---

**Successfully tested:** ✅ Analytics dashboard starts on custom port 3334  
**Backward compatible:** ✅ Original functionality preserved  
**Ready to use:** ✅ No address conflicts on port 3333
