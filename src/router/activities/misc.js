import MailboxState from "../../constants/mailboxStates";
import ArgsValidator from "../../helpers/argsValidator";

const handlers = {
    gc: {
        run: function(self, _) {
            global.runGC();
            return self.getResult("Ok");
        }
    }
};

export default class Misc {
    static type = "misc";
    static needsScreenOn = false;

    constructor() {
        // this.mailbox = mailbox;
    }

    async handle(message) {
        const args = message.args || {};
        const type = args.type;

        const handler = handlers[type];

        if (!handler) {
            return {
                type: Misc.type,
                state: MailboxState.ERROR,
                msg: "Unknown type"
            };
        }

        const validation = ArgsValidator.validate(args, handler);

        if (!validation.valid) {
            return {
                type: Misc.type,
                state: MailboxState.ERROR,
                msg: validation.error
            };
        }

        try {
            return await handler.run(this, args);
        } catch (e) {
            return {
                type: Misc.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            };
        }
    }

    getResult(msg) {
        return {
            type: Misc.type,
            state: MailboxState.DONE,
            res: msg
        };
    }
}