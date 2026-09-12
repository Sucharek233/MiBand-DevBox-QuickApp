import MailboxState from "../../../constants/mailboxStates";

export default class SystemInfoLua {
    static type = "sysInfoLua";
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
                SystemInfoLua.type,
                args
            );

            return {
                type: SystemInfoLua.type,
                res: result.res,
                state: MailboxState.DONE
            }
        } catch (e) {
            return {
                type: SystemInfoLua.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            }
        }
    }
}