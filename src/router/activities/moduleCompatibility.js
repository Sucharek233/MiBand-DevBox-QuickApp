import app from "@system.app"
import MailboxState from "../../constants/mailboxStates";
import ArgsValidator from "../../helpers/argsValidator";

const handlers = {
    compat: {
        required: {
            modules: "array"
        },

        run: function(self, args) {
            return self.checkCompatibility(args.modules);
        }
    },

    funcs: {
        required: {
            module: "string"
        },

        run: function(self, args) {
            return self.getModule(args.module);
        }
    }
};

export default class ModuleCompatibility {
    static type = "modules";
    static needsScreenOn = false;

    constructor(qjsShell) {
        this.qjsShell = qjsShell;
    }

    async handle(message) {
        const args = message.args || {};
        const type = args.type;

        const handler = handlers[type];

        if (!handler) {
            return {
                type: ModuleCompatibility.type,
                state: MailboxState.ERROR,
                msg: "Unknown type"
            };
        }

        const validation = ArgsValidator.validate(args, handler);

        if (!validation.valid) {
            return {
                type: ModuleCompatibility.type,
                state: MailboxState.ERROR,
                msg: validation.error
            };
        }

        try {
            return handler.run(this, args);
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
        const res = this.qjsShell.getModule(module);
        const functions = this.qjsShell.safeStringify(res);

        return {
            type: ModuleCompatibility.type,
            state: MailboxState.DONE,
            res: functions
        };
    }
}