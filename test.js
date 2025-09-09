import gawa from 'gawa.js';
import path from 'path';
import cookie from 'cookie';
import { decryptmd, setDefaultKey } from 'gawa.js/cryptmd';

setDefaultKey('mykey');

async function main() {
    // Wait for the ES modules to load
    const { GeminiClient } = await gawa;

    const client = new GeminiClient({
        cookieHeader: '' // paste your header string based cookies from CookieEditor extension here
    });

    await client.init();

// 1. Generate content
    console.log('==========1. Generate content==========');
    const response1 = await client.generateContent({ prompt: 'Hello' });
    console.log(response1.text);
}

// Run the test
main().catch(console.error);