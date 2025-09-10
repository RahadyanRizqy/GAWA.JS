import axios from 'axios';
import fs from 'fs';
import path from 'path';
import got from 'got';
import { CookieJar } from 'tough-cookie';
import * as tough from 'tough-cookie';
import FormData from 'form-data';
import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AuthError } from './errors.js';
import { Endpoint, Headers } from './constants.js';
import { logger } from './logger.js';

const rotateTasks = new Map();

async function rotate1PSIDTS(cookies, proxy = null) {
    const tempDir = path.join(process.cwd(), "cookies");
    const filename = `.cached_1psidts_${cookies.__Secure_1PSID}.txt`;
    const filePath = path.join(tempDir, filename);

    // Create temp directory
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Check cache (60-second window)
    try {
        const stats = await fs.promises.stat(filePath);
        if (Date.now() - stats.mtimeMs <= 60000) {
            return (await fs.promises.readFile(filePath, "utf8")).trim();
        }
    } catch {
        // File doesn't exist, proceed with request
    }

    // Setup cookie jar
    const cookieJar = new CookieJar();
    for (const [name, value] of Object.entries(cookies)) {
        cookieJar.setCookieSync(`${name}=${value}`, "https://gemini.google.com");
    }

    // Make the request
    const response = await axios.post(
        Endpoint.ROTATE_COOKIES,
        '[000,"-0000000000000000000"]',
        {
            headers: {
                ...Headers.ROTATE_COOKIES,
                Cookie: Object.entries(cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join("; "),
            },
            proxy: proxy || false,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            validateStatus: () => true,
        }
    );

    if (response.statusCode === 401) {
        throw new AuthError();
    }
    if (response.statusCode !== 200) {
        throw new Error(`Request failed with status ${response.statusCode}`);
    }

    // Extract the new cookie
    const setCookieHeader = response.headers["set-cookie"];
    if (!setCookieHeader) throw new Error("__Secure-1PSIDTS cookie not found");

    let new_1psidts = null;
    for (const cookieStr of Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]) {
        const c = tough.Cookie.parse(cookieStr);
        if (c && c.key === "__Secure-1PSIDTS") {
            new_1psidts = c.value;
            break;
        }
    }
    if (!new_1psidts) throw new Error("__Secure-1PSIDTS cookie not found in response");

    // Cache the result
    await fs.promises.writeFile(filePath, new_1psidts);

    return new_1psidts;
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

// async function uploadFile(filePath, proxy = null) {
//     const fileBuffer = fs.readFileSync(filePath);
//     const form = new FormData();
//     form.append('file', fileBuffer, path.basename(filePath));

//     const response = await axios.post(Endpoint.UPLOAD, form, {
//         headers: {
//         ...Headers.UPLOAD,
//         ...form.getHeaders()
//         },
//         proxy: proxy
//     });
//     // console.log(response);

//     if (response.status !== 200) {
//         throw new Error(`Upload failed with status ${response.status}`);
//     }

//     return response.data;
// }

async function uploadFile(filePath, proxy = null) {
    // console.log("Here 1");
    // const fs = require('fs');
    // console.log("Here 2");

    const fileBuffer = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('file', fileBuffer, path.basename(filePath));

    // const stream = fs.readFileSync(filePath);
    // const form = new FormData();
    // form.append('file', stream, path.basename(filePath));

    const response = await axios.post(Endpoint.UPLOAD, form, {
        headers: {
        ...Headers.UPLOAD,
        ...form.getHeaders()
        },
        proxy: proxy
    });
    // console.log(form.getHeaders());
    // console.log(fileBuffer.length);

    if (response.status !== 200) {
        throw new Error(`Upload failed with status ${response.status}`);
    }

    return response.data;
}

async function parseFileName(file) {
    try {
        const stats = await fs.promises.stat(file);
        if (!stats.isFile()) {
            throw new Error(`${file} is not a valid file.`);
        }
    } catch (error) {
        throw new Error(`${file} is not a valid file.`);
    }
    return path.basename(file);
}

export { rotate1PSIDTS, sendRequest, getAccessToken, uploadFile, parseFileName, rotateTasks };