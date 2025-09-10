import fs from 'fs';
import path from 'path';
import got from 'got';
import { CookieJar } from 'tough-cookie';
import { logger } from '../utils/logger.js';

class Image {
    constructor({ url, title = "[Image]", alt = "", proxy = null }) {
        this.url = url;
        this.title = title;
        this.alt = alt;
        this.proxy = proxy;
    }

    toString() {
        const shortUrl =
            this.url.length <= 20
                ? this.url
                : this.url.slice(0, 8) + "..." + this.url.slice(-12);
        return `Image(title='${this.title}', alt='${this.alt}', url='${shortUrl}')`;
    }

    async save({
        dir = "images",
        filename = null,
        cookies = null,
        verbose = false,
        skipInvalidFilename = false
    } = {}) {
        filename = filename || this.url.split("/").pop().split("?")[0];

        if (!/.*\.\w+$/.test(filename)) {
            if (verbose) logger.warn(`Invalid filename: ${filename}`);
            if (skipInvalidFilename) return null;
        }

        const jar = new CookieJar();
        Object.entries(cookies).forEach(([k, v]) => {
            jar.setCookieSync(`${k}=${v}`, "https://www.google.com");
            jar.setCookieSync(`${k}=${v}`, "https://lh3.googleusercontent.com");
            jar.setCookieSync(`${k}=${v}`, "https://work.fifeusercontent.google.com");
        });

        try {
            async function downloadImage(url, cookies, dir, filename) {
                const jar = new CookieJar();
                const domains = [
                    "https://google.com",
                    "https://www.google.com",
                    "https://lh3.googleusercontent.com",
                    "https://work.fife.usercontent.google.com",
                    "https://fife.usercontent.google.com"
                ];

                for (const [k, v] of Object.entries(cookies)) {
                    for (const d of domains) {
                        jar.setCookieSync(`${k}=${v}; Secure; HttpOnly`, d);
                    }
                }

                let currentUrl = url;
                for (let i = 0; i < 10; i++) {
                    const resp = await got(currentUrl, {
                        http2: true,
                        cookieJar: jar,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                            "Referer": "https://gemini.google.com/",
                        },
                        responseType: "buffer",
                        followRedirect: false,
                    });

                    if (resp.statusCode === 200) {
                        const contentType = resp.headers["content-type"];
                        if (contentType && !contentType.includes("image")) {
                            logger.warn(`⚠️ Not an image, but ${contentType}`);
                        }

                        await fs.promises.mkdir(dir, { recursive: true });
                        const dest = path.join(dir, filename);
                        await fs.promises.writeFile(dest, resp.rawBody);

                        logger.log("✅ Saved:", dest);
                        return dest;
                    }

                    if ([301, 302, 303, 307, 308].includes(resp.statusCode)) {
                        // console.log("Redirect ->", resp.headers.location);
                        currentUrl = resp.headers.location;
                        continue;
                    }

                    throw new Error(`Failed: ${resp.statusCode}`);
                }
                throw new Error("Too many redirects");
            }

            const savedPath = await downloadImage(this.url, cookies, dir, filename);
            if (verbose) logger.log(`Image saved as ${savedPath}`);
            return savedPath;

            } catch (err) {
                throw err;
            }
    }
}

class WebImage extends Image {}

class GeneratedImage extends Image {
    constructor({ url, cookies, title = "[Image]", alt = "", proxy = null }) {
        super({ url, title, alt, proxy });

        if (!cookies || Object.keys(cookies).length === 0) {
            throw new Error(
                "GeneratedImage is designed to be initialized with same cookies as GeminiClient."
            );
        }
        this.cookies = cookies;
    }

    async save({ fullSize = true, filename = null, ...options } = {}) {
        if (fullSize) {
            this.url += "=s2048";
        }

        const finalFilename =
            filename ||
            `${new Date().toISOString().replace(/[-:.TZ]/g, "")}_${this.url.slice(-10)}.png`;

        return super.save({ filename: finalFilename, cookies: this.cookies, ...options });
    }
}

export { Image, WebImage, GeneratedImage };