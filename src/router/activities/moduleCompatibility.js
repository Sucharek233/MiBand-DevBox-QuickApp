import app from "@system.app"
import MailboxState from "../../constants/mailboxStates";

export default class ModuleCompatibility {
    static type = "modules";
    static needsScreenOn = false;

    constructor(qjsShell) {
        this.qjsShell = qjsShell;
    }

    async handle(message) {
        return this.check(message.args);
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
                    state: MailboxState.ERROR,
                    msg: "No type specified"
                };
            }
        } catch (e) {
            return {
                type: ModuleCompatibility.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            };
        }
        
    }

    checkCompatibility(modules) {
        if (typeof(modules) == "string") {
            modules = [modules];
        }
        if (!modules || typeof(modules) != "object") {
            return {
                type: ModuleCompatibility.type,
                state: MailboxState.ERROR,
                msg: "Invalid modules list"
            };
        }

        const result = {};
        for (const module of modules) {
            let compatible;
            if (typeof(app.canIUse) === "function") {
                compatible = app.canIUse(`@${module}`);
            } else if (typeof($app_require$) === "function") {
                compatible = Boolean(this.qjsShell.getModule(module));
            } else {
                return {
                    type: ModuleCompatibility.type,
                    state: MailboxState.ERROR,
                    msg: "Incompatible"
                };
            }
            
            result[module] = compatible;
        }

        return {
            type: ModuleCompatibility.type,
            state: MailboxState.DONE,
            res: result
        };
    }

    getModule(module) {
        if (!module || module.trim() == "") {
            return {
                type: ModuleCompatibility.type,
                state: MailboxState.ERROR,
                msg: "Invalid module"
            };
        }

        const res = this.qjsShell.getModule(module);
        const functions = this.qjsShell.safeStringify(res);
        
        return {
            type: ModuleCompatibility.type,
            state: MailboxState.DONE,
            res: functions
        };
    }
}