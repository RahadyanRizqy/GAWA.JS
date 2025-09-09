export { GeminiClient, ChatSession } from './main.js';
export { Model } from './model.js';
export { ChatSession as ChatSessionAlias } from './main.js'; // if needed
export {
    AuthError,
    APIError,
    GeminiError,
    TimeoutError,
    UsageLimitExceeded,
    ModelInvalid,
    TemporarilyBlocked,
    ImageGenerationError
} from '../utils/errors.js';
export { setLogLevel } from '../utils/logger.js';