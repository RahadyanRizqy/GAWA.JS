// gemini.js
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const { promisify } = require('util');
const os = require('os');
const sqlite3 = require('sqlite3');
const { app, session } = require('electron');
const keytar = require('keytar');

// Promisify file operations
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

// Enums and Constants
const GRPC = Object.freeze({
  READ_CHAT: "hNvQHb",
  LIST_GEMS: "CNgdBe",
  CREATE_GEM: "oMH3Zd",
  UPDATE_GEM: "kHv0Vd",
  DELETE_GEM: "UXcSJb"
});

const Endpoint = Object.freeze({
  GOOGLE: "https://www.google.com",
  INIT: "https://gemini.google.com/app",
  GENERATE: "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
  ROTATE_COOKIES: "https://accounts.google.com/RotateCookies",
  UPLOAD: "https://content-push.googleapis.com/upload",
  BATCH_EXEC: "https://gemini.google.com/_/BardChatUi/data/batchexecute"
});

const ErrorCode = Object.freeze({
  USAGE_LIMIT_EXCEEDED: 1037,
  MODEL_INCONSISTENT: 1050,
  MODEL_HEADER_INVALID: 1052,
  IP_TEMPORARILY_BLOCKED: 1060
});

const Headers = Object.freeze({
  GEMINI: {
    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    "Host": "gemini.google.com",
    "Origin": "https://gemini.google.com",
    "Referer": "https://gemini.google.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Same-Domain": "1"
  },
  ROTATE_COOKIES: {
    "Content-Type": "application/json"
  },
  UPLOAD: {"Push-ID": "feeds/mcudyrk2a4khkz"}
});

const Model = Object.freeze({
  UNSPECIFIED: {
    modelName: "unspecified",
    modelHeader: {},
    advancedOnly: false
  },
  G_2_5_FLASH: {
    modelName: "gemini-2.5-flash",
    modelHeader: {"x-goog-ext-525001261-jspb": '[1,null,null,null,"71c2d248d3b102ff",null,null,0,[4]]'},
    advancedOnly: false
  },
  G_2_5_PRO: {
    modelName: "gemini-2.5-pro",
    modelHeader: {"x-goog-ext-525001261-jspb": '[1,null,null,null,"4af6c7f5da75d65d",null,null,0,[4]]'},
    advancedOnly: false
  },
  G_2_0_FLASH: {
    modelName: "gemini-2.0-flash",
    modelHeader: {"x-goog-ext-525001261-jspb": '[1,null,null,null,"f299729663a2343f"]'},
    advancedOnly: false
  },
  G_2_0_FLASH_THINKING: {
    modelName: "gemini-2.0-flash-thinking",
    modelHeader: {"x-goog-ext-525001261-jspb": '[null,null,null,null,"7ca48d02d802f20a"]'},
    advancedOnly: false
  }
});

// Custom Errors
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

class APIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'APIError';
  }
}

class ImageGenerationError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'ImageGenerationError';
  }
}

class GeminiError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeminiError';
  }
}

class TimeoutError extends GeminiError {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class UsageLimitExceeded extends GeminiError {
  constructor(message) {
    super(message);
    this.name = 'UsageLimitExceeded';
  }
}

class ModelInvalid extends GeminiError {
  constructor(message) {
    super(message);
    this.name = 'ModelInvalid';
  }
}

class TemporarilyBlocked extends GeminiError {
  constructor(message) {
    super(message);
    this.name = 'TemporarilyBlocked';
  }
}

// Utility functions
function htmlUnescape(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
    '&#39;': "'"
  };
  
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#x27;|&#x2F;|&nbsp;|&#39;/g, match => entities[match]);
}

function decodeHtml(value) {
  if (!value) return value;
  return htmlUnescape(value);
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  if (Array.isArray(cookieHeader)) {
    cookieHeader.forEach(header => {
      header.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        if (parts.length > 1) {
          cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      });
    });
  } else {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      if (parts.length > 1) {
        cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });
  }
  
  return cookies;
}

function formatCookies(cookies) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

// Enhanced HTTP request helper with retry logic
async function makeRequest(url, options = {}, retries = 3, backoff = 300) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: options.method || 'GET',
          headers: options.headers || {},
          timeout: options.timeout || 30000
        };
        
        if (options.data && requestOptions.method === 'POST') {
          requestOptions.headers['Content-Length'] = Buffer.byteLength(options.data);
        }
        
        const req = protocol.request(requestOptions, (res) => {
          let data = '';
          const cookies = parseCookies(res.headers['set-cookie']);
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                data: data,
                cookies: cookies
              });
            } else {
              reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
            }
          });
        });
        
        req.on('error', (error) => {
          reject(error);
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new TimeoutError('Request timed out'));
        });
        
        if (options.data && requestOptions.method === 'POST') {
          req.write(options.data);
        }
        
        req.end();
      });
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

// Browser cookie extraction
async function loadBrowserCookies(domainName = "", verbose = true) {
  const cookies = {};
  const platforms = {
    darwin: {
      chrome: [
        `${os.homedir()}/Library/Application Support/Google/Chrome/Default/Cookies`,
        `${os.homedir()}/Library/Application Support/Google/Chrome/Profile */Cookies`
      ],
      chromium: [
        `${os.homedir()}/Library/Application Support/Chromium/Default/Cookies`,
        `${os.homedir()}/Library/Application Support/Chromium/Profile */Cookies`
      ],
      firefox: [
        `${os.homedir()}/Library/Application Support/Firefox/Profiles/*.default/cookies.sqlite`
      ],
      safari: [
        `${os.homedir()}/Library/Cookies/Cookies.binarycookies`
      ]
    },
    win32: {
      chrome: [
        `${process.env.LOCALAPPDATA}/Google/Chrome/User Data/Default/Cookies`,
        `${process.env.LOCALAPPDATA}/Google/Chrome/User Data/Profile */Cookies`
      ],
      chromium: [
        `${process.env.LOCALAPPDATA}/Chromium/User Data/Default/Cookies`,
        `${process.env.LOCALAPPDATA}/Chromium/User Data/Profile */Cookies`
      ],
      edge: [
        `${process.env.LOCALAPPDATA}/Microsoft/Edge/User Data/Default/Cookies`,
        `${process.env.LOCALAPPDATA}/Microsoft/Edge/User Data/Profile */Cookies`
      ],
      firefox: [
        `${process.env.APPDATA}/Mozilla/Firefox/Profiles/*.default/cookies.sqlite`
      ]
    },
    linux: {
      chrome: [
        `${os.homedir()}/.config/google-chrome/Default/Cookies`,
        `${os.homedir()}/.config/google-chrome/Profile */Cookies`
      ],
      chromium: [
        `${os.homedir()}/.config/chromium/Default/Cookies`,
        `${os.homedir()}/.config/chromium/Profile */Cookies`
      ],
      firefox: [
        `${os.homedir()}/.mozilla/firefox/*.default/cookies.sqlite`
      ]
    }
  };

  const platform = platforms[process.platform];
  if (!platform) {
    if (verbose) console.warn(`Unsupported platform: ${process.platform}`);
    return cookies;
  }

  for (const [browser, paths] of Object.entries(platform)) {
    for (const pattern of paths) {
      try {
        const files = await glob(pattern);
        for (const file of files) {
          try {
            const dbCookies = await extractCookiesFromDB(file, domainName);
            Object.assign(cookies, dbCookies);
          } catch (error) {
            if (verbose) console.warn(`Failed to extract cookies from ${file}: ${error.message}`);
          }
        }
      } catch (error) {
        if (verbose) console.debug(`No cookies found for ${browser} at ${pattern}`);
      }
    }
  }

  return cookies;
}

async function extractCookiesFromDB(dbPath, domainName) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    const cookies = {};
    
    const query = domainName ? 
      `SELECT name, value FROM cookies WHERE host_key LIKE '%${domainName}%'` :
      `SELECT name, value FROM cookies`;
    
    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      rows.forEach(row => {
        cookies[row.name] = row.value;
      });
      
      db.close();
      resolve(cookies);
    });
  });
}

async function glob(pattern) {
  const files = [];
  const baseDir = pattern.split('*')[0];
  const dir = path.dirname(baseDir);
  const baseName = path.basename(baseDir);
  
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (entry.startsWith(baseName)) {
        files.push(path.join(dir, entry));
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }
  
  return files;
}

// Logging configuration
let logger = {
  level: 'INFO',
  trace: (...args) => { if (this.level === 'TRACE') console.trace(...args); },
  debug: (...args) => { if (['TRACE', 'DEBUG'].includes(this.level)) console.debug(...args); },
  info: (...args) => { if (['TRACE', 'DEBUG', 'INFO'].includes(this.level)) console.info(...args); },
  warn: (...args) => { if (['TRACE', 'DEBUG', 'INFO', 'WARN'].includes(this.level)) console.warn(...args); },
  error: (...args) => { if (['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'].includes(this.level)) console.error(...args); },
  success: (...args) => { if (['TRACE', 'DEBUG', 'INFO'].includes(this.level)) console.log('✅', ...args); }
};

function setLogLevel(level) {
  const validLevels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
  if (!validLevels.includes(level.toUpperCase())) {
    throw new Error(`Invalid log level: ${level}. Valid levels are: ${validLevels.join(', ')}`);
  }
  logger.level = level.toUpperCase();
}

// Classes
class Gem {
  constructor(id, name, description = null, prompt = null, predefined = false) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.prompt = prompt;
    this.predefined = predefined;
  }

  toString() {
    return `Gem(id='${this.id}', name='${this.name}', description='${this.description}', prompt='${this.prompt}', predefined=${this.predefined})`;
  }
}

class GemJar extends Map {
  constructor(entries = []) {
    super(entries);
  }

  get(id = null, name = null, defaultValue = null) {
    if (id === null && name === null) {
      throw new Error("At least one of gem id or name must be provided.");
    }

    if (id !== null) {
      const gemCandidate = super.get(id);
      if (gemCandidate) {
        if (name !== null) {
          return gemCandidate.name === name ? gemCandidate : defaultValue;
        }
        return gemCandidate;
      }
      return defaultValue;
    } else if (name !== null) {
      for (const gem of this.values()) {
        if (gem.name === name) {
          return gem;
        }
      }
      return defaultValue;
    }

    return defaultValue;
  }

  filter(predefined = null, name = null) {
    const filteredGems = new GemJar();
    
    for (const [gemId, gem] of this.entries()) {
      if (predefined !== null && gem.predefined !== predefined) {
        continue;
      }
      if (name !== null && gem.name !== name) {
        continue;
      }
      filteredGems.set(gemId, gem);
    }
    
    return filteredGems;
  }
}

class RPCData {
  constructor(rpcid, payload, identifier = "generic") {
    this.rpcid = rpcid;
    this.payload = payload;
    this.identifier = identifier;
  }

  serialize() {
    return [this.rpcid, this.payload, null, this.identifier];
  }
}

class Image {
  constructor(url, title = "[Image]", alt = "", proxy = null) {
    this.url = url;
    this.title = title;
    this.alt = alt;
    this.proxy = proxy;
  }

  toString() {
    const urlStr = this.url.length <= 20 ? this.url : `${this.url.substring(0, 8)}...${this.url.substring(this.url.length - 12)}`;
    return `Image(title='${this.title}', alt='${this.alt}', url='${urlStr}')`;
  }

  async save(path = "temp", filename = null, cookies = null, verbose = false, skipInvalidFilename = false) {
    filename = filename || this.url.split('/').pop().split('?')[0];
    
    // Extract valid filename with extension
    const match = filename.match(/^(.*\.\w+)/);
    if (match) {
      filename = match[0];
    } else {
      if (verbose) {
        logger.warn(`Invalid filename: ${filename}`);
      }
      if (skipInvalidFilename) {
        return null;
      }
    }

    try {
      const headers = {};
      if (cookies) {
        headers.Cookie = formatCookies(cookies);
      }
      
      const response = await makeRequest(this.url, {
        method: 'GET',
        headers: headers
      });

      const contentType = response.headers['content-type'];
      if (contentType && !contentType.includes('image')) {
        logger.warn(`Content type of ${filename} is not image, but ${contentType}.`);
      }

      // Ensure directory exists
      try {
        await stat(path);
      } catch (error) {
        await mkdir(path, { recursive: true });
      }

      const dest = path + '/' + filename;
      await writeFile(dest, response.data);

      if (verbose) {
        logger.info(`Image saved as ${path.resolve(dest)}`);
      }

      return dest;
    } catch (error) {
      throw new Error(`Error downloading image: ${error.message}`);
    }
  }
}

class WebImage extends Image {
  // WebImage is the same as Image
}

class GeneratedImage extends Image {
  constructor(url, title = "[Image]", alt = "", proxy = null, cookies = {}) {
    super(url, title, alt, proxy);
    this.cookies = cookies;
    
    if (Object.keys(cookies).length === 0) {
      throw new Error("GeneratedImage is designed to be initialized with same cookies as GeminiClient.");
    }
  }

  async save(fullSize = true, options = {}) {
    if (fullSize) {
      this.url += "=s2048";
    }

    const filename = options.filename || 
      `${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14)}_${this.url.slice(-10)}.png`;
    
    return super.save(
      options.path || "temp",
      filename,
      this.cookies,
      options.verbose || false,
      options.skipInvalidFilename || false
    );
  }
}

class Candidate {
  constructor(rcid, text, thoughts = null, webImages = [], generatedImages = []) {
    this.rcid = rcid;
    this.text = decodeHtml(text);
    this.thoughts = decodeHtml(thoughts);
    this.webImages = webImages;
    this.generatedImages = generatedImages;
  }

  toString() {
    return this.text;
  }

  [Symbol.toStringTag]() {
    const textPreview = this.text.length <= 20 ? this.text : `${this.text.substring(0, 20)}...`;
    return `Candidate(rcid='${this.rcid}', text='${textPreview}', images=${this.images.length})`;
  }

  get images() {
    return [...this.webImages, ...this.generatedImages];
  }
}

class ModelOutput {
  constructor(metadata, candidates, chosen = 0) {
    this.metadata = metadata;
    this.candidates = candidates;
    this.chosen = chosen;
  }

  toString() {
    return this.text;
  }

  [Symbol.toStringTag]() {
    return `ModelOutput(metadata=${JSON.stringify(this.metadata)}, chosen=${this.chosen}, candidates=${this.candidates.length})`;
  }

  get text() {
    return this.candidates[this.chosen].text;
  }

  get thoughts() {
    return this.candidates[this.chosen].thoughts;
  }

  get images() {
    return this.candidates[this.chosen].images;
  }

  get rcid() {
    return this.candidates[this.chosen].rcid;
  }
}

// Cookie rotation and management
async function rotate1PSIDTS(cookies, proxy = null) {
  const cacheDir = path.join(__dirname, 'temp');
  const filename = `.cached_1psidts_${cookies['__Secure-1PSID']}.txt`;
  const cacheFile = path.join(cacheDir, filename);
  
  try {
    await stat(cacheDir);
  } catch (error) {
    await mkdir(cacheDir, { recursive: true });
  }
  
  // Check if cache file was modified in the last minute
  let cacheModified = false;
  try {
    const stats = await stat(cacheFile);
    cacheModified = Date.now() - stats.mtimeMs <= 60000;
  } catch (error) {
    // File doesn't exist or can't be accessed
  }
  
  if (!cacheModified) {
    try {
      const response = await makeRequest(Endpoint.ROTATE_COOKIES, {
        method: 'POST',
        headers: Headers.ROTATE_COOKIES,
        data: '[000,"-0000000000000000000"]'
      }, 3, 300);
      
      if (response.statusCode === 401) {
        throw new AuthError("Authentication failed during cookie rotation");
      }
      
      if (response.cookies && response.cookies['__Secure-1PSIDTS']) {
        await writeFile(cacheFile, response.cookies['__Secure-1PSIDTS']);
        return response.cookies['__Secure-1PSIDTS'];
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new Error(`Failed to rotate cookies: ${error.message}`);
    }
  }
  
  // Return cached value if recent rotation exists
  try {
    return await readFile(cacheFile, 'utf8');
  } catch (error) {
    throw new Error("No valid cached cookie available");
  }
}

// Main Gemini Client
class GeminiClient {
  constructor(secure1PSID = null, secure1PSIDTS = null, proxy = null, options = {}) {
    this.cookies = {};
    this.proxy = proxy;
    this.running = false;
    this.accessToken = null;
    this.timeout = options.timeout || 300;
    this.autoClose = options.autoClose || false;
    this.closeDelay = options.closeDelay || 300;
    this.closeTask = null;
    this.autoRefresh = options.autoRefresh !== false; // Default true
    this.refreshInterval = options.refreshInterval || 540;
    this._gems = null;
    this.rotateTasks = new Map();
    this.kwargs = options.kwargs || {};

    // Validate cookies
    if (secure1PSID) {
      this.cookies['__Secure-1PSID'] = secure1PSID;
      if (secure1PSIDTS) {
        this.cookies['__Secure-1PSIDTS'] = secure1PSIDTS;
      }
    }
  }

  get gems() {
    if (this._gems === null) {
      throw new Error("Gems not fetched yet. Call `GeminiClient.fetchGems()` method to fetch gems from gemini.google.com.");
    }
    return this._gems;
  }

  async init(timeout = 300, autoClose = false, closeDelay = 300, autoRefresh = true, refreshInterval = 540, verbose = true) {
    try {
      const [accessToken, validCookies] = await this.getAccessToken(this.cookies, verbose);
      
      this.accessToken = accessToken;
      this.cookies = validCookies;
      this.running = true;
      this.timeout = timeout;
      this.autoClose = autoClose;
      this.closeDelay = closeDelay;
      
      if (this.autoClose) {
        await this.resetCloseTask();
      }

      this.autoRefresh = autoRefresh;
      this.refreshInterval = refreshInterval;
      
      if (this.autoRefresh) {
        this.startAutoRefresh();
      }

      if (verbose) {
        logger.success("Gemini client initialized successfully.");
      }
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close(delay = 0) {
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }

    this.running = false;

    if (this.closeTask) {
      clearTimeout(this.closeTask);
      this.closeTask = null;
    }

    // Cancel any auto-refresh tasks
    for (const task of this.rotateTasks.values()) {
      clearInterval(task);
    }
    this.rotateTasks.clear();
  }

  async resetCloseTask() {
    if (this.closeTask) {
      clearTimeout(this.closeTask);
      this.closeTask = null;
    }
    this.closeTask = setTimeout(() => this.close(), this.closeDelay * 1000);
  }

  startAutoRefresh() {
    const task = setInterval(async () => {
      try {
        const new1PSIDTS = await rotate1PSIDTS(this.cookies, this.proxy);
        logger.debug(`Cookies refreshed. New __Secure-1PSIDTS: ${new1PSIDTS}`);
        if (new1PSIDTS) {
          this.cookies['__Secure-1PSIDTS'] = new1PSIDTS;
        }
      } catch (error) {
        logger.warn("Failed to refresh cookies. Background auto refresh task canceled.", error);
        clearInterval(task);
        this.rotateTasks.delete(this.cookies['__Secure-1PSID']);
      }
    }, this.refreshInterval * 1000);
    
    this.rotateTasks.set(this.cookies['__Secure-1PSID'], task);
  }

  async getAccessToken(baseCookies, verbose = false) {
    const tasks = [];
    
    // Base cookies passed directly on initializing client
    if (baseCookies['__Secure-1PSID'] && baseCookies['__Secure-1PSIDTS']) {
      tasks.push(this.sendAuthRequest({...baseCookies}));
    } else if (verbose) {
      logger.debug("Skipping loading base cookies. Either __Secure-1PSID or __Secure-1PSIDTS is not provided.");
    }
    
    // Cached cookies in local file
    const cacheDir = path.join(__dirname, 'temp');
    if (baseCookies['__Secure-1PSID']) {
      const filename = `.cached_1psidts_${baseCookies['__Secure-1PSID']}.txt`;
      const cacheFile = path.join(cacheDir, filename);
      
      try {
        const cached1PSIDTS = await readFile(cacheFile, 'utf8');
        if (cached1PSIDTS) {
          const cachedCookies = {
            ...baseCookies,
            '__Secure-1PSIDTS': cached1PSIDTS
          };
          tasks.push(this.sendAuthRequest(cachedCookies));
        } else if (verbose) {
          logger.debug("Skipping loading cached cookies. Cache file is empty.");
        }
      } catch (error) {
        if (verbose) {
          logger.debug("Skipping loading cached cookies. Cache file not found.");
        }
      }
    }
    
    // Browser cookies
    try {
      const browserCookies = await loadBrowserCookies('google.com', verbose);
      if (browserCookies && browserCookies['__Secure-1PSID']) {
        const localCookies = {'__Secure-1PSID': browserCookies['__Secure-1PSID']};
        if (browserCookies['__Secure-1PSIDTS']) {
          localCookies['__Secure-1PSIDTS'] = browserCookies['__Secure-1PSIDTS'];
        }
        if (browserCookies['NID']) {
          localCookies['NID'] = browserCookies['NID'];
        }
        tasks.push(this.sendAuthRequest(localCookies));
      } else if (verbose) {
        logger.debug("Skipping loading local browser cookies. Login to gemini.google.com in your browser first.");
      }
    } catch (error) {
      if (verbose) {
        logger.debug("Skipping loading local browser cookies. Error:", error.message);
      }
    }
    
    // Execute all auth attempts
    for (let i = 0; i < tasks.length; i++) {
      try {
        const [response, requestCookies] = await tasks[i];
        const match = response.data.match(/"SNlM0e":"(.*?)"/);
        if (match) {
          if (verbose) {
            logger.debug(`Init attempt (${i + 1}/${tasks.length}) succeeded. Initializing client...`);
          }
          return [match[1], requestCookies];
        } else if (verbose) {
          logger.debug(`Init attempt (${i + 1}/${tasks.length}) failed. Cookies invalid.`);
        }
      } catch (error) {
        if (verbose) {
          logger.debug(`Init attempt (${i + 1}/${tasks.length}) failed with error: ${error.message}`);
        }
      }
    }
    
    throw new AuthError(
      "Failed to initialize client. SECURE_1PSIDTS could get expired frequently, please make sure cookie values are up to date. " +
      `(Failed initialization attempts: ${tasks.length})`
    );
  }
  
  async sendAuthRequest(cookies) {
    const response = await makeRequest(Endpoint.INIT, {
      method: 'GET',
      headers: {
        ...Headers.GEMINI,
        'Cookie': formatCookies(cookies)
      }
    });
    
    return [response, cookies];
  }

  async generateContent(prompt, files = null, model = Model.UNSPECIFIED, gem = null, chat = null, options = {}) {
    if (!prompt) {
      throw new Error("Prompt cannot be empty.");
    }

    if (typeof model === 'string') {
      model = getModelByName(model);
    }

    let gemId = null;
    if (gem instanceof Gem) {
      gemId = gem.id;
    } else if (typeof gem === 'string') {
      gemId = gem;
    }

    if (this.autoClose) {
      await this.resetCloseTask();
    }

    try {
      // Prepare file uploads if any
      let fileData = null;
      if (files && files.length > 0) {
        fileData = [];
        for (const file of files) {
          const fileId = await this.uploadFile(file);
          const fileName = this.parseFileName(file);
          fileData.push([[fileId], fileName]);
        }
      }

      // Prepare request payload
      const payload = fileData ? 
        [prompt, 0, null, fileData] : 
        [prompt];
      
      if (chat && chat.metadata) {
        payload.push(chat.metadata);
      }
      
      if (gemId) {
        // Add 16 nulls + gemId as in Python version
        for (let i = 0; i < 16; i++) {
          payload.push(null);
        }
        payload.push(gemId);
      }

      const requestData = {
        at: this.accessToken,
        'f.req': JSON.stringify([null, JSON.stringify(payload)])
      };

      const response = await makeRequest(Endpoint.GENERATE, {
        method: 'POST',
        headers: {
          ...Headers.GEMINI,
          ...model.modelHeader,
          'Cookie': formatCookies(this.cookies)
        },
        data: new URLSearchParams(requestData).toString(),
        timeout: this.timeout * 1000
      }, 3, 300);

      if (response.statusCode !== 200) {
        await this.close();
        throw new APIError(`Failed to generate contents. Request failed with status code ${response.statusCode}`);
      }

      // Parse response
      const responseLines = response.data.split('\n');
      let responseJson;
      try {
        responseJson = JSON.parse(responseLines[2]);
      } catch (e) {
        await this.close();
        throw new APIError("Failed to parse response JSON");
      }

      let body = null;
      let bodyIndex = 0;
      
      for (let partIndex = 0; partIndex < responseJson.length; partIndex++) {
        const part = responseJson[partIndex];
        try {
          const mainPart = JSON.parse(part[2]);
          if (mainPart[4]) {
            bodyIndex = partIndex;
            body = mainPart;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!body) {
        await this.close();
        
        // Check for specific error codes
        try {
          const errorCode = responseJson[0][5][2][0][1][0];
          switch (errorCode) {
            case ErrorCode.USAGE_LIMIT_EXCEEDED:
              throw new UsageLimitExceeded(
                `Failed to generate contents. Usage limit of ${model.modelName} model has exceeded. Please try switching to another model.`
              );
            case ErrorCode.MODEL_INCONSISTENT:
              throw new ModelInvalid(
                "Failed to generate contents. The specified model is inconsistent with the chat history. Please make sure to pass the same " +
                "`model` parameter when starting a chat session with previous metadata."
              );
            case ErrorCode.MODEL_HEADER_INVALID:
              throw new ModelInvalid(
                "Failed to generate contents. The specified model is not available. Please update to the latest version. " +
                "If the error persists, please report it."
              );
            case ErrorCode.IP_TEMPORARILY_BLOCKED:
              throw new TemporarilyBlocked(
                "Failed to generate contents. Your IP address is temporarily blocked by Google. Please try using a proxy or waiting for a while."
              );
            default:
              throw new APIError("Failed to generate contents. Invalid response data received.");
          }
        } catch (e) {
          if (e instanceof GeminiError) {
            throw e;
          }
          throw new APIError("Failed to generate contents. Invalid response data received.");
        }
      }

      // Parse candidates from response
      const candidates = [];
      for (let candidateIndex = 0; candidateIndex < body[4].length; candidateIndex++) {
        const candidate = body[4][candidateIndex];
        let text = candidate[1][0];
        
        // Handle special card content
        if (text.match(/^http:\/\/googleusercontent\.com\/card_content\/\d+/)) {
          text = candidate[22] && candidate[22][0] ? candidate[22][0] : text;
        }

        let thoughts = null;
        try {
          thoughts = candidate[37][0][0];
        } catch (e) {
          // thoughts remains null
        }

        // Parse web images
        const webImages = [];
        try {
          if (candidate[12] && candidate[12][1]) {
            for (const webImage of candidate[12][1]) {
              webImages.push(new WebImage(
                webImage[0][0][0],
                webImage[7][0],
                webImage[0][4],
                this.proxy
              ));
            }
          }
        } catch (e) {
          // Skip web images if parsing fails
        }

        // Parse generated images
        const generatedImages = [];
        try {
          if (candidate[12] && candidate[12][7] && candidate[12][7][0]) {
            let imgBody = null;
            for (let imgPartIndex = bodyIndex; imgPartIndex < responseJson.length; imgPartIndex++) {
              const part = responseJson[imgPartIndex];
              try {
                const imgPart = JSON.parse(part[2]);
                if (imgPart[4] && imgPart[4][candidateIndex] && imgPart[4][candidateIndex][12] && 
                    imgPart[4][candidateIndex][12][7] && imgPart[4][candidateIndex][12][7][0]) {
                  imgBody = imgPart;
                  break;
                }
              } catch (e) {
                continue;
              }
            }

            if (!imgBody) {
              throw new ImageGenerationError(
                "Failed to parse generated images. Please update to the latest version. " +
                "If the error persists, please report it."
              );
            }

            const imgCandidate = imgBody[4][candidateIndex];
            text = text.replace(/http:\/\/googleusercontent\.com\/image_generation_content\/\d+/, "").trim();

            for (let imageIndex = 0; imageIndex < imgCandidate[12][7][0].length; imageIndex++) {
              const generatedImage = imgCandidate[12][7][0][imageIndex];
              const title = generatedImage[3][6] ? 
                `[Generated Image ${generatedImage[3][6]}]` : "[Generated Image]";
              
              let alt = "";
              if (generatedImage[3][5] && generatedImage[3][5].length > imageIndex) {
                alt = generatedImage[3][5][imageIndex];
              } else if (generatedImage[3][5] && generatedImage[3][5].length > 0) {
                alt = generatedImage[3][5][0];
              }

              generatedImages.push(new GeneratedImage(
                generatedImage[0][3][3],
                title,
                alt,
                this.proxy,
                this.cookies
              ));
            }
          }
        } catch (e) {
          if (e instanceof ImageGenerationError) {
            throw e;
          }
          // Skip generated images if parsing fails
        }

        candidates.push(new Candidate(
          candidate[0],
          text,
          thoughts,
          webImages,
          generatedImages
        ));
      }

      if (candidates.length === 0) {
        throw new GeminiError("Failed to generate contents. No output data found in response.");
      }

      const output = new ModelOutput(body[1], candidates);
      
      if (chat instanceof ChatSession) {
        chat.lastOutput = output;
      }

      return output;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new TimeoutError(
          "Generate content request timed out, please try again. If the problem persists, " +
          "consider setting a higher `timeout` value when initializing GeminiClient."
        );
      }
      throw error;
    }
  }

  async uploadFile(filePath) {
    try {
      const fileData = await readFile(filePath);
      
      const response = await makeRequest(Endpoint.UPLOAD, {
        method: 'POST',
        headers: Headers.UPLOAD,
        data: fileData
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  parseFileName(filePath) {
    return path.basename(filePath);
  }

  async fetchGems(includeHidden = false) {
    const response = await this._batchExecute([
      new RPCData(
        GRPC.LIST_GEMS,
        includeHidden ? "[4]" : "[3]",
        "system"
      ),
      new RPCData(
        GRPC.LIST_GEMS,
        "[2]",
        "custom"
      )
    ]);

    try {
      const responseJson = JSON.parse(response.data.split('\n')[2]);
      let predefinedGems = [];
      let customGems = [];

      for (const part of responseJson) {
        if (part[part.length - 1] === "system") {
          const parsed = JSON.parse(part[2]);
          predefinedGems = parsed[2] || [];
        } else if (part[part.length - 1] === "custom") {
          const parsed = JSON.parse(part[2]);
          if (parsed && parsed.length > 2) {
            customGems = parsed[2] || [];
          }
        }
      }

      if (!predefinedGems && !customGems) {
        throw new Error("No gems found in response");
      }

      const gems = new GemJar();

      // Add predefined gems
      for (const gem of predefinedGems) {
        gems.set(gem[0], new Gem(
          gem[0],
          gem[1][0],
          gem[1][1],
          gem[2] && gem[2][0] || null,
          true
        ));
      }

      // Add custom gems
      for (const gem of customGems) {
        gems.set(gem[0], new Gem(
          gem[0],
          gem[1][0],
          gem[1][1],
          gem[2] && gem[2][0] || null,
          false
        ));
      }

      this._gems = gems;
      return gems;
    } catch (error) {
      await this.close();
      logger.debug(`Invalid response: ${response.data}`);
      throw new APIError(
        "Failed to fetch gems. Invalid response data received. Client will try to re-initialize on next request."
      );
    }
  }

  async createGem(name, prompt, description = "") {
    const response = await this._batchExecute([
      new RPCData(
        GRPC.CREATE_GEM,
        JSON.stringify([[
          name,
          description,
          prompt,
          null,
          null,
          null,
          null,
          null,
          0,
          null,
          1,
          null,
          null,
          null,
          []
        ]])
      )
    ]);

    try {
      const responseJson = JSON.parse(response.data.split('\n')[2]);
      const gemId = JSON.parse(responseJson[0][2])[0];
      
      return new Gem(
        gemId,
        name,
        description,
        prompt,
        false
      );
    } catch (error) {
      await this.close();
      logger.debug(`Invalid response: ${response.data}`);
      throw new APIError(
        "Failed to create gem. Invalid response data received. Client will try to re-initialize on next request."
      );
    }
  }

  async updateGem(gem, name, prompt, description = "") {
    const gemId = gem instanceof Gem ? gem.id : gem;

    await this._batchExecute([
      new RPCData(
        GRPC.UPDATE_GEM,
        JSON.stringify([
          gemId,
          [
            name,
            description,
            prompt,
            null,
            null,
            null,
            null,
            null,
            0,
            null,
            1,
            null,
            null,
            null,
            [],
            0
          ]
        ])
      )
    ]);

    return new Gem(
      gemId,
      name,
      description,
      prompt,
      false
    );
  }

  async deleteGem(gem) {
    const gemId = gem instanceof Gem ? gem.id : gem;

    await this._batchExecute([
      new RPCData(
        GRPC.DELETE_GEM,
        JSON.stringify([gemId])
      )
    ]);
  }

  async _batchExecute(payloads) {
    try {
      const response = await makeRequest(Endpoint.BATCH_EXEC, {
        method: 'POST',
        headers: {
          ...Headers.GEMINI,
          'Cookie': formatCookies(this.cookies)
        },
        data: new URLSearchParams({
          at: this.accessToken,
          'f.req': JSON.stringify([payloads.map(p => p.serialize())])
        }).toString(),
        timeout: this.timeout * 1000
      }, 3, 300);

      if (response.statusCode !== 200) {
        await this.close();
        throw new APIError(`Batch execution failed with status code ${response.statusCode}`);
      }

      return response;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new TimeoutError(
          "Batch execute request timed out, please try again. If the problem persists, " +
          "consider setting a higher `timeout` value when initializing GeminiClient."
        );
      }
      throw error;
    }
  }

  startChat(metadata = null, cid = null, rid = null, rcid = null, model = Model.UNSPECIFIED, gem = null) {
    return new ChatSession(this, metadata, cid, rid, rcid, model, gem);
  }
}

class ChatSession {
  constructor(geminiClient, metadata = null, cid = null, rid = null, rcid = null, model = Model.UNSPECIFIED, gem = null) {
    this._metadata = [null, null, null];
    this.geminiClient = geminiClient;
    this.lastOutput = null;
    this.model = model;
    this.gem = gem;

    if (metadata) {
      this.metadata = metadata;
    }
    if (cid) {
      this.cid = cid;
    }
    if (rid) {
      this.rid = rid;
    }
    if (rcid) {
      this.rcid = rcid;
    }
  }

  toString() {
    return `ChatSession(cid='${this.cid}', rid='${this.rid}', rcid='${this.rcid}')`;
  }

  set lastOutput(value) {
    this._lastOutput = value;
    if (value instanceof ModelOutput) {
      this.metadata = value.metadata;
      this.rcid = value.rcid;
    }
  }

  get lastOutput() {
    return this._lastOutput;
  }

  async sendMessage(prompt, files = null, options = {}) {
    return await this.geminiClient.generateContent(
      prompt,
      files,
      this.model,
      this.gem,
      this,
      options
    );
  }

  chooseCandidate(index) {
    if (!this.lastOutput) {
      throw new Error("No previous output data found in this chat session.");
    }

    if (index >= this.lastOutput.candidates.length) {
      throw new Error(`Index ${index} exceeds the number of candidates in last model output.`);
    }

    this.lastOutput.chosen = index;
    this.rcid = this.lastOutput.rcid;
    return this.lastOutput;
  }

  get metadata() {
    return this._metadata;
  }

  set metadata(value) {
    if (value.length > 3) {
      throw new Error("metadata cannot exceed 3 elements");
    }
    this._metadata = [...value];
  }

  get cid() {
    return this._metadata[0];
  }

  set cid(value) {
    this._metadata[0] = value;
  }

  get rid() {
    return this._metadata[1];
  }

  set rid(value) {
    this._metadata[1] = value;
  }

  get rcid() {
    return this._metadata[2];
  }

  set rcid(value) {
    this._metadata[2] = value;
  }
}

// Helper function to get model by name
function getModelByName(name) {
  for (const key in Model) {
    if (Model[key].modelName === name) {
      return Model[key];
    }
  }
  throw new Error(`Unknown model name: ${name}. Available models: ${Object.values(Model).map(m => m.modelName).join(', ')}`);
}

// Export the main classes and functions
module.exports = {
  GeminiClient,
  ChatSession,
  Gem,
  GemJar,
  Image,
  WebImage,
  GeneratedImage,
  Candidate,
  ModelOutput,
  Model,
  // Errors
  AuthError,
  APIError,
  ImageGenerationError,
  GeminiError,
  TimeoutError,
  UsageLimitExceeded,
  ModelInvalid,
  TemporarilyBlocked,
  // Utility functions
  rotate1PSIDTS,
  getModelByName,
  setLogLevel,
  logger
};