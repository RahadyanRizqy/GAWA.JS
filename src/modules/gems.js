import { running } from '../utils/decorators.js';
import { RPCData } from '../core/rpc.js';
import { GRPC } from '../utils/constants.js';
import { APIError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

class Gem {
    constructor({ id, name, description = null, prompt = null, predefined }) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.prompt = prompt;
        this.predefined = predefined;
    }

    toString() {
        return `Gem(id='${this.id}', name='${this.name}', description='${this.description}', prompt='${this.prompt}', predefined=${this.predefined})`;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            prompt: this.prompt,
            predefined: this.predefined,
        };
    }
}

class GemJar extends Map {
    constructor(entries=[]) {
        super(entries);
    }

    get({ id = null, name = null, defaultValue = null } = {}) {
        // console.log("Here");
        if (id === null && name === null) {
            throw new Error("At least one of gem id or name must be provided.");
        }
        if (id !== null) {
            const gemCandidate = super.get(id);
            if (gemCandidate) {
                if (name !== null) {
                    if (gemCandidate.name === name) {
                        return gemCandidate;
                    } else {
                        return defaultValue;
                    }
                } else {
                    return gemCandidate;
                }
            } else {
                return defaultValue;
            }
        } else if (name !== null) {
            for (const gemObj of this.values()) {
                if (gemObj.name === name) {
                    return gemObj;
                }
            } return defaultValue;
        } // Should be unreachable due to the assertion. return defaultValue; }
    }

    toObject() {
        return Object.fromEntries(this);
    }

    filter({ predefined = null, name = null } = {}) {
        const filtered = new GemJar();
        for (const [id, gem] of this.entries()) {
            if (predefined !== null && gem.predefined !== predefined) continue;
            if (name !== null && gem.name !== name) continue;
            filtered.set(id, gem);
        }
        return filtered;
    }
}

class GemMixin {
    constructor() {
        this._gems = null;
        this.fetchGems = running(2)(this.fetchGems.bind(this));
        this.createGem = running(2)(this.createGem.bind(this));
        this.updateGem = running(2)(this.updateGem.bind(this));
        this.deleteGem = running(2)(this.deleteGem.bind(this));
    }

    get gems() {
        if (!this._gems) {
            throw new Error("Gems not fetched yet. Call fetchGems() first.");
        }
        return this._gems;
    }

    async fetchGems(includeHidden = false, options = {}) {
        let response = await this._batchExecute(
            [
                new RPCData({
                    rpcid: GRPC.LIST_GEMS,
                    payload: includeHidden ? "[4]" : "[3]",
                    identifier: "system",
                }),
                new RPCData({
                    rpcid: GRPC.LIST_GEMS,
                    payload: "[2]",
                    identifier: "custom",
                }),
            ],
            options
        );
        // console.log(response);

        let predefinedGems = [];
        let customGems = [];
        try {
            // console.log(response.data);
            const responseJson = JSON.parse(response.data.split("\n")[2]);

            for (const part of responseJson) {
                if (part[part.length - 1] === "system") {
                    predefinedGems = JSON.parse(part[2])[2];
                } else if (part[part.length - 1] === "custom") {
                    const cont = JSON.parse(part[2]);
                    if (cont) customGems = cont[2];
                }
            }

            if (!predefinedGems.length && !customGems.length) {
                throw new Error("No gems received");
            }

        } catch (err) {
            await this.close();
            logger.debug(`Invalid response: ${response.text}`);
            throw new Error("Failed to fetch gems. Client will re-initialize.");
        }

        const gemsArray = [
            ...predefinedGems.map(([id, data]) => [id, new Gem({
                id,
                name: data[0],
                description: data[1],
                prompt: data[2] ?? null,
                predefined: true
            })]),
            ...customGems.map(([id, data]) => [id, new Gem({
                id,
                name: data[0],
                description: data[1],
                prompt: data[2] ?? null,
                predefined: false
            })])
        ];

        this._gems = new GemJar(gemsArray);

        return this._gems;
    };

    async createGem (name, prompt, description = "") {
        const response = await this._batchExecute([
            new RPCData({
                rpcid: GRPC.CREATE_GEM,
                payload: JSON.stringify([
                    [
                        name,
                        description,
                        prompt,
                        null,
                        null,
                        null,
                        null,
                        null,
                        0,
                        null,
                        1,
                        null,
                        null,
                        null,
                        [],
                    ]
                ]),
            }),
        ]);

        let gemId;
        try {
            const responseJson = JSON.parse(response.data.split("\n")[2]);
            gemId = JSON.parse(responseJson[0][2])[0];
        } catch (err) {
            await this.close();
            logger.debug(`Invalid response: ${response.text}`);
            throw new Error("Failed to create gem. Client will try to re-initialize on next request.");
        }

        return new Gem({
            id: gemId,
            name,
            description,
            prompt,
            predefined: false,
        });
    };

    async updateGem (gem, name, prompt, description = "") {
        const gemId = gem instanceof Gem ? gem.id : gem;

        await this._batchExecute([
            new RPCData({
                rpcid: GRPC.UPDATE_GEM,
                payload: JSON.stringify([
                    gemId,
                    [
                        name,
                        description,
                        prompt,
                        null,
                        null,
                        null,
                        null,
                        null,
                        0,
                        null,
                        1,
                        null,
                        null,
                        null,
                        [],
                        0,
                    ],
                ]),
            }),
        ]);

        return new Gem({
            id: gemId,
            name,
            description,
            prompt,
            predefined: false,
        });
    };

    async deleteGem(gem, options = {}) {
        const gemId = gem instanceof Gem ? gem.id : gem;

        await this._batchExecute(
            [
                new RPCData({
                    rpcid: GRPC.DELETE_GEM,
                    payload: JSON.stringify([gemId]),
                }),
            ],
            options
        );
    };
}

export { Gem, GemJar, GemMixin };