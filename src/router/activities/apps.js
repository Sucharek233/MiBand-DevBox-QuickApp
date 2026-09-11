import MailboxState from "../../constants/mailboxStates";
import ArgsValidator from "../../helpers/argsValidator";
import router from "@system.router";

const handlers = {
    run: {
        required: {
            pkg: "string"
        },

        optional: {
            path: {
                type: "string"
            },

            params: {
                type: "object",
                default: {}
            }
        },

        run: async function(self, args) {
            return await self.runApp(args);
        }
    }
};

export default class Apps {
    static type = "apps";
    static needsScreenOn = true;

    constructor(mailbox) {
        this.mailbox = mailbox;
    }

    async handle(message) {
        const args = message.args || {};
        const type = args.type;

        const handler = handlers[type];

        if (handler) {
            const validation = ArgsValidator.validate(args, handler);

            if (!validation.valid) {
                return {
                    type: Apps.type,
                    state: MailboxState.ERROR,
                    msg: validation.error
                };
            }

            try {
                return await handler.run(this, args);
            } catch (e) {
                return {
                    type: Apps.type,
                    state: MailboxState.ERROR,
                    msg: e.message,
                    stack: e.stack
                };
            }
        }

        return await this.relay(args);
    }

    async relay(args) {
        try {
            const result = await this.mailbox.request(
                Apps.type,
                args
            );

            return {
                type: Apps.type,
                res: result.res,
                state: result.appState
            };
        } catch (e) {
            return {
                type: Apps.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            };
        }
    }

    async runApp(args) {
        let uri = `hap://app/${args.pkg}`;

        // path doesn't really work when trying to access pages from different apps
        // running uri `hap://app/com.example/pages/hiddenPage` doesn't work from this app
        // but running it directly within the app works
        if (args.path !== undefined) {
            uri += `/${args.path}`;
        }

        router.push({
            uri: uri,
            params: args.params
        });

        return {
            type: Apps.type,
            state: MailboxState.DONE
        };
    }
}