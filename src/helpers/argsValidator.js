export default class ArgsValidator {
    static matchesType(value, expectedType) {
        if (expectedType === "array") {
            return Array.isArray(value);
        }
    
        if (expectedType === "object") {
            return value !== null &&
                   typeof value === "object" &&
                   !Array.isArray(value);
        }
    
        return typeof value === expectedType;
    }

    static validate(args, schema) {
        args = args || {};

        const required = schema.required || {};
        const optional = schema.optional || {};
        const allowed = {};

        // Required
        for (const [name, expectedType] of Object.entries(required)) {
            allowed[name] = true;

            if (args[name] === undefined) {
                return {
                    valid: false,
                    error: `${name} missing`
                };
            }

            if (!ArgsValidator.matchesType(args[name], expectedType)) {
                return {
                    valid: false,
                    error: `${name} must be ${expectedType}`
                };
            }
        }

        // Optional
        for (const [name, definition] of Object.entries(optional)) {
            allowed[name] = true;

            if (args[name] === undefined) {
                if (definition.default !== undefined) {
                    args[name] = definition.default;
                }
            } else if (!ArgsValidator.matchesType(args[name], definition.type)) {
                return {
                    valid: false,
                    error: `${name} must be ${definition.type}`
                };
            }
        }

        // Unknown
        for (const name of Object.keys(args)) {
            if (name !== "type" && !allowed[name]) {
                return {
                    valid: false,
                    error: `${name} not allowed`
                };
            }
        }

        return {
            valid: true
        };
    }
}