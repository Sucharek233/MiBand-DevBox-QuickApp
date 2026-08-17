import MailboxState from "../../constants/mailboxStates";

export default class QJSShell {
    static type = "qjs";
    static needsLua = false;

    constructor(appCtx, global) {
        this.context = appCtx;
        this.global = global;
        

        this.maxString = 1024;

        this.exposedFunctions = {
            getModule: this.getModule
        };
    }

    async handle(message) {
        return await this.execute(message.args.code);
    }

    safeStringify(value) {
        const seen = new Map();
    
        const convert = (val, path = "root") => {
            // functions
            if (typeof val === "function") {
                return {
                    $: "fn"
                };
            }
    
            // undefined
            if (val === undefined) {
                return {
                    $: "undef"
                };
            }
    
            // numbers
            if (typeof val === "number") {
                if (Number.isNaN(val)) {
                    return {
                        $: "nan"
                    };
                }
    
                if (val === Infinity) {
                    return {
                        $: "inf"
                    };
                }
    
                if (val === -Infinity) {
                    return {
                        $: "ninf"
                    };
                }
    
                return val;
            }
    
            // strings
            if (typeof val === "string") {
                if (val.length > this.maxString) {
                    return val.substring(0, this.maxString) + "...";
                }
    
                return val;
            }
    
            // null
            if (val === null) {
                return {
                    $: "null"
                };
            }
    
            // objects
            if (typeof val === "object") {
    
                if (seen.has(val)) {
                    return {
                        $: "ref",
                        to: seen.get(val)
                    };
                }
    
                seen.set(val, path);
    
                const out = Array.isArray(val)
                    ? []
                    : {};
    
                for (const key of Reflect.ownKeys(val)) {
                    try {
                        out[String(key)] =
                            convert(
                                val[key],
                                `${path}.${String(key)}`
                            );
                    }
                    catch (e) {
                        out[String(key)] = {
                            $: "err",
                            message: String(e)
                        };
                    }
                }
    
                return out;
            }
    
            return val;
        };
    
        return JSON.stringify(
            convert(value)
        );
    }

    getModule(module) {
        return $app_require$(`@app-module/${module}`);
    }

    async execute(code) {
        try {
            const fn = new Function(
                "shell",
                `
                return (async () => {
                    ${code}
                })();
                `
            );
    
            const result = await fn(this.exposedFunctions);
            const safeResult = this.safeStringify(result);
    
            return {
                type: QJSShell.type,
                res: safeResult,
                state: MailboxState.DONE
            }
        } catch (e) {
            return {
                type: QJSShell.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            }
        }
        
    }
}