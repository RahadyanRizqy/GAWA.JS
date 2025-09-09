import * as html from 'html-escaper';
import { WebImage, GeneratedImage } from './images.js';

class Candidate {
    constructor({ rcid, text, thoughts = null, webImages = [], generatedImages = [] }) {
        this.rcid = rcid;

        // decode HTML
        this.text = text ? html.unescape(text) : '';
        this.thoughts = thoughts ? html.unescape(thoughts) : null;

        this.webImages = webImages;
        this.generatedImages = generatedImages;
    }

    get images() {
        return [...this.webImages, ...this.generatedImages];
    }

    toString() {
        return this.text;
    }

    toJSON() {
        const shortText = this.text.length <= 20 ? this.text : this.text.slice(0, 20) + '...';
        return {
            rcid: this.rcid,
            text: shortText,
            images: this.images
        };
    }
}

class ModelOutput {
    constructor({ metadata, candidates, chosen = 0 }) {
        this.metadata = metadata; // array of strings
        this.candidates = candidates; // array of Candidate instances
        this.chosen = chosen;
    }

    get text() {
        return this.candidates[this.chosen].text;
    }

    get thoughts() {
        return this.candidates[this.chosen].thoughts;
    }

    get images() {
        return this.candidates[this.chosen].images;
    }

    get rcid() {
        return this.candidates[this.chosen].rcid;
    }

    toString() {
        return this.text;
    }

    toJSON() {
        return {
            metadata: this.metadata,
            chosen: this.chosen,
            candidates: this.candidates,
        };
    }
}

export { Candidate, ModelOutput };