import { Gem } from '../modules/gems.js';
import axios from 'axios';
import path from 'path';
import cookie from 'cookie';
import { running } from '../utils/decorators.js';
import { GemMixin } from '../modules/gems.js';
import { Model } from './model.js';
import { Endpoint, Headers, ErrorCode } from '../utils/constants.js';
import { 
    APIError, 
    TimeoutError, 
    UsageLimitExceeded, 
    ModelInvalid, 
    TemporarilyBlocked, 
    ImageGenerationError, 
    GeminiError 
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { rotate1PSIDTS, getAccessToken, uploadFile, parseFileName, rotateTasks } from '../utils/utils.js';
import { WebImage, GeneratedImage } from '../modules/images.js';
import { Candidate, ModelOutput } from '../modules/output.js';
import { encryptMd } from '../utils/cryptmd.js';

class GeminiClient extends GemMixin {
    constructor({ 
        secure1psid = null, 
        secure1psidts = null,
        cookieHeader = null, 
        proxy = null, 
        ...options 
    } = {}) {
        super();
        this.cookies = {};
        this.proxy = proxy;
        this.running = false;
        this.client = null;
        this.accessToken = null;
        this.timeout = 30000;
        this.autoClose = false;
        this.closeDelay = 30000;
        this.closeTask = null;
        this.autoRefresh = true;
        this.refreshInterval = 54000;
        this.options = options;
        this.generateContent = running(2)(this.generateContent.bind(this));

        if (secure1psid) {
            this.cookies["__Secure-1PSID"] = secure1psid;
            if (secure1psidts) {
                this.cookies["__Secure-1PSIDTS"] = secure1psidts;
            }
        }

        if (cookieHeader) {
            const _cookieHeader = cookie.parse(cookieHeader);
            this.cookies["__Secure-1PSID"] = _cookieHeader['__Secure-1PSID'];
            this.cookies["__Secure-1PSIDTS"] = _cookieHeader['__Secure-1PSIDTS'];
        }
    }
    async init({
        timeout = 300000,       // pakai ms (300s = 300000 ms)
        autoClose = false,
        closeDelay = 300000,    // ms
        autoRefresh = true,
        refreshInterval = 540000, // 540s = 9 menit
        verbose = true
    } = {}) {
        this.timeout = timeout;
        this.autoClose = autoClose;
        this.closeDelay = closeDelay;
        this.autoRefresh = autoRefresh;
        this.refreshInterval = refreshInterval;
        this.verbose = verbose;

        try {
            // bikin axios client
            const [accessToken, validCookies] = await getAccessToken({
                baseCookies: this.cookies,
                proxy: this.proxy,
                verbose: this.verbose
            });
            this.client = axios.create({
                timeout: this.timeout,
                proxy: this.proxy || false,
                headers: {
                    ...Headers.GEMINI,
                    Cookie: this._cookiesToHeader(),
                },
                // axios ga punya cookies built-in, jadi manual via header
                withCredentials: true
            });

            this.accessToken = accessToken;
            this.cookies = validCookies;
            this.running = true;
            console.log()

            this.timeout = timeout;
            this.autoClose = autoClose;
            this.closeDelay = closeDelay;
            if (this.autoClose) {
                await this.resetCloseTask();
            }

            this.autoRefresh = autoRefresh;
            this.refreshInterval = refreshInterval;

            if (rotateTasks.has(this.cookies["__Secure-1PSID"])) {
                clearInterval(rotateTasks.get(this.cookies["__Secure-1PSID"]));
                rotateTasks.delete(this.cookies["__Secure-1PSID"]);
            }

            // bikin task baru
            if (this.autoRefresh) {
                const task = setInterval(() => {
                        this.startAutoRefresh().catch((err) => {
                        if (this.verbose) logger.warn("Auto refresh failed", err);
                    });
                }, this.refreshInterval);

                rotateTasks.set(this.cookies["__Secure-1PSID"], task);
            }

            if (verbose) {
                logger.log("Gemini client initialized successfully.");
            }
        } catch (err) {
            await this.close();
            throw new Error(err);
        }
    }
    async close(delay = 0) {
    // tunggu sesuai delay (detik → ms)
        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        }

        this.running = false;

        if (this.closeTask) {
            clearTimeout(this.closeTask);
            this.closeTask = null;
        }

        if (this.client) {
            if (typeof this.client.close === "function") {
                await this.client.close();
            }
            this.client = null;
        }

        if (this.verbose) {
            logger.log("Gemini client closed.");
        }
    }

    async resetCloseTask() {
        if (this.closeTask) {
            clearTimeout(this.closeTask);
            this.closeTask = null;
        }
        this.closeTask = setTimeout(() => {
            this.close().catch((err) => {
                if (this.verbose) logger.warn("Close task failed", err);
            });
        }, this.closeDelay);
    }

    _cookiesToHeader() {
        return Object.entries(this.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }

    async startAutoRefresh() {
        while (true) {
            let new1PSIDTS = null;
            try {
                new1PSIDTS = await rotate1PSIDTS(this.cookies, this.proxy);
            } catch (err) {
                if (err.name === "AuthError") {
                    const task = rotateTasks.get(this.cookies["__Secure-1PSID"]);
                    if (task) {
                        clearInterval(task);
                    }
                    logger.warn("Failed to refresh cookies. Background auto refresh task canceled.");
                } else {
                    throw err;
                }
            }
            logger.debug(`Cookies refreshed. New __Secure-1PSIDTS: ${new1PSIDTS}`);
            if (new1PSIDTS !== null) {
                this.cookies["__Secure-1PSIDTS"] = new1PSIDTS;
            }
            await new Promise(resolve => setTimeout(resolve, this.refreshInterval));
        }
    }

    async generateContent({
        prompt,
        files = [],
        model = Model.UNSPECIFIED,
        gem = null,
        chat = null,
        options = {},
    }) {
        // console.log(gem.id);
        if (!prompt) throw new Error("Prompt cannot be empty.");

        // console.log("Here 1")
        if (!(model instanceof Model)) {
            // console.log("Here 1a");
            // console.log(Model.fromName("gemini-2.5-pro"));
            model = Model.fromName(model);
            // console.log(model)
            // console.log("Here 1b");
        }

        // console.log("Here 2");
        const gemId = gem instanceof Gem ? gem.id : gem;
        // console.log("Here 3");

        if (this.autoClose) {
            await this.resetCloseTask();
        }

        let uploadedFiles = [];
        if (files && files.length > 0) {
                for (const filePath of files) {
                    const uploadId = await uploadFile(filePath);
                    uploadedFiles.push([[uploadId], path.basename(filePath)]);
            }
        }

        const promptPart = uploadedFiles.length > 0  ? [prompt, 0, null, uploadedFiles] : [prompt];

        const innerArray = [promptPart, null, (chat && chat.metadata) ? chat.metadata : null];

        if (gemId) {
            innerArray.push(...new Array(16).fill(null));
            innerArray.push(gemId);
        }

        const innerJson = JSON.stringify(innerArray);
        const outerJson = JSON.stringify([null, innerJson]);

        const data = {
            at: this.accessToken,
            'f.req': outerJson
        };
        // console.log(data);
        let response;
        // console.log("Model header", model.modelHeader);
        try {
            // console.log("Here 2");
            response = await this.client.post(
                Endpoint.GENERATE,
                new URLSearchParams(data),
                {
                    headers: { ...model.modelHeader, Cookie: this._cookiesToHeader()}, 
                    timeout: this.timeout,
                }
            );
            // console.log(response);
            // console.log("Here 2a");
        } catch (err) {
            if (err.code === "ECONNABORTED") {
                throw new TimeoutError(
                    "Generate content request timed out. Try again or increase `timeout` in GeminiClient."
                );
            }
            throw err;
        }

        if (response.status !== 200) {
            await this.close();
            throw new APIError(`Failed to generate contents. Status: ${response.status}`);
        }

        let responseJson;
        try {
            const lines = response.data.split("\n");
            responseJson = JSON.parse(lines[2]);
        } catch (err) {
            await this.close();
            throw new APIError("Failed to parse response. Invalid format.");
        }

        // console.log("Res json", responseJson);
        let body = null;
        let bodyIndex = 0;
        for (let partIndex = 0; partIndex < responseJson.length; partIndex++) {
            try {
                const mainPart = JSON.parse(responseJson[partIndex][2]);
                // console.log(mainPart);
                if (mainPart[4]) {
                    bodyIndex = partIndex;
                    body = mainPart;
                    break;
                } 
            } catch (err) {
                continue
            }
        }

        if (!body) {
            await this.close();

            try {
                const errCode = ErrorCode(responseJson[0][5][2][0][1][0]);
                switch (errCode) {
                    case ErrorCode.USAGE_LIMIT_EXCEEDED:
                        throw new UsageLimitExceeded(
                            `Usage limit of ${model.modelName} exceeded. Try another model.`
                        );
                    case ErrorCode.MODEL_INCONSISTENT:
                        throw new ModelInvalid(
                            "Failed to generate contents. The specified model is inconsistent with the chat history. Please make sure to pass the same `model` parameter when starting a chat session with previous metadata."
                        );
                    case ErrorCode.MODEL_HEADER_INVALID:
                        throw new ModelInvalid(
                            "Failed to generate contents. The specified model is not available. Please update gemini_webapi to the latest version. If the error persists and is caused by the package, please report it on GitHub."
                        );
                    case ErrorCode.IP_TEMPORARILY_BLOCKED:
                        throw new TemporarilyBlocked(
                            "Failed to generate contents. Your IP address is temporarily blocked by Google. Please try using a proxy or waiting for a while."
                        );
                    default:
                        throw new APIError("Failed to generate contents. Invalid response.");
                }
            } catch (e) {
                if (e instanceof GeminiError) throw e;
                logger.debug("Invalid response:", response.data);
                throw new APIError("Invalid response. Client will re-initialize on next request.");
            }
        }

        

        try {
            const candidates = [];
            for (let candidateIndex = 0; candidateIndex < body[4].length; candidateIndex++) {
                const candidate = body[4][candidateIndex];
                let text = candidate[1][0];

                if (/^http:\/\/googleusercontent\.com\/card_content\/\d+/.test(text)) {
                    text = (candidate[22] && candidate[22][0]) || text;
                }

                let thoughts = null;
                try {
                    thoughts = candidate[37][0][0];
                } catch {}

                const webImages = candidate[12]?.[1]?.map(webImage =>
                    new WebImage({
                        url: webImage?.[0]?.[0]?.[0],
                        title: webImage?.[7]?.[0],
                        alt: webImage?.[0]?.[4],
                        proxy: this.proxy
                    })
                ) ?? [];

                let generatedImages = [];
                if (candidate[12] && candidate[12][7] && candidate[12][7][0]) {
                    let imgBody = null;
                    for (let imgPartIndex = bodyIndex; imgPartIndex < responseJson.length; imgPartIndex++) {
                        try {
                            const imgPart = JSON.parse(responseJson[imgPartIndex][2]);
                            if (imgPart[4][candidateIndex][12][7][0]) {
                                imgBody = imgPart;
                                break;
                            }
                        } catch {}
                        }

                    if (!imgBody) {
                        throw new ImageGenerationError("Failed to parse generated images.");
                    }

                    const imgCandidate = imgBody[4][candidateIndex];
                        text = text.replace(
                        /http:\/\/googleusercontent\.com\/image_generation_content\/\d+/,
                        ""
                    ).trim();

                    generatedImages = imgCandidate[12][7][0].map((generatedImage, imageIndex) =>
                        new GeneratedImage({
                            url: generatedImage[0][3][3],
                            title: generatedImage[3][6]
                            ? `[Generated Image ${generatedImage[3][6]}]`
                            : "[Generated Image]",
                            alt: (generatedImage[3][5] && generatedImage[3][5][imageIndex])
                            || (generatedImage[3][5] && generatedImage[3][5][0])
                            || "",
                            proxy: this.proxy,
                            cookies: this.cookies
                        })
                    );
                }

                candidates.push(
                    new Candidate({
                        rcid: candidate[0],
                        text,
                        thoughts,
                        webImages,
                        generatedImages
                    })
                );
            }

            if (candidates.length === 0) {
                throw new GeminiError("No output candidates found in response.");
            }

            const output = new ModelOutput({ metadata: body[1], candidates });
            // console.log(output);
            if (chat instanceof ChatSession) {
                chat.lastOutput = output;
            }

            return output;
        } catch (err) {
            logger.debug("Invalid response:", response.data);
            throw new APIError("Failed to parse response body. Data structure is invalid.");
        }
    }

    startChat(options = {}) {
        return new ChatSession({
            geminiClient: this,
            ...options
        });
    }

    async _batchExecute(payloads, extraOptions = {}) {
        // console.log(payloads);
        try {
            const fReq = JSON.stringify([
                payloads.map((payload) => payload.serialize())
            ]);

            const response = await this.client.post(
                Endpoint.BATCH_EXEC,
                new URLSearchParams({
                    at: this.accessToken,
                    "f.req": fReq
                }),
                {
                    headers: { Cookie: this._cookiesToHeader() },
                    timeout: this.timeout,
                    validateStatus: () => true,
                    ...extraOptions
                }
            );

            if (response.status !== 200) {
                await this.close();
                throw new APIError(
                    `Batch execution failed with status code ${response.status}`
                );
            }

            return response;
        } catch (err) {
            if (err.code === "ECONNABORTED") {
            throw new TimeoutError(
                "Batch execute request timed out, please try again. If the problem persists, set a higher `timeout` in GeminiClient."
            );
            }
            throw err;
        }
    }
}

class ChatSession {
    constructor({
        geminiClient,
        metadata = null,
        cid = null,
        rid = null,
        rcid = null,
        model = Model.UNSPECIFIED,
        gem = null,
    }) {
        this._metadata = [null, null, null];
        this.geminiClient = geminiClient;
        this.lastOutput = null;
        this.model = model;
        this.gem = gem;

        if (metadata) this.metadata = metadata;
        if (cid) this.cid = cid;
        if (rid) this.rid = rid;
        if (rcid) this.rcid = rcid;
    }

    toString() {
        return `ChatSession(cid='${this.cid}', rid='${this.rid}', rcid='${this.rcid}')`;
    }

    // ------------------ properties ------------------
    get metadata() {
        return this._metadata;
    }

    set metadata(value) {
        if (value.length > 3) {
            throw new Error("metadata cannot exceed 3 elements");
        }
        for (let i = 0; i < value.length; i++) {
            this._metadata[i] = value[i];
        }
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

    get encryptedMetadata() {
        return encryptMd(this.metadata);
    }

    get lastOutput() {
        return this._lastOutput;
    }

    set lastOutput(value) {
        this._lastOutput = value;

        if (value instanceof ModelOutput) {
            this.metadata = value.metadata;
            this.rcid = value.rcid;
        }
    }

    // ------------------ methods ------------------
    async sendMessage(prompt, files = null, extraOptions = {}) {
        if (!prompt) throw new Error("Prompt cannot be empty.");
        

        return await this.geminiClient.generateContent({
            prompt,
            files,
            model: this.model,
            gem: this.gem,
            chat: this,
            ...extraOptions,
        });
    }

    chooseCandidate(index) {
        if (!this.lastOutput) {
        throw new Error("No previous output data found in this chat session.");
        }

        if (index >= this.lastOutput.candidates.length) {
            throw new Error(
                `Index ${index} exceeds candidates count in last model output.`
            );
        }

        this.lastOutput.chosen = index;
        this.rcid = this.lastOutput.rcid;
        return this.lastOutput;
    }

    // setter khusus untuk lastOutput agar otomatis update metadata & rcid
    setLastOutput(output) {
        this.lastOutput = output;
        if (output && output.metadata) {
            this.metadata = output.metadata;
        }
        if (output && output.rcid) {
            this.rcid = output.rcid;
        }
    }
}

export { GeminiClient, ChatSession };