const Endpoint = {
    GOOGLE: 'https://www.google.com',
    INIT: 'https://gemini.google.com/app',
    GENERATE: 'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate',
    ROTATE_COOKIES: 'https://accounts.google.com/RotateCookies',
    UPLOAD: 'https://content-push.googleapis.com/upload',
    BATCH_EXEC: 'https://gemini.google.com/_/BardChatUi/data/batchexecute'
};

const Headers = {
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

const ErrorCode = {
    USAGE_LIMIT_EXCEEDED: 1037,
    MODEL_INCONSISTENT: 1050,
    MODEL_HEADER_INVALID: 1052,
    IP_TEMPORARILY_BLOCKED: 1060
};

const GRPC = {
    // Chat methods
    READ_CHAT: 'hNvQHb',

    // Gem methods
    LIST_GEMS: 'CNgdBe',
    CREATE_GEM: 'oMH3Zd',
    UPDATE_GEM: 'kHv0Vd',
    DELETE_GEM: 'UXcSJb'
};

export { Endpoint, Headers, ErrorCode, GRPC };