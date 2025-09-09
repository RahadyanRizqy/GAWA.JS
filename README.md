# Gemini AI Wrapper API (JavaScript Version)
<p align="center">
    <img src="https://raw.githubusercontent.com/RahadyanRizqy/GAWA.JS/refs/heads/main/assets/gawa-js.png" width="75%" alt="Gemini Banner" align="center">
</p>

# <img src="https://raw.githubusercontent.com/RahadyanRizqy/GAWA.JS/refs/heads/main/assets/icon.png" width="35px" alt="Gemini Icon" /> Gemini-API

A JavaScript implementation of the Gemini AI Wrapper API, providing Node.js modules. This project is a remake of the original Python version available at [HanaokaYuzu/Gemini-API](https://github.com/HanaokaYuzu/Gemini-API.git).

## 🚀 Features
- **Persistent Cookies** - Automatically refreshes cookies in background. Optimized for always-on services (currently tested).
- **Image Generation** - Natively supports generating and modifying images with natural language.
- **System Prompt** - Supports customizing model's system prompt with [Gemini Gems](https://gemini.google.com/gems/view).
- **Extension Support** - (_unimplemented yet_)
- **Classified Outputs** - Categorizes texts, thoughts, web images and AI generated images in the response.
- **Official Flavor** - Provides a simple and elegant interface inspired by [Google Generative AI](https://ai.google.dev/tutorials/python_quickstart)'s official API.

## 📋 Prerequisites
- Node.js (v22+)
- Cloudflare account with Wrangler CLI
- Google Gemini cookies (for authentication)
- Cloudflare D1 database (for token revocation)

## 🛠️ Installation
1. **Clone the repository**
   ```bash
   git clone <repository-url> gawajs
   cd gawajs
   ```

2. **Install dependencies**
   ```bash
   npm install

## ✨ Usage

### Basic Setup

```javascript
import gawa from 'gawa.js';

const { GeminiClient } = await gawa;

const client = new GeminiClient({
    cookieHeader: 'your-cookie-header-here'
});

await client.init();
```

### Generate Content

```javascript
// Simple text generation
const response = await client.generateContent({ prompt: 'Hello' });
console.log(response.text);

// With files
const response = await client.generateContent({
    prompt: 'Explain this image',
    files: [path.resolve('./image.jpg')]
});
console.log(response.text);
```

### Chat Conversations

```javascript
const chat = client.startChat();
const response1 = await chat.sendMessage('What is the capital of Russia?');
console.log(response1.text);

const response2 = await chat.sendMessage('And what is the population?');
console.log(response2.text);
```

### Using Different Models

```javascript
const response = await client.generateContent({
    prompt: "What's your language model version?",
    model: 'gemini-2.5-flash'
});
console.log(response.text);
```

### Creating Custom Gems

```javascript
const newGem = await client.createGem(
    'Python Tutor',
    'You are a helpful Python programming tutor.',
    'A specialized gem for Python programming'
);

const response = await client.generateContent({
    prompt: 'Explain how list comprehensions work in Python',
    gem: newGem
});
console.log(response.text);
```

### Handling Images

```javascript
const response = await client.generateContent({
    prompt: 'Generate some pictures of cats'
});

for (const image of response.images) {
    await image.save({ path: 'temp/', filename: `cat.png` });
}
```

For more advanced usage, see [`test-gawa.js`](test-gawa.js).

## 🔗 References
- [HanaokaYuzu/Gemini-API](https://github.com/HanaokaYuzu/Gemini-API.git)
- [Google AI Studio](https://ai.google.dev/tutorials/ai-studio_quickstart)
- [acheong08/Bard](https://github.com/acheong08/Bard)
