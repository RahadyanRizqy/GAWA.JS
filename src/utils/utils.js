import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { CookieJar } from 'tough-cookie';
import * as tough from 'tough-cookie';
import FormData from 'form-data';
import * as https from 'https';
import { AuthError } from './errors.js';
import { Endpoint, Headers } from './constants.js';
import { logger } from './logger.js';
import { request } from 'undici';

const rotateTasks = new Map();

async function rotate1PSIDTS(cookies, proxy = null) {
    const tempDir = path.join(process.cwd(), "cookies");
    await fs.promises.mkdir(tempDir, { recursive: true });
    const filename = `.cached_1psidts_${cookies.__Secure_1PSID}.txt`;
    const filePath = path.join(tempDir, filename);

    // Check cache (60-second window)
    try {
        const stats = await fs.promises.stat(filePath);
        if (Date.now() - stats.mtimeMs <= 60000) {
            return (await fs.promises.readFile(filePath, "utf8")).trim();
        }
    } catch {
        // File doesn't exist, proceed with request
    }

    const cookieHeader = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");

    const headers = {
        "Content-Type": "application/json",
        "User-Agent": "python-httpx/0.28.1",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Content-Length": Buffer.byteLength('[000,"-0000000000000000000"]'),
        "Cookie": cookieHeader,
    };

    const response = await request(url, {
        method: "POST",
        headers,
        body: '[000,"-0000000000000000000"]',
    });

    if (response.statusCode === 401) {
        throw new AuthError();
    }

    if (response.statusCode !== 200) {
        throw new Error(`Request failed with status ${response.statusCode}`);
    }

    const setCookie = response.headers["set-cookie"];
    let new1psidts = null;
    if (setCookie) {
        const cookiesArr = Array.isArray(setCookie) ? setCookie : [setCookie];
        for (const c of cookiesArr) {
            if (c.startsWith("__Secure-1PSIDTS=")) {
                new1psidts = c.split(";")[0].split("=")[1];
                break;
            }
        }
    }

    if (new1psidts) {
        await fs.promises.writeFile(filePath, new1psidts)
        return new1psidts;
    }
}

async function sendRequest(cookies, proxy = null) {
    const cookieJar = new CookieJar();
    for (const [name, value] of Object.entries(cookies)) {
        cookieJar.setCookieSync(`${name}=${value}`, "https://gemini.google.com");
    }

    const response = await axios.get(Endpoint.INIT, {
        headers: {
            ...Headers.GEMINI,
            Cookie: Object.entries(cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join("; "),
        },
        maxRedirects: 5,
        proxy: proxy || false,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        validateStatus: () => true,
    });

    return [response, cookies];
}

async function getAccessToken(_baseCookies, proxy = null, verbose = false) {
    const baseCookies = _baseCookies["baseCookies"];
    const cacheDir = path.join(process.cwd(), "cookies");
    await fs.promises.mkdir(cacheDir, { recursive: true });

    const cookieJar = new CookieJar();
    for (const [name, value] of Object.entries(baseCookies)) {
        cookieJar.setCookieSync(`${name}=${value}`, "https://www.google.com");
    }

    const extraCookies = {};
    let initialResp;
    try {
        initialResp = await axios.get(Endpoint.GOOGLE, { proxy: proxy });
        if (initialResp.status === 200) {
            // Extract cookies from response
            const setCookies = initialResp.headers['set-cookie'] || [];
            setCookies.forEach(cookieStr => {
                const cookie = tough.Cookie.parse(cookieStr);
                if (cookie) {
                    cookieJar.setCookieSync(cookie, "https://www.google.com");
                    extraCookies[cookie.key] = cookie.value;
                }
            });
        }
    } catch (e) {
    // Ignore
    }

    let tasks = [];

    if ("__Secure-1PSID" in baseCookies && "__Secure-1PSIDTS" in baseCookies) {
        const cookies = { ...extraCookies, ...baseCookies };
        tasks.push(await sendRequest(cookies, proxy));
    } else if (verbose) {
        logger.debug("Skipping loading base cookies. __Secure-1PSID or __Secure-1PSIDTS missing.");
    }

    // Cached cookies
    if ("__Secure-1PSID" in baseCookies) {
        const filename = `.cached_1psidts_${baseCookies.__Secure_1PSID}.txt`;
        const cacheFile = path.join(cacheDir, filename);
        try {
            const cached_1psidts = (await fs.promises.readFile(cacheFile, "utf8")).trim();
            if (cached_1psidts) {
                const cookies = { ...extraCookies, ...baseCookies, "__Secure-1PSIDTS": cached_1psidts };
                tasks.push(sendRequest(cookies, proxy));
            } else if (verbose) {
                logger.debug("Skipping cached cookies: cache file empty.");
            }
        } catch {
            if (verbose) logger.debug("Skipping cached cookies: cache file not found.");
        }
    } else {
        const files = await fs.promises.readdir(cacheDir);
        let validCaches = 0;
        for (const f of files) {
            if (!f.startsWith(".cached_1psidts_")) continue;
            const cached_1psidts = (await fs.promises.readFile(path.join(cacheDir, f), "utf8")).trim();
            if (!cached_1psidts) continue;

            const secure1psid = f.slice(".cached_1psidts_".length, -4); // remove prefix & .txt
            const cookies = { ...extraCookies, "__Secure-1PSID": secure1psid, "__Secure-1PSIDTS": cached_1psidts };
            tasks.push(sendRequest(cookies, proxy));
            validCaches++;
        }
        if (validCaches === 0 && verbose) {
            logger.debug("No valid cached cookies found.");
        }
    }

    if (tasks.length === 0) {
        throw new AuthError("No cookies available to initialize client.");
    }

    const results = await Promise.allSettled(tasks);

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled") {
            const [response, usedCookies] = r.value;
            const match = /"SNlM0e":"(.*?)"/.exec(response.data);
            // console.log(match);
            if (match) {
                if (verbose) logger.debug(`Init attempt (${i + 1}/${tasks.length}) succeeded.`);
                let accessToken = match[1];
                let validCookies = usedCookies;
                return [accessToken, validCookies];
            } else if (verbose) {
                logger.debug(`Init attempt (${i + 1}/${tasks.length}) failed: invalid cookies.`);
            }
        } else if (verbose) {
            logger.debug(`Init attempt (${i + 1}/${tasks.length}) failed: ${r.reason}`);
        }
    }

    throw new AuthError(`Failed to initialize client. (${tasks.length} attempts)`);
}

async function uploadFile(filePath, proxy = null) {
    // const fileBuffer = fs.readFileSync(filePath);
    const fileBuffer = fs.createReadStream(filePath);
    const form = new FormData();
    form.append('file', fileBuffer, path.basename(filePath));

    const formHeaders = form.getHeaders();
    const response = await axios.post(Endpoint.UPLOAD, form, {
        headers: {
        ...Headers.UPLOAD,
        ...formHeaders
        },
        proxy: proxy
    });

    if (response.status !== 200) {
        throw new Error(`Upload failed with status ${response.status}`);
    }

    return response.data;
}

export { rotate1PSIDTS, sendRequest, getAccessToken, uploadFile, rotateTasks };