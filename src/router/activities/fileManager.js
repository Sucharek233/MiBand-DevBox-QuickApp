import MailboxState from "../../constants/mailboxStates";

export default class FileManager {
    static type = "io";
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
                FileManager.type,
                args
            );

            return {
                type: FileManager.type,
                res: result,
                state: MailboxState.DONE
            }
        } catch (e) {
            return {
                type: FileManager.type,
                state: MailboxState.ERROR,
                msg: e.msg,
                stack: e.stack
            }
        }
    }
}