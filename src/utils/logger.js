import Logger from 'js-logger';

const logger = Logger;  // use logger as alias from Logger

logger.useDefaults();
logger.setLevel(logger.DEBUG);

export default logger;
