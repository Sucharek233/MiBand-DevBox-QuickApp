import MailboxState from "../../constants/mailboxStates";

export default class Ping {
    static type = "ping";
    static needsScreenOn = true;

    constructor(mailbox) {
        this.mailbox = mailbox;

        // qjs doesn't need a pinging state
        this.pingingLua = false;
    }
    
    async handle(message) {
        return await this.ping(message.args);
    }

    async ping(args) {
        if (this.pingingLua) return {
            type: Ping.type,
            state: MailboxState.ERROR,
            msg: "Already pinging",
        };

        try {
            const type = args.type;
            const startTime = Date.now();

            if (type == "lua") {
                this.pingingLua = true;

                await this.mailbox.request(
                    Ping.type,
                    {},
                    2500
                );
                this.pingingLua = false;

                const endTime = Date.now();

                // only send timestamps
                return {
                    type: Ping.type,
                    state: MailboxState.DONE,
                    startTime: startTime,
                    endTime: endTime,
                };

            } else if (type == "qjs") {
                // just return start time
                return {
                    type: Ping.type,
                    state: MailboxState.DONE,
                    ackTime: startTime,
                };

            } else {
                return {
                    type: Ping.type,
                    state: MailboxState.ERROR,
                    msg: "Unknown type",
                };
            }
        } catch (e) {
            this.pingingLua = false;
            if (e.message == "Mailbox timeout") {
                return {
                    type: Ping.type,
                    state: MailboxState.TIMEOUT
                }
            }
            return {
                type: Ping.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            }
        }
    }
}