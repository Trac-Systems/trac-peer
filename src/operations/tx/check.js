import { BaseCheck } from '../base/check.js';

export class TxCheck extends BaseCheck {
    #validate

    constructor() {
        super()
        this.#validate = this.#compile()
    }

    #compile() {
        const schema = {
            key: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$strict : true,
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 },
                    value : { type : "any", nullable : true }
                },
                msbsl : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER },
                ipk : { type : "is_hex" },
                wp : { type : "is_hex" }
            }
        };

        return this.validator.compile(schema)
    }

    validate(op) {
        return this.#validate(op) === true
    }
}
