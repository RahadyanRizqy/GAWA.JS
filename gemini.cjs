// Main entry point for gawa.js
// This file bridges ES modules to CommonJS for easier usage

async function loadModules() {
    const [
        { GeminiClient, ChatSession },
        { Model },
        {
            AuthError,
            APIError,
            GeminiError,
            TimeoutError,
            UsageLimitExceeded,
            ModelInvalid,
            TemporarilyBlocked,
            ImageGenerationError
        },
        { setLogLevel }
    ] = await Promise.all([
        import('./src/core/main.js'),
        import('./src/core/model.js'),
        import('./src/utils/errors.js'),
        import('./src/utils/logger.js')
    ]);

    return {
        GeminiClient,
        ChatSession,
        Model,
        AuthError,
        APIError,
        GeminiError,
        TimeoutError,
        UsageLimitExceeded,
        ModelInvalid,
        TemporarilyBlocked,
        ImageGenerationError,
        setLogLevel
    };
}

// For synchronous require() usage, we'll export a promise
const modulePromise = loadModules();

module.exports = modulePromise;