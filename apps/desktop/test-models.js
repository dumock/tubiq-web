require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No API key found in .env');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // There isn't a direct listModels method in the SDK main entry, 
        // usually it's supported via REST or specific endpoint. 
        // For the Node SDK, we often just try to use a model or check docs.
        // However, we can try to get a model and see if it throws immediately or on use.
        // Actually, the ModelService might expose listModels? 
        // Let's try to just instantiate the requested models and send a 'hello' to verify.

        const modelsToTest = [
            'gemini-3-pro',
            'gemini-3-flash',
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-exp',
            'gemini-1.5-pro'
        ];

        console.log('Testing models...');

        for (const modelName of modelsToTest) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Hello');
                const response = await result.response;
                console.log(`[PASS] ${modelName}:`, response.text().substring(0, 20) + '...');
            } catch (e) {
                console.log(`[FAIL] ${modelName}:`, e.message.split('\n')[0]);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

listModels();
