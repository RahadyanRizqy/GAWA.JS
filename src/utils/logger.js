import util from 'util';
let _handler_id = null;
let _logLevel = "INFO";
const LEVELS = ["TRACE", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

function shouldLog(level) {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(_logLevel);
}

function setLogLevel(level) {
    if (!LEVELS.includes(level)) {
        throw new Error(`Invalid log level: ${level}`);
    }
    _logLevel = level;
    console.log(`Log level set to ${level}`);
}

function getLogger(name = "gemini_webapi") {
    return {
        log(level, message, ...args) {
            if (shouldLog(level)) {
                const formatted = `[${level}] [${name}] ${util.format(message, ...args)}`;
                if (level === "ERROR" || level === "CRITICAL") {
                    console.error(formatted);
                } else {
                    console.log(formatted);
                }
            }
        },
        trace(msg, ...args) { this.log("TRACE", msg, ...args); },
        debug(msg, ...args) { this.log("DEBUG", msg, ...args); },
        info(msg, ...args) { this.log("INFO", msg, ...args); },
        warn(msg, ...args) { this.log("WARNING", msg, ...args); },
        error(msg, ...args) { this.log("ERROR", msg, ...args); },
        critical(msg, ...args) { this.log("CRITICAL", msg, ...args); },
    };
}

let logger = getLogger("gemini_webapi");

export { setLogLevel, getLogger, logger };