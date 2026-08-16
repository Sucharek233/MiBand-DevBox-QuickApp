import app from "@system.app"

export default class ModuleCompatibility {
    static type = "modules";
    static needsLua = false;

    constructor(qjsShell) {
        this.qjsShell = qjsShell;
    }

    async handle(msgObj) {
        return this.check(msgObj.args);
    }

    check(args) {
        const type = args.type;

        try {
            if (type == "compat") {
                const modules = args.modules;
                return this.checkCompatibility(modules);
            } else if (type == "funcs") {
                const module = args.module;
                return this.getModule(module);
            } else {
                return {
                    type: ModuleCompatibility.type,
                    state: "error",
                    msg: "No type specified"
                };
            }
        } catch (e) {
            return {
                type: ModuleCompatibility.type,
                state: "error",
                msg: e.message,
                stack: e.stack
            };
        }
        
    }

    checkCompatibility(modules) {
        if (typeof(app.canIUse) != "function") {
            return {
                type: ModuleCompatibility.type,
                state: "error",
                msg: "Incompatible"
            };
        }

        if (typeof(modules) == "string") {
            modules = [modules];
        }
        if (!modules || typeof(modules) != "object") {
            return {
                type: ModuleCompatibility.type,
                state: "error",
                msg: "Invalid modules list"
            };
        }

        const result = {};
        for (const module of modules) {
            const compatible = app.canIUse(`@${module}`);
            result[module] = compatible;
        }

        return {
            type: ModuleCompatibility.type,
            state: "done",
            res: result
        };
    }

    getModule(module) {
        if (!module || module.trim() == "") {
            return {
                type: ModuleCompatibility.type,
                state: "error",
                msg: "Invalid module"
            };
        }

        const res = this.qjsShell.getModule(module);
        const functions = this.qjsShell.safeStringify(res);
        
        return {
            type: ModuleCompatibility.type,
            state: "done",
            res: functions
        };
    }
}