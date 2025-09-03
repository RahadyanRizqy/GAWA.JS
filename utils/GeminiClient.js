const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Simple logging configuration
let logLevel = 'INFO';
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4
};

function setLogLevel(level) {
  logLevel = level.toUpperCase();
}

function log(level, message) {
  if (LOG_LEVELS[level] >= LOG_LEVELS[logLevel]) {
    console.log(`[${level}] ${message}`);
  }
}

// Constants mimicking Python
const ENDPOINTS = {
  GOOGLE: 'https://www.google.com',
  INIT: 'https://gemini.google.com/app',
  GENERATE: 'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate',
  ROTATE_COOKIES: 'https://accounts.google.com/RotateCookies',
  UPLOAD: 'https://content-push.googleapis.com/upload',
  BATCH_EXEC: 'https://gemini.google.com/_/BardChatUi/data/batchexecute'
};

const HEADERS = {
  GEMINI: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    'Host': 'gemini.google.com',
    'Origin': 'https://gemini.google.com',
    'Referer': 'https://gemini.google.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Same-Domain': '1'
  },
  ROTATE_COOKIES: {
    'Content-Type': 'application/json'
  },
  UPLOAD: { 'Push-ID': 'feeds/mcudyrk2a4khkz' }
};

const MODELS = {
  UNSPECIFIED: { name: 'unspecified', header: {} },
  G_2_5_FLASH: {
    name: 'gemini-2.5-flash',
    header: { 'x-goog-ext-525001261-jspb': '[1,null,null,null,"71c2d248d3b102ff"]' }
  },
  G_2_5_PRO: {
    name: 'gemini-2.5-pro',
    header: { 'x-goog-ext-525001261-jspb': '[1,null,null,null,"71c2d248d3b102ff"]' }
  },
  G_2_0_FLASH: {
    name: 'gemini-2.0-flash',
    header: { 'x-goog-ext-525001261-jspb': '[1,null,null,null,"71c2d248d3b102ff"]' }
  },
  G_2_0_FLASH_THINKING: {
    name: 'gemini-2.0-flash-thinking',
    header: { 'x-goog-ext-525001261-jspb': '[1,null,null,null,"71c2d248d3b102ff"]' }
  }
};

function getModel(modelName) {
  const upperName = modelName.toUpperCase().replace(/-/g, '_');
  return MODELS[upperName] || MODELS.UNSPECIFIED;
}

// ModelOutput class equivalent to Python's ModelOutput
class ModelOutput {
  constructor(text, candidates, metadata, rcid, images = [], thoughts = null) {
    this.text = text;
    this.candidates = candidates;
    this.metadata = metadata;
    this.rcid = rcid;
    this.images = images;
    this.thoughts = thoughts;
  }

  toString() {
    return this.text;
  }
}

// Image classes
class WebImage {
  constructor(title, url, alt) {
    this.title = title;
    this.url = url;
    this.alt = alt;
  }

  async save(path = './', filename = null, verbose = false) {
    // Implementation for saving web image
    if (verbose) console.log(`Saving web image: ${this.url}`);
    // Use axios to download and save
    const response = await axios.get(this.url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    const fileName = filename || this.title || 'image.jpg';
    const filePath = path.join(path, fileName);
    fs.writeFileSync(filePath, buffer);
    if (verbose) console.log(`Saved to ${filePath}`);
  }

  toString() {
    return `WebImage(title=${this.title}, url=${this.url})`;
  }
}

class GeneratedImage {
  constructor(title, url, alt) {
    this.title = title;
    this.url = url;
    this.alt = alt;
  }

  async save(path = './', filename = null, verbose = false) {
    // Similar to WebImage
    if (verbose) console.log(`Saving generated image: ${this.url}`);
    const response = await axios.get(this.url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    const fileName = filename || this.title || 'generated_image.jpg';
    const filePath = path.join(path, fileName);
    fs.writeFileSync(filePath, buffer);
    if (verbose) console.log(`Saved to ${filePath}`);
  }

  toString() {
    return `GeneratedImage(title=${this.title}, url=${this.url})`;
  }
}

// Gem class
class Gem {
  constructor(id, name, prompt, description, predefined = false) {
    this.id = id;
    this.name = name;
    this.prompt = prompt;
    this.description = description;
    this.predefined = predefined;
  }

  toString() {
    return `Gem(id=${this.id}, name=${this.name})`;
  }
}

// Gems collection
class GemsCollection {
  constructor(gems = []) {
    this.gems = gems;
  }

  filter(predefined = null) {
    if (predefined === null) return new GemsCollection(this.gems);
    return new GemsCollection(this.gems.filter(gem => gem.predefined === predefined));
  }

  get(idOrName) {
    return this.gems.find(gem => gem.id === idOrName || gem.name === idOrName);
  }

  toString() {
    return `GemsCollection(${this.gems.length} gems)`;
  }
}

// ChatSession class equivalent to Python's ChatSession
class ChatSession {
  constructor(client, metadata = null, model = 'unspecified', gem = null) {
    this.client = client;
    this.model = model;
    this.gem = gem;
    this.last_output = null;

    // Ensure metadata is an array with 3 elements [cid, rid, rcid]
    let initialMetadata = [null, null, null];
    if (metadata) {
      if (Array.isArray(metadata)) {
        initialMetadata = metadata.slice(0, 3);
        while (initialMetadata.length < 3) {
          initialMetadata.push(null);
        }
      } else {
        initialMetadata[0] = metadata; // Assume it's cid
      }
    }
    this.metadata = initialMetadata;
  }

  async sendMessage(message, files = [], model = null) {
    const response = await this.client.generateContent(
      message,
      files,
      model || this.model,
      this,
      this.gem
    );
    this.last_output = response;
    return response;
  }

  choose_candidate(index = 0) {
    if (!this.last_output || !this.last_output.candidates || index >= this.last_output.candidates.length) {
      throw new Error('Invalid candidate index');
    }
    return this.last_output.candidates[index];
  }
}

// Global task tracking (similar to Python's rotate_tasks)
const rotateTasks = new Map();

// Cookie rotation function (equivalent to Python's rotate_1psidts)
async function rotate1psidts(cookies, proxy = null) {
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filename = `.cached_1psidts_${cookies['__Secure-1PSID']}.txt`;
  const cacheFile = path.join(tempDir, filename);

  // Check if cache file exists and was modified within the last minute
  let shouldRotate = true;
  if (fs.existsSync(cacheFile)) {
    const stats = fs.statSync(cacheFile);
    const lastModified = stats.mtime.getTime();
    const now = Date.now();
    const oneMinute = 60 * 1000; // 1 minute in milliseconds

    if (now - lastModified <= oneMinute) {
      shouldRotate = false;
    }
  }

  if (shouldRotate) {
    let retries = 3;
    while (retries > 0) {
      try {
        const response = await axios.post(ENDPOINTS.ROTATE_COOKIES, JSON.stringify([0, "-0000000000000000000"]), {
          headers: {
            ...HEADERS.ROTATE_COOKIES,
            Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
          },
          proxy: proxy
        });

        if (response.status === 401) {
          throw new Error('Authentication failed - invalid cookies');
        }

        if (response.status !== 200) {
          throw new Error(`Cookie rotation failed with status ${response.status}`);
        }

        // Extract new __Secure-1PSIDTS from response cookies
        const setCookies = response.headers['set-cookie'] || [];
        let new1psidts = null;

        for (const cookie of setCookies) {
          if (cookie.includes('__Secure-1PSIDTS=')) {
            const match = cookie.match(/__Secure-1PSIDTS=([^;]+)/);
            if (match) {
              new1psidts = match[1];
              break;
            }
          }
        }

        if (new1psidts) {
          // Cache the new cookie
          fs.writeFileSync(cacheFile, new1psidts);
          return new1psidts;
        } else {
          throw new Error('No new __Secure-1PSIDTS found in response');
        }

      } catch (error) {
        console.error(`Cookie rotation failed (attempt ${4 - retries}/3):`, error.message);
        retries--;
        if (retries > 0) {
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw error;
        }
      }
    }
  } else {
    // Use cached value
    try {
      return fs.readFileSync(cacheFile, 'utf8');
    } catch (error) {
      console.warn('Failed to read cached cookie:', error.message);
    }
  }

  return null;
}

class GeminiClient {
  constructor(secure_1psid, secure_1psidts, proxy = null) {
    this.cookies = {};
    this.proxy = proxy;
    this.running = false;
    this.accessToken = null;
    this.timeout = 30000; // 30s
    this.autoClose = false;
    this.closeDelay = 300000; // 5min
    this.autoRefresh = true;
    this.refreshInterval = 540000; // 9min (540 * 1000ms)
    this.refreshTimer = null; // For background task
    this.closeTimer = null; // For auto-close task
    this.gems = new GemsCollection(); // Collection of available gems

    if (secure_1psid) {
      this.cookies['__Secure-1PSID'] = secure_1psid;
      if (secure_1psidts) {
        this.cookies['__Secure-1PSIDTS'] = secure_1psidts;
      }
    }
  }

  async init(timeout = this.timeout, auto_close = this.autoClose, close_delay = this.closeDelay, auto_refresh = this.autoRefresh, verbose = true) {
    timeout = timeout ?? this.timeout;
    try {
      const { accessToken, validCookies } = await this.getAccessToken(verbose);
      this.accessToken = accessToken;
      this.cookies = validCookies;
      this.running = true;
      this.timeout = timeout;
      this.autoClose = auto_close;
      this.closeDelay = close_delay;
      this.autoRefresh = auto_refresh;

      // Start auto-refresh if enabled
      if (this.autoRefresh) {
        this.startAutoRefresh();
        if (verbose) log('INFO', 'Auto-refresh enabled.');
      }

      // Start auto-close if enabled
      if (this.autoClose) {
        this.startAutoClose();
        if (verbose) log('INFO', 'Auto-close enabled.');
      }

      if (verbose) log('INFO', 'Gemini client initialized successfully.');
    } catch (error) {
      log('ERROR', `Failed to initialize client: ${error.message}`);
      throw error;
    }
  }

  async getAccessToken(verbose = false) {
    // Mimic get_access_token.py
    const extraCookies = {};
    try {
      const response = await axios.get(ENDPOINTS.GOOGLE, { proxy: this.proxy });
      if (response.status === 200) {
        // Extract cookies from response
        const setCookies = response.headers['set-cookie'] || [];
        setCookies.forEach(cookie => {
          const [nameValue] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          extraCookies[name] = value;
        });
      }
    } catch (e) {
      // Ignore
    }

    const cookiesToTry = [{ ...extraCookies, ...this.cookies }];

    for (const cookies of cookiesToTry) {
      try {
        const response = await axios.get(ENDPOINTS.INIT, {
          headers: {
            ...HEADERS.GEMINI,
            Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
          },
          proxy: this.proxy,
          timeout: this.timeout
        });

        const match = response.data.match(/"SNlM0e":"(.*?)"/);
        if (match) {
          if (verbose) console.log('Access token obtained.');
          return { accessToken: match[1], validCookies: cookies };
        }
      } catch (e) {
        if (verbose) console.log('Failed to get access token with current cookies.');
      }
    }

    throw new Error('Failed to obtain access token. Check your cookies.');
  }

  async generateContent(prompt, files = [], model = 'unspecified', chat = null, gem = null) {
    if (!this.running) await this.init();

    const modelObj = getModel(model);

    // Handle extensions (prompts starting with @)
    let extension = null;
    if (prompt.startsWith('@')) {
      const match = prompt.match(/^(@\w+)\s*(.*)/);
      if (match) {
        extension = match[1].substring(1); // Remove @
        prompt = match[2] || '';
      }
    }

    let fileList = null;
    if (files.length > 0) {
      fileList = [];
      for (const file of files) {
        const uploadId = await this.uploadFile(file);
        fileList.push([[uploadId], path.basename(file)]);
      }
    }

    const promptPart = fileList ? [prompt, 0, null, fileList] : [prompt];

    const innerArray = [promptPart, null, (chat && chat.metadata) ? chat.metadata : null];

    if (gem) {
      innerArray.push(...Array(16).fill(null), gem);
    }

    // Add extension if present
    if (extension) {
      // Extensions are handled by modifying the prompt or headers
      // This is a simplified implementation
      log('INFO', `Using extension: ${extension}`);
    }

    const innerJson = JSON.stringify(innerArray);
    const outerJson = JSON.stringify([null, innerJson]);

    const data = {
      at: this.accessToken,
      'f.req': outerJson
    };

    let response;
    let retries = 1;
    while (retries >= 0) {
      try {
        response = await axios.post(ENDPOINTS.GENERATE, new URLSearchParams(data), {
          headers: {
            ...HEADERS.GEMINI,
            ...modelObj.header,
            Cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
          },
          proxy: this.proxy,
          timeout: this.timeout
        });

        if (response.status !== 200) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        break; // Success, exit loop
      } catch (error) {
        if (error.message.includes('status code 400') && retries > 0) {
          console.log('Request failed with 400, attempting to re-initialize client...');
          await this.init(true); // Re-init with verbose
          retries--;
        } else {
          throw error;
        }
      }
    }

    // Parse response following Python implementation
    const responseText = response.data;
    log('DEBUG', `Raw response length: ${responseText.length}`);

    const lines = responseText.split('\n');
    if (lines.length < 3) {
      throw new Error('Invalid response format - not enough lines');
    }

    let responseJson;
    try {
      responseJson = JSON.parse(lines[2]);
    } catch (e) {
      log('ERROR', `Failed to parse response JSON: ${e.message}`);
      throw new Error('Invalid JSON response from server');
    }

    log('DEBUG', `Response JSON length: ${responseJson.length}`);

    let body = null;
    let bodyIndex = 0;

    for (let partIndex = 0; partIndex < responseJson.length; partIndex++) {
      const part = responseJson[partIndex];
      if (!part || !Array.isArray(part)) {
        continue;
      }

      try {
        if (part[2]) {
          const mainPart = JSON.parse(part[2]);
          if (mainPart && mainPart[4]) {
            body = mainPart;
            bodyIndex = partIndex;
            log('DEBUG', `Found body at part index ${partIndex}`);
            break;
          }
        }
      } catch (e) {
        log('DEBUG', `Failed to parse part ${partIndex}: ${e.message}`);
        continue;
      }
    }

    if (!body) {
      log('ERROR', 'No valid response body found');
      // Check for error codes
      try {
        if (responseJson[0] && responseJson[0][5] && responseJson[0][5][2] && responseJson[0][5][2][0] && responseJson[0][5][2][0][1] && responseJson[0][5][2][0][1][0]) {
          const errorCode = responseJson[0][5][2][0][1][0];
          switch (errorCode) {
            case 1037:
              throw new Error('Usage limit of the model has exceeded. Please try switching to another model.');
            case 1052:
              throw new Error('The specified model is not available. Please update gemini_webapi to the latest version.');
            case 1060:
              throw new Error('Your IP address is temporarily blocked by Google. Please try using a proxy or waiting.');
            default:
              throw new Error(`Server error with code ${errorCode}`);
          }
        }
      } catch (e) {
        if (e.message.includes('Usage limit') || e.message.includes('model') || e.message.includes('IP') || e.message.includes('Server error')) {
          throw e;
        }
      }
      throw new Error('No valid response body found');
    }

    // Ensure body[4] exists and is an array
    if (!body[4] || !Array.isArray(body[4])) {
      log('ERROR', 'Invalid response structure: body[4] is not an array');
      throw new Error('Invalid response structure from server');
    }

    // Parse candidates
    const candidates = [];
    for (let candidateIndex = 0; candidateIndex < body[4].length; candidateIndex++) {
      const candidate = body[4][candidateIndex];

      // Add null checks for candidate structure
      if (!candidate || !Array.isArray(candidate)) {
        log('WARNING', `Invalid candidate at index ${candidateIndex}, skipping`);
        continue;
      }

      let text = null;
      if (candidate[1] && candidate[1][0]) {
        text = candidate[1][0];
      } else if (candidate[2] && candidate[2][0]) {
        // Try alternative location for text
        text = candidate[2][0];
      } else {
        log('WARNING', `No text found in candidate ${candidateIndex}`);
        text = '';
      }

      // Handle special cases
      if (text && text.startsWith('http://googleusercontent.com/card_content/')) {
        text = (candidate[22] && candidate[22][0]) || text;
      }

      candidates.push({
        rcid: candidate[0] || null,
        text: text,
        thoughts: (candidate[37] && candidate[37][0] && candidate[37][0][0]) || null
      });
    }

    if (candidates.length === 0) {
      log('ERROR', 'No candidates found in response');
      log('DEBUG', `Body structure: ${JSON.stringify(body, null, 2).substring(0, 500)}...`);

      // Try alternative parsing approaches
      log('INFO', 'Attempting alternative parsing...');

      // Try to find text in different locations
      let fallbackText = '';
      try {
        // Look for text in various possible locations
        if (body[4] && body[4][0] && body[4][0][1] && body[4][0][1][0]) {
          fallbackText = body[4][0][1][0];
        } else if (body[2] && body[2][0]) {
          fallbackText = body[2][0];
        } else if (body[1] && typeof body[1] === 'string') {
          fallbackText = body[1];
        }

        if (fallbackText) {
          log('INFO', 'Found text using fallback parsing');
          candidates.push({
            rcid: null,
            text: fallbackText,
            thoughts: null
          });
        } else {
          throw new Error('No text found in any location');
        }
      } catch (e) {
        log('ERROR', `Fallback parsing also failed: ${e.message}`);
        throw new Error('No output data found in response');
      }
    }

    // Parse images from response
    const images = [];
    try {
      if (body[4] && body[4][0] && body[4][0][12]) {
        const imageData = body[4][0][12];
        if (Array.isArray(imageData)) {
          for (const img of imageData) {
            if (img && img[0] && img[0][0]) {
              const imgObj = img[0][0];
              const title = (imgObj && imgObj[1]) || '';
              const url = (imgObj && imgObj[0]) || '';
              const alt = (imgObj && imgObj[2]) || '';

              if (url) {
                // Determine if it's generated or web image
                const isGenerated = url.includes('generative') || title.includes('generated');
                const imageClass = isGenerated ? GeneratedImage : WebImage;
                images.push(new imageClass(title, url, alt));
              }
            }
          }
        }
      }
    } catch (e) {
      log('WARNING', `Failed to parse images: ${e.message}`);
    }

    const result = new ModelOutput(
      candidates[0].text,
      candidates,
      body[1],
      candidates[0].rcid,
      images,
      candidates[0].thoughts
    );

    console.log("Response metadata from body[1]:", body[1]);
    console.log("RCID from candidate:", candidates[0].rcid);

    // Update chat metadata if chat session provided
    if (chat) {
      if (result.metadata) {
        // Ensure metadata is an array
        let metadata = Array.isArray(result.metadata) ? result.metadata : [result.metadata];
        // Ensure it has at least 2 elements (cid, rid), add rcid as third
        if (metadata.length >= 2) {
          metadata[2] = result.rcid;
        } else {
          // If metadata doesn't have enough elements, create proper structure
          metadata = [metadata[0] || null, metadata[1] || null, result.rcid];
        }
        chat.metadata = metadata;
      }
    }

    return result;
  }

  async uploadFile(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('file', fileBuffer, path.basename(filePath));

    const response = await axios.post(ENDPOINTS.UPLOAD, form, {
      headers: {
        ...HEADERS.UPLOAD,
        ...form.getHeaders()
      },
      proxy: this.proxy
    });

    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    return response.data;
  }

  startChat(metadata = null, model = 'unspecified', gem = null) {
    return new ChatSession(this, metadata, model, gem);
  }

  // Start the background auto-refresh task
  startAutoRefresh() {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    console.log(`Starting auto-refresh every ${this.refreshInterval / 1000} seconds`);

    // Set up periodic refresh
    this.refreshTimer = setInterval(async () => {
      try {
        console.log('Attempting to refresh cookies...');
        const new1psidts = await rotate1psidts(this.cookies, this.proxy);

        if (new1psidts) {
          this.cookies['__Secure-1PSIDTS'] = new1psidts;
          console.log('Cookies refreshed successfully');
        } else {
          console.log('No new cookies received');
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error.message);

        // If authentication fails, stop auto-refresh
        if (error.message.includes('Authentication failed') ||
            error.message.includes('401')) {
          console.log('Stopping auto-refresh due to authentication failure');
          this.stopAutoRefresh();
        }
      }
    }, this.refreshInterval);
  }

  // Stop the background auto-refresh task
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      log('INFO', 'Auto-refresh stopped');
    }
  }

  // Start the background auto-close task
  startAutoClose() {
    // Clear any existing timer
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }

    log('INFO', `Starting auto-close after ${this.closeDelay / 1000} seconds of inactivity`);

    // Set timeout for auto-close
    this.closeTimer = setTimeout(async () => {
      log('INFO', 'Auto-closing client due to inactivity');
      await this.close();
    }, this.closeDelay);
  }

  // Stop the background auto-close task
  stopAutoClose() {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
      log('INFO', 'Auto-close stopped');
    }
  }

  // Close the client and clean up resources
  async close() {
    this.running = false;
    this.stopAutoRefresh();
    this.stopAutoClose();

    // Clear access token
    this.accessToken = null;

    log('INFO', 'Gemini client closed');
  }

  async fetchGems(include_hidden = false) {
    if (!this.running) await this.init();

    // This is a simplified implementation
    // In reality, this would make a request to fetch available gems
    // For now, we'll create some example gems
    const exampleGems = [
      new Gem('coding-partner', 'Coding Partner', 'You are a helpful coding assistant.', 'A gem for coding help', true),
      new Gem('writing-assistant', 'Writing Assistant', 'You are a professional writing assistant.', 'A gem for writing help', true)
    ];

    this.gems = new GemsCollection(exampleGems);
    return this.gems;
  }

  async createGem(name, prompt, description = '') {
    if (!this.running) await this.init();

    // Simplified implementation - in reality would make API call
    const gemId = `custom-${Date.now()}`;
    const newGem = new Gem(gemId, name, prompt, description, false);
    this.gems.gems.push(newGem);
    return newGem;
  }

  async updateGem(gem, name, prompt, description) {
    if (!this.running) await this.init();

    // Find and update the gem
    const existingGem = typeof gem === 'string' ? this.gems.get(gem) : gem;
    if (!existingGem) {
      throw new Error('Gem not found');
    }

    existingGem.name = name;
    existingGem.prompt = prompt;
    existingGem.description = description;

    // In reality, would make API call to update
    return existingGem;
  }

  async deleteGem(gem) {
    if (!this.running) await this.init();

    const gemToDelete = typeof gem === 'string' ? this.gems.get(gem) : gem;
    if (!gemToDelete) {
      throw new Error('Gem not found');
    }

    this.gems.gems = this.gems.gems.filter(g => g.id !== gemToDelete.id);
    // In reality, would make API call to delete
    return gemToDelete;
  }
}

module.exports = {
  GeminiClient,
  ModelOutput,
  ChatSession,
  WebImage,
  GeneratedImage,
  Gem,
  GemsCollection,
  setLogLevel
};