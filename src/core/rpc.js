class RPCData {
    constructor({ rpcid, payload, identifier = "generic" }) {
        this.rpcid = rpcid;
        this.payload = payload;
        this.identifier = identifier;
    }

    toString() {
        return `GRPC(rpcid='${this.rpcid}', payload='${this.payload}', identifier='${this.identifier}')`;
    }

    serialize() {
        return [this.rpcid, this.payload, null, this.identifier];
    }
}

export { RPCData };