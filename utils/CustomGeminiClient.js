// utils/CustomGeminiClient.js
const { GeminiClient } = require('./GeminiClient.js');

class CustomGeminiClient extends GeminiClient {
    async getAccessToken(baseCookies, verbose = false) {
        console.log('Using custom getAccessToken - skipping browser cookie extraction');
        
        const tasks = [];
        
        // Only use the provided cookies, skip browser cookie extraction
        if (baseCookies['__Secure-1PSID'] && baseCookies['__Secure-1PSIDTS']) {
            tasks.push(this.sendAuthRequest({...baseCookies}));
        } else if (verbose) {
            console.debug("Skipping loading base cookies. Either __Secure-1PSID or __Secure-1PSIDTS is not provided.");
        }
        
        // Execute auth attempts
        for (let i = 0; i < tasks.length; i++) {
            try {
                const [response, requestCookies] = await tasks[i];
                const match = response.data.match(/"SNlM0e":"(.*?)"/);
                if (match) {
                    if (verbose) {
                        console.debug(`Init attempt (${i + 1}/${tasks.length}) succeeded. Initializing client...`);
                    }
                    return [match[1], requestCookies];
                } else if (verbose) {
                    console.debug(`Init attempt (${i + 1}/${tasks.length}) failed. Cookies invalid.`);
                }
            } catch (error) {
                if (verbose) {
                    console.debug(`Init attempt (${i + 1}/${tasks.length}) failed with error: ${error.message}`);
                }
            }
        }
        
        throw new Error(
            "Failed to initialize client. Please check your cookie values."
        );
    }
}

module.exports = { CustomGeminiClient };