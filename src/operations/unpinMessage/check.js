import { BaseCheck } from '../base/check.js';

export class UnpinMessageCheck extends BaseCheck {
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
                    id : { type : "number", integer: true, min : 0, max : Number.MAX_SAFE_INTEGER },
                    type : { type : "string", min : 1, max : 256 },
                    address : { type : "is_hex" }
                }
            }
        };

        return this.validator.compile(schema)
    }

    validate(op) {
        return this.#validate(op) === true
    }
}
