# Installation Guide

Comprehensive installation instructions for the Vikings OSM Backend API.

## System Requirements

### Minimum Requirements
- **Node.js**: 16.0.0 or higher
- **npm**: 7.0.0 or higher (comes with Node.js)
- **Memory**: 512MB RAM minimum
- **Storage**: 100MB free space

### Recommended Requirements
- **Node.js**: 18.0.0 or higher (LTS)
- **npm**: 8.0.0 or higher
- **Memory**: 1GB RAM
- **Storage**: 500MB free space

## Installation Methods

### Method 1: Git Clone (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd vikings-osm-backend

# Install dependencies
npm install

# Verify installation
npm test
```

### Method 2: Download ZIP

1. Download the repository as a ZIP file
2. Extract to your desired directory
3. Open terminal in the extracted folder
4. Run `npm install`

## Dependency Installation

### Production Dependencies

```bash
# Install only production dependencies
npm install --omit=dev
```

**Core Dependencies:**
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management
- `@sentry/node` - Error monitoring
- `cookie-parser` - Cookie parsing middleware
- `swagger-jsdoc` - API documentation generation
- `swagger-ui-express` - Interactive API documentation

### Development Dependencies

```bash
# Install all dependencies (including dev)
npm install
```

**Development Dependencies:**
- `jest` - Testing framework
- `supertest` - HTTP testing
- `eslint` - Code linting
- `nodemon` - Development auto-restart
- `@sentry/cli` - Sentry CLI tools

## Verification Steps

### 1. Check Node.js Version

```bash
node --version
# Should output v16.0.0 or higher
```

### 2. Check npm Version

```bash
npm --version
# Should output 7.0.0 or higher
```

### 3. Verify Dependencies

```bash
npm list --depth=0
# Should show all dependencies without errors
```

### 4. Run Tests

```bash
npm test
# All tests should pass
```

### 5. Start Server

```bash
npm run dev
# Server should start without errors
```

## Platform-Specific Instructions

### Windows

```cmd
# Use Command Prompt or PowerShell
git clone <your-repo-url>
cd vikings-osm-backend
npm install
```

**Common Windows Issues:**
- **Long Path Names**: Enable long path support in Windows
- **Permissions**: Run as Administrator if needed
- **Line Endings**: Git should handle this automatically

### macOS

```bash
# Install Node.js via Homebrew (recommended)
brew install node

# Clone and install
git clone <your-repo-url>
cd vikings-osm-backend
npm install
```

### Linux (Ubuntu/Debian)

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and install
git clone <your-repo-url>
cd vikings-osm-backend
npm install
```

### Docker (Optional)

```dockerfile
# Dockerfile example
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t vikings-osm-backend .
docker run -p 3000:3000 --env-file .env vikings-osm-backend
```

## Post-Installation Setup

### 1. Environment Configuration

Create your `.env` file:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. OAuth Credentials

Obtain OSM API credentials:
1. Contact OSM support for API access
2. Register your application
3. Add credentials to `.env` file

### 3. Optional: Sentry Setup

For error monitoring:
1. Create a Sentry account
2. Create a new project
3. Add `SENTRY_DSN` to `.env` file

## Troubleshooting Installation

### Common Issues

#### npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Permission errors (Linux/macOS)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

#### Node version issues
```bash
# Use Node Version Manager (nvm)
nvm install 18
nvm use 18
```

#### Git clone fails
```bash
# Check SSH keys or use HTTPS
git clone https://github.com/your-repo/vikings-osm-backend.git
```

### Getting Help

If you encounter issues:

1. **Check the logs**: Look for error messages in the terminal
2. **Verify prerequisites**: Ensure Node.js and npm versions are correct
3. **Check network**: Ensure you can access npm registry
4. **Review documentation**: Check the [Troubleshooting Guide](../operations/troubleshooting.md)
5. **Report issues**: Create a GitHub issue with error details

## Next Steps

After successful installation:

1. **[Configuration](./configuration.md)** - Set up environment variables
2. **[Development Setup](./development.md)** - Configure development tools
3. **[API Reference](../api/osm-proxy.md)** - Learn about available endpoints

---

*Last updated: September 6, 2025*