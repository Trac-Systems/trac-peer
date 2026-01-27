import { BaseCheck } from '../base/check.js';

export class RemoveWriterCheck extends BaseCheck {
    #validate

    constructor() {
        super()
        this.#validate = this.#compile()
    }

    #compile() {
        const schema = {
            key: { type : "is_hex" },
            hash : { type : "is_hex" },
            nonce : { type : "string", min : 1, max : 256 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 },
                    key: { type : "is_hex" }
                }
            }
        };

        return this.validator.compile(schema)
    }

    validate(op) {
        return this.#validate(op) === true
    }
}
