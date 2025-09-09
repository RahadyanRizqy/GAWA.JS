import { APIError, ImageGenerationError } from './errors.js';
function running(retry = 0) {
    return function (func) {
        async function wrapper(...args) {
            try {
                if (!this.running) {
                    await this.init({
                        timeout: this.timeout,
                        autoClose: this.autoClose,
                        closeDelay: this.closeDelay,
                        autoRefresh: this.autoRefresh,
                        refreshInterval: this.refreshInterval,
                        verbose: false
                    });

                    if (this.running) {
                        return await func(...args);
                    }

                    throw new APIError(
                        `Invalid function call: GeminiClient.${func.__name__}. Client initialization failed.`
                    )
                } else {
                    return await func(...args);
                }
            } catch (e) {
                if (e instanceof ImageGenerationError) {
                    retry = Math.min(1, retry);
                }

                if (retry > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await wrapper(...args, retry - 1);
                }

                throw e;
            }
        }
        return wrapper;
    };
}

export { running };