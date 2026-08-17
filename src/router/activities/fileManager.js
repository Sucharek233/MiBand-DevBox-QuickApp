import MailboxState from "../../constants/mailboxStates";

export default class FileManager {
    static type = "io";
    static needsLua = true;

    constructor(mailbox) {
        this.mailbox = mailbox;
    }

    async handle(message) {
        return await this.run(message.args);
    }

    handleFail(err) {
        let errMsg = err;
        if (typeof(err) == "object") {
            errMsg = `${err.message}\n${err.stack}`;
        }

        return {
            type: FileManager.type,
            state: MailboxState.ERROR,
            msg: errMsg
        }
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
            return this.handleFail(e);
        }
    }
}