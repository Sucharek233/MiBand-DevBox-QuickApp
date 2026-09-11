import MailboxState from "../../constants/mailboxStates";
import ArgsValidator from "../../helpers/argsValidator";

const handlers = {
    lua: {
        run: async function(self, _) {
            return await self.pingLua();
        }
    },

    qjs: {
        run: async function(self, _) {
            return self.pingQjs();
        }
    }
};

export default class Ping {
    static type = "ping";
    static needsScreenOn = true;

    constructor(mailbox) {
        this.mailbox = mailbox;
        this.pingingLua = false;
    }
    
    async handle(message) {
        const args = message.args || {};
        const handler = handlers[args.type];

        if (!handler) {
            return {
                type: Ping.type,
                state: MailboxState.ERROR,
                msg: "Unknown type"
            };
        }

        const validation = ArgsValidator.validate(args, handler);

        if (!validation.valid) {
            return {
                type: Ping.type,
                state: MailboxState.ERROR,
                msg: validation.error
            };
        }

        try {
            return await handler.run(this, args);
        } catch (e) {
            this.pingingLua = false;

            if (e.message == "Mailbox timeout") {
                return {
                    type: Ping.type,
                    state: MailboxState.TIMEOUT
                };
            }

            return {
                type: Ping.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            };
        }
    }

    async pingLua() {
        if (this.pingingLua) {
            return {
                type: Ping.type,
                state: MailboxState.ERROR,
                msg: "Already pinging"
            };
        }

        this.pingingLua = true;

        const startTime = Date.now();

        await this.mailbox.request(
            Ping.type,
            {},
            2500
        );

        this.pingingLua = false;

        const endTime = Date.now();

        return {
            type: Ping.type,
            state: MailboxState.DONE,
            startTime: startTime,
            endTime: endTime
        };
    }

    pingQjs() {
        return {
            type: Ping.type,
            state: MailboxState.DONE,
            ackTime: Date.now()
        };
    }
}