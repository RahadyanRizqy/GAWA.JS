const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

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
  }
};

function getModel(modelName) {
  const upperName = modelName.toUpperCase().replace(/-/g, '_');
  return MODELS[upperName] || MODELS.UNSPECIFIED;
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

    if (secure_1psid) {
      this.cookies['__Secure-1PSID'] = secure_1psid;
      if (secure_1psidts) {
        this.cookies['__Secure-1PSIDTS'] = secure_1psidts;
      }
    }
  }

  async init(timeout=this.timeout, verbose = true) {
    timeout = timeout ?? this.timeout;
    try {
      const { accessToken, validCookies } = await this.getAccessToken(verbose);
      this.accessToken = accessToken;
      this.cookies = validCookies;
      this.running = true;
      this.timeout = timeout;

      // Start auto-refresh if enabled
      if (this.autoRefresh) {
        this.startAutoRefresh();
        if (verbose) console.log('Auto-refresh enabled.');
      }

      if (verbose) console.log('Gemini client initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize client:', error.message);
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
    const lines = responseText.split('\n');
    if (lines.length < 3) {
      throw new Error('Invalid response format');
    }

    const responseJson = JSON.parse(lines[2]);

    let body = null;
    let bodyIndex = 0;

    for (let partIndex = 0; partIndex < responseJson.length; partIndex++) {
      const part = responseJson[partIndex];
      try {
        if (part[2]) {
          const mainPart = JSON.parse(part[2]);
          if (mainPart[4]) {
            body = mainPart;
            bodyIndex = partIndex;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!body) {
      // Check for error codes
      try {
        const errorCode = responseJson[0][5][2][0][1][0];
        switch (errorCode) {
          case 1037:
            throw new Error('Usage limit of the model has exceeded. Please try switching to another model.');
          case 1052:
            throw new Error('The specified model is not available. Please update gemini_webapi to the latest version.');
          case 1060:
            throw new Error('Your IP address is temporarily blocked by Google. Please try using a proxy or waiting.');
          default:
            throw new Error('Invalid response data received.');
        }
      } catch (e) {
        if (e.message.includes('Usage limit') || e.message.includes('model') || e.message.includes('IP')) {
          throw e;
        }
        throw new Error('No valid response body found');
      }
    }

    // Parse candidates
    const candidates = [];
    for (let candidateIndex = 0; candidateIndex < body[4].length; candidateIndex++) {
      const candidate = body[4][candidateIndex];
      let text = candidate[1][0];

      // Handle special cases
      if (text && text.startsWith('http://googleusercontent.com/card_content/')) {
        text = candidate[22] && candidate[22][0] || text;
      }

      candidates.push({
        rcid: candidate[0],
        text: text,
        thoughts: candidate[37] ? candidate[37][0][0] : null
      });
    }

    if (candidates.length === 0) {
      throw new Error('No output data found in response');
    }

    const result = {
      text: candidates[0].text,
      candidates: candidates,
      metadata: body[1],
      rcid: candidates[0].rcid
    };

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

  startChat(metadata = null, gem = null) {
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

    const chatSession = {
      metadata: initialMetadata,
      gem: gem,
      last_output: null,
      send_message: async (message, files = []) => {
        const response = await this.generateContent(message, files, 'unspecified', chatSession, chatSession.gem);
        chatSession.last_output = response;
        return response;
      }
    };
    return chatSession;
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
      console.log('Auto-refresh stopped');
    }
  }

  // Close the client and clean up resources
  async close() {
    this.running = false;
    this.stopAutoRefresh();

    // Clear access token
    this.accessToken = null;

    console.log('Gemini client closed');
  }

  async fetchGems(include_hidden = false) {
    // Stub
    this.gems = [];
  }
}

module.exports = GeminiClient;