import { BaseCheck } from '../base/check.js';

export class SetNickCheck extends BaseCheck {
    #validate

    constructor() {
        super()
        this.#validate = this.#compile()
    }

    #compile() {
        const schema = {
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    nick : { type : "string", min : 1, max : 256 },
                    type : { type : "string", min : 1, max : 256 },
                    address : { type : "is_hex" },
                    initiator : { type : "is_hex" }
                }
            }
        };

        return this.validator.compile(schema)
    }

    validate(op) {
        return this.#validate(op) === true
    }
}
