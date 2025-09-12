import winston from "winston";

let defaultLevel = "debug"

const setLogLevel = (level) => {
    defaultLevel = level;
}

const logger = winston.createLogger({
    level: defaultLevel,
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} | ${level.toUpperCase()} | ${message}`;
        })
    ),
    transports: [new winston.transports.Console()],
});

export { logger, setLogLevel };