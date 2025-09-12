import { APIError, ImageGenerationError } from './errors.js';
import { logger } from './logger.js';

function running(maxRetry = 0) {
    return function (func) {
        async function wrapper(...args) {
        let retries = maxRetry;``
            while (retries >= 0) {
                try {
                    if (!this.running) {
                        await this.init({
                            timeout: this.timeout,
                            autoClose: this.autoClose,
                            closeDelay: this.closeDelay,
                            autoRefresh: this.autoRefresh,
                            refreshInterval: this.refreshInterval,
                            verbose: false,
                        });

                        if (!this.running) {
                            throw new APIError(
                                `Invalid function call: GeminiClient.${func.name}. Client initialization failed.`
                            );
                        }
                    }

                    return await func.apply(this, args);
                } catch (e) {
                    if (e instanceof ImageGenerationError) {
                        retries = Math.min(1, retries);
                    }
                    if (retries > 0) {
                        logger.info(`Retrying ${func.name}... (${retries} left)`);
                        retries--;
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                throw e;
                }
            }
        }

        return wrapper;
    };
}


export { running };