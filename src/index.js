// gemini.js (ESM)
import * as core from "./core/main.js";
import * as model from "./core/model.js";
import * as errors from "./utils/errors.js";
import logger from "./utils/logger.js";

export const GeminiClient = core.GeminiClient;
export const ChatSession = core.ChatSession;
export const Model = model.Model;
export const {
    AuthError,
    APIError,
    GeminiError,
    TimeoutError,
    UsageLimitExceeded,
    ModelInvalid,
    TemporarilyBlocked,
    ImageGenerationError
} = errors;

export default logger;
