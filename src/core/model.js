class Model {
    constructor(name, header, advancedOnly) {
        this.modelName = name;
        this.modelHeader = header;
        this.advancedOnly = advancedOnly;
        Model._values.push(this);
    }

    static _values = [];

    static UNSPECIFIED = new Model(
        "unspecified", 
        {}, 
        false
    );

    static G_2_5_FLASH = new Model(
        "gemini-2.5-flash", 
        {
            "x-goog-ext-525001261-jspb": '[1,null,null,null,"71c2d248d3b102ff",null,null,0,[4]]'
        }, 
        false);

    static G_2_5_PRO = new Model(
        "gemini-2.5-pro", 
        {
            "x-goog-ext-525001261-jspb": '[1,null,null,null,"4af6c7f5da75d65d",null,null,0,[4]]'
        }, 
        false);

    static G_2_0_FLASH = new Model(
        "gemini-2.0-flash", 
        {
            "x-goog-ext-525001261-jspb": '[1,null,null,null,"f299729663a2343f"]'
        }, 
        false);

    static G_2_0_FLASH_THINKING = new Model(
        "gemini-2.0-flash-thinking", 
        {
            "x-goog-ext-525001261-jspb": '[null,null,null,null,"7ca48d02d802f20a"]'
        }, 
        false);

    static fromName(name) {
        const model = Model._values.find(m => m.modelName === name);
        if (!model) {
            throw new Error(
                `Unknown model name: ${name}. Available models: ${Model._values.map(m => m.modelName).join(", ")}`
            );
        }
        return model;
    }
}

export { Model };
