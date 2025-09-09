class AuthError extends Error {
    constructor(message) {
        super(message || 'Authentication error');
        this.name = 'AuthError';
    }
}

class APIError extends Error {
    constructor(message) {
        super(message || 'API error');
        this.name = 'APIError';
    }
}

class ImageGenerationError extends APIError {
    constructor(message) {
        super(message || 'Image generation error');
        this.name = 'ImageGenerationError';
    }
}

class GeminiError extends Error {
    constructor(message) {
        super(message || 'Gemini error');
        this.name = 'GeminiError';
    }
}

class TimeoutError extends GeminiError {
    constructor(message) {
        super(message || 'Request timeout');
        this.name = 'TimeoutError';
    }
}

class UsageLimitExceeded extends GeminiError {
    constructor(message) {
        super(message || 'Usage limit exceeded');
        this.name = 'UsageLimitExceeded';
    }
}

class ModelInvalid extends GeminiError {
    constructor(message) {
        super(message || 'Model invalid');
        this.name = 'ModelInvalid';
    }
}

class TemporarilyBlocked extends GeminiError {
    constructor(message) {
        super(message || 'Temporarily blocked');
        this.name = 'TemporarilyBlocked';
    }
}

export {
    AuthError,
    APIError,
    ImageGenerationError,
    GeminiError,
    TimeoutError,
    UsageLimitExceeded,
    ModelInvalid,
    TemporarilyBlocked
};