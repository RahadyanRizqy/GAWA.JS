import { GeminiClient, Model } from 'gawa.js';
import path from 'path';
import { setDefaultKey } from 'gawa.js/cryptmd';

setDefaultKey('mykey');

async function main() {
    const client = new GeminiClient({
        cookieHeader: 'SAPISID=8mQ--_8VFfAA4cUF/AkEbsIK97mSZlKrFq;__Secure-3PAPISID=8mQ--_8VFfAA4cUF/AkEbsIK97mSZlKrFq;_gcl_au=1.1.1460434958.1757396039;AEC=AVh_V2guW6BVU8EQOmTZng8yl94dVXkZE8OcBs2RFIAjNt9HT7dyJxqoZnM;_ga_WC57KJ50ZZ=GS2.1.s1757511328$o4$g1$t1757516380$j59$l0$h0;NID=525=IfTPN-_IrUKl-REhu5tgYQWm9I6CCoW4mXk9CYwnpIRT83uIg-vWoMQbKCyH_sYAd-MJgH8toGhMr2aauSdnU5DxdKq3t8abEsua4JBD45dVqnlMNL0nv-JuFabokOsFfDybLkJaSN2GV2Ci9CAYDoR0ZT9GDaEsSQYd7xyCej95T75DWZYj0dQHvgWxp7B-Ko-CZXeebEdz9HYEjEoNql2Nf3fhcueZAuBhmQH8qncmleTUcCAq-muK52bnl1xRRiBL4an_eKmaleVhprTgp65gipoBRYB3qn-RKsLPDaiGWy0VANx1T35eZH9xp7CQxxJvBdzUH_3fZ9fiY_UPH18-C_7NSBKBEf4QCE0pmC_UqP5ywFXOdmcu0IpIExDyrXYBZYb1eF7TNYH5tc9fl_CKhX6aQdAyk9P1M_D6vFMFre-KllztLafyJ42x_QGklksG4TmvW-GORRkyAydw_73Wo1-4V8fbHes6C1GOgfRBRvQybyPnHXA88s_83ReGf97mGtdsKu55TyIjQzuz1Oq2NbW6yK_xqE8FTvq106waD4je3LUzmrxIVl0HQfMORAJZ4zD9h9GKlrFW3fZjIDVLv0VHmQfpiVJUfawwufe5Oh2AnxjN-lAAi2xxYF7Ee6sAKOu7kB1ad1xlQIN5cqyZzrWxcAZV66kX6eY0UISSUVNanuN2GZ0;APISID=bYPOuT8_8ilE43pR/AXlt5-bXkekw5LQP8;_gcl_dc=GCL.1757508978.Cj0KCQjww4TGBhCKARIsAFLXndQSQGLD-jvuopDa-V-FYmKPZP-QagB-sAkvmb0JumTBFh7lz8jRrT0aAoIsEALw_wcB;__Secure-1PSIDTS=sidts-CjcB5H03P0wPT7aLnhgB0XuZCbHEbMZ9s1f7VHlm4y9rV68msCCjsyShBUO6zIHoJIW-q_hFnumFEAA;__Secure-1PAPISID=8mQ--_8VFfAA4cUF/AkEbsIK97mSZlKrFq;__Secure-3PSID=g.a0001AjbSU2D9Bbk5Km2UEaVzh2L_B7CRZbDRJ6nqVS5O0NRnDGtjA_tHpgpaDG4CzDR-zHmDgACgYKAeYSARASFQHGX2MiuQMrrH2LA5UxJlHWclmOvRoVAUF8yKo3Ng0R4U1UnNdK6hdTfhf60076;__Secure-1PSID=g.a0001AjbSU2D9Bbk5Km2UEaVzh2L_B7CRZbDRJ6nqVS5O0NRnDGts_cRLHBl0t5MrklG-MBFYwACgYKASMSARASFQHGX2MijbXpz1xJgFOtZjMr1MoU7BoVAUF8yKoTlE0a2qbFdE8ieLFMgzHK0076;__Secure-1PSIDCC=AKEyXzUWYNtVG2u1Z9B7GcEHUqWVT1K7O3bVFwvHJaYH6ONeQq7PQ5y-b8zjjPlqgiTremjwB6s;__Secure-1PSIDRTS=sidts-CjcB5H03P0wPT7aLnhgB0XuZCbHEbMZ9s1f7VHlm4y9rV68msCCjsyShBUO6zIHoJIW-q_hFnumFEAA;__Secure-3PSIDCC=AKEyXzVZ6oBJoDWBldKMwOkIAqRRpXNjOmbCyaPAFLJ-cmKPkTosSoLSW0DbdzMTZcHCn_Ewhg;__Secure-3PSIDRTS=sidts-CjcB5H03P0wPT7aLnhgB0XuZCbHEbMZ9s1f7VHlm4y9rV68msCCjsyShBUO6zIHoJIW-q_hFnumFEAA;__Secure-3PSIDTS=sidts-CjcB5H03P0wPT7aLnhgB0XuZCbHEbMZ9s1f7VHlm4y9rV68msCCjsyShBUO6zIHoJIW-q_hFnumFEAA;_ga=GA1.1.1639420910.1757396039;_gcl_aw=GCL.1757508978.Cj0KCQjww4TGBhCKARIsAFLXndQSQGLD-jvuopDa-V-FYmKPZP-QagB-sAkvmb0JumTBFh7lz8jRrT0aAoIsEALw_wcB;_gcl_gs=2.1.k1$i1757508962$u18075439;HSID=AI2ZgRzoRyTJpC58Q;SEARCH_SAMESITE=CgQI9J4B;SID=g.a0001AjbSU2D9Bbk5Km2UEaVzh2L_B7CRZbDRJ6nqVS5O0NRnDGtM0ib3fbebL111w4I_zi41AACgYKAa8SARASFQHGX2MiOFTWhI3akfPHMOZ__l5C5RoVAUF8yKog2PL0fRBIQ2M3pSdZa2w40076;SIDCC=AKEyXzUn3kODPPeb-YDIvg3jld4-O6nOfiIdLCjLWUXCnn8_ngeZG27XLk4MWxjoLsi_exMfYQ;SSID=AzTRwkapOD1UhN_r3'
    });

    await client.init();

// 1. Generate content
    console.log('==========1. Generate content==========');
    const response1 = await client.generateContent({ prompt: 'Hello' });
    console.log(response1.text);

// 2. Generate content with files
    console.log('==========2. Generate content with files==========');
    const response2 = await client.generateContent({ prompt: 'Explain this image', files: [path.resolve('./alligator.png')] });
    console.log(response2.text);

// 3. Conversation across multiple turns
    console.log('==========3. Conversation across multiple turns==========');
    const chat1 = client.startChat();
    const response3_1 = await chat1.sendMessage('What is the capital of Russia');
    console.log(response3_1.text);
    const response3_2 = await chat1.sendMessage('And what is the population?');
    console.log(response3_2.text);

// 4. Conversation with metadata (previous session)
    console.log('==========4. Conversation with metadata (previous session)==========');
    const chat2 = client.startChat({ metadata: null });
    const response4_1 = await chat2.sendMessage('Fine weather today');
    console.log(response4_1.text);

    // Save previous session metadata and resume
    const prevChat2 = client.startChat({ metadata: chat2.metadata });
    const response4_2 = await prevChat2.sendMessage('What was my previous message?');
    console.log(response4_2.text);

// 5. Select language model
    console.log('==========5. Select language model==========');
    const response5_1 = await client.generateContent({
        prompt: "What's your language model version? Reply version number only.",
        model: Model.G_2_5_FLASH,
    });
    console.log(`Model version (${Model.G_2_5_FLASH.modelName}): ${response5_1.text}`);

    const chat3 = client.startChat({ model: 'gemini-2.5-flash' });
    const response5_2 = await chat3.sendMessage("What's your language model version? Reply version number only.");
    console.log(`Model version (gemini-2.5-flash): ${response5_2.text}`);

// 6. Create a custom gem
    console.log('==========6. Create a custom gem==========');
    const newGem = await client.createGem('Python Tutor', 'You are a helpful Python programming tutor.', 'A specialized gem for Python programming');
    console.log(`Custom gem created: ${newGem.toString()}`);
    console.log(`Custom gemId: ${newGem.id}`);

    const response6 = await client.generateContent({
        prompt: 'Explain how list comprehensions work in Python',
        gem: newGem,
    });
    console.log(response6.text);

// 7. Apply system prompt with Gemini Gems
    console.log('==========7. Apply system prompt with Gemini Gems==========');
    await client.fetchGems({ includeHidden: false });
    const gems = client.gems;
    const systemGems = gems.filter({ predefined: false });
    console.log(systemGems.get({id: newGem.id}));
    const codingPartner = systemGems.get({id: newGem.id});
    const response7 = await client.generateContent({
        prompt: "what's your system prompt?",
        model: Model.G_2_5_FLASH,
        gem: codingPartner,
    });
    console.log(response7.text);

// 8. Update a custom gem
    console.log('==========8. Update a custom gem==========');
    await client.fetchGems();
    const pythonTutor = client.gems.get({ name: 'Python Tutor'});
    console.log(pythonTutor);
    const updatedGem = await client.updateGem(pythonTutor, 'Dumb Python Tutor', 'You are not an expert Python programming tutor.', 'An advanced Python programming assistant');
    console.log(`Custom gem updated: ${updatedGem.toString()}`);

// 9. Delete a custom gem
    console.log('==========9. Delete a custom gem==========');
    await client.fetchGems();
    const gemToDelete = client.gems.get({ name: 'Dumb Python Tutor'});
    if (gemToDelete) {
        await client.deleteGem(gemToDelete);
        console.log(`Custom gem deleted: ${gemToDelete.name}`);
    }

// 10. Retrieve model's thought process
    console.log('==========10. Retrieve model\'s thought process==========');
    const response10 = await client.generateContent({ prompt: "What's 1+1?", model: 'gemini-2.5-flash' });
    console.log(response10.thoughts);
    console.log(response10.text);

// 11. Retrieve images in response
    console.log('==========11. Retrieve images in response==========');
    const response11 = await client.generateContent({ prompt: 'Send me some pictures of cats' });
    // console.log(response11);
    for (const image of response11.images) {
        console.log(image, '\n\n----------------------------------\n');
    }

// 12. Generate images with imagen4
    console.log('==========12. Generate images with imagen4==========');
    const response12 = await client.generateContent({ prompt: 'Generate some pictures of cats' });
    for (let i = 0; i < response12.images.length; i++) {
        const img = response12.images[i];
        await img.save({ path: 'temp/', filename: `cat_${i}.png`, verbose: true });
        console.log(img, '\n\n----------------------------------\n');
    }

    // 13. Generate contents with Gemini extensions
    console.log('==========13. Generate contents with Gemini extensions==========');
    const response13_1 = await client.generateContent({ prompt: "@Gmail What's the latest message in my mailbox?" });
    console.log(response13_1, '\n\n----------------------------------\n');
    const response13_2 = await client.generateContent({ prompt: "@Youtube What's the latest activity of Taylor Swift?" });
    console.log(response13_2, '\n\n----------------------------------\n');

// 14. Check and switch to other reply candidates
    console.log('==========14. Check and switch to other reply candidates==========');
    const chat5 = client.startChat();
    const response14 = await chat5.sendMessage('Recommend a science fiction book for me.');
    for (const candidate of response14.candidates) {
        console.log(candidate, '\n\n----------------------------------\n');
    }
    if (response14.candidates.length > 1) {
        const newCandidate = chat5.chooseCandidate(1);
        const followupResponse = await chat5.sendMessage('Tell me more about it.');
        console.log(newCandidate, followupResponse, '\n\n----------------------------------\n\n');
    } else {
        console.log('Only one candidate available.');
    }
}

// Run the test
main().catch(console.error);