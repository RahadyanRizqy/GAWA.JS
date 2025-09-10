import { GeminiClient} from 'gawa.js';
import path from 'path';
import cookie from 'cookie';
import { decryptMd, setDefaultKey } from 'gawa.js/cryptmd';

setDefaultKey('mykey');

async function main() {
    const client = new GeminiClient({
        cookieHeader: '' // paste your header string based cookies from CookieEditor extension here
    });

    await client.init();

// 1. Generate content
    console.log('==========1. Generate content==========');
    const response1 = await client.generateContent({ prompt: 'Hello' });
    console.log(response1.text);
    console.log("\n");

// 2. Conversation with metadata (previous session)
    console.log('==========4. Conversation with metadata (previous session)==========');
    const chat2 = client.startChat({ metadata: null });

    console.log('Original Metadata', chat2.metadata);
    console.log('Encrypted Metadata', chat2.encryptedMetadata);
    console.log('Decrypted Metadata', decryptMd(chat2.encryptedMetadata));

    const response4_1 = await chat2.sendMessage('Fine weather today');
    console.log(response4_1.text);
    console.log("\n");

    // Save previous session metadata and resume
    const prevChat2 = client.startChat({ metadata: chat2.metadata });

    console.log('Original Metadata', prevChat2.metadata);
    console.log('Encrypted Metadata', prevChat2.encryptedMetadata);
    console.log('Decrypted Metadata', decryptMd(prevChat2.encryptedMetadata, 'mykey')); // secretKey isnt needed because already set in setDefaultKey

    const response4_2 = await prevChat2.sendMessage('What was my previous message?');
    console.log(response4_2.text);
    console.log("\n");
}

// Run the test
main().catch(console.error);