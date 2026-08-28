import MailboxState from "../../constants/mailboxStates";

export default class Apps {
    static type = "apps";
    static needsScreenOn = true;

    constructor(mailbox) {
        this.mailbox = mailbox;
    }

    async handle(message) {
        return await this.run(message.args);
    }

    async run(args) {
        try {
            const result = await this.mailbox.request(
                Apps.type,
                args
            );

            const appState = result.appState;
            return {
                type: Apps.type,
                res: result.res,
                state: appState
            }
        } catch (e) {
            return {
                type: Apps.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            }
        }
    }
}