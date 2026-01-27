import { BaseCheck } from '../base/check.js';

export class MsgCheck extends BaseCheck {
    #validate

    constructor() {
        super()
        this.#validate = this.#compile()
    }

    #compile() {
        const schema = {
            $$strict: true,
            type : { type : "string", min : 1, max : 256 },
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$strict: true,
                $$type: "object",
                dispatch : {
                    $$strict: true,
                    $$type : "object",
                    attachments : { type : "array", items : "string" },
                    msg : { type : "string", min : 1 },
                    type : { type : "string", min : 1, max : 256 },
                    address : { type : "is_hex" },
                    deleted_by : { type : "is_hex", nullable : true },
                    reply_to : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER, nullable : true },
                    pinned : { type : "boolean" },
                    pin_id : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER, nullable : true },
                }
            }
        };

        return this.validator.compile(schema)
    }

    validate(op) {
        return this.#validate(op) === true
    }
}
