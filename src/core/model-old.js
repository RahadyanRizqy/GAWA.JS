class Model {
    static UNSPECIFIED = {
        modelName: 'unspecified',
        modelHeader: {},
        advancedOnly: false
    };

    static G_2_5_FLASH = {
        modelName: 'gemini-2.5-flash',
        modelHeader: {'x-goog-ext-525001261-jspb': '[1,null,null,null,"71c2d248d3b102ff",null,null,0,[4]]'},
        advancedOnly: false
    };

    static G_2_5_PRO = {
        modelName: 'gemini-2.5-pro',
        modelHeader: {'x-goog-ext-525001261-jspb': '[1,null,null,null,"4af6c7f5da75d65d",null,null,0,[4]]'},
        advancedOnly: false
    };

    static G_2_0_FLASH = {
        modelName: 'gemini-2.0-flash',
        modelHeader: {'x-goog-ext-525001261-jspb': '[1,null,null,null,"f299729663a2343f"]'},
        advancedOnly: false
    };

    static G_2_0_FLASH_THINKING = {
        modelName: 'gemini-2.0-flash-thinking',
        modelHeader: {'x-goog-ext-525001261-jspb': '[null,null,null,null,"7ca48d02d802f20a"]'},
        advancedOnly: false
    };

    static fromName(name) {
        const models = [
            this.UNSPECIFIED,
            this.G_2_5_FLASH,
            this.G_2_5_PRO,
            this.G_2_0_FLASH,
            this.G_2_0_FLASH_THINKING
        ];
        
        const model = models.find(m => m.modelName === name);
        if (!model) {
            throw new Error(`Unknown model name: ${name}. Available models: ${models.map(m => m.modelName).join(', ')}`);
        }
        return model;
    }
}

export { Model };