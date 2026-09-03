import MailboxState from "../../constants/mailboxStates";

export default class Misc {
    static type = "misc";
    static needsScreenOn = false;

    constructor() {
        // this.mailbox = mailbox;
    }

    async handle(message) {
        return await this.run(message.args);
    }

    // 
    getResult(msg) {
        return {
            type: Misc.type,
            state: MailboxState.DONE,
            res: msg
        }
    }

    async run(args) {
        try {
            const type = args.type;
            if (type == "gc") {
                global.runGC();
                return this.getResult();
            }
        } catch (e) {
            return {
                type: Misc.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            }
        }
    }
}