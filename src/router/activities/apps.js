import MailboxState from "../../constants/mailboxStates";
import router from '@system.router' 

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
            const type = args.type;
            if (type == "run") {
                const pkg = args.pkg;
                if (!pkg) {
                    return {
                        type: Apps.type,
                        state: MailboxState.ERROR,
                        msg: "No app specified"
                    }
                }

                const path = args.path
                const params = args.params ?? {};

                let uri = `hap://app/${pkg}`;
                if (path) {
                    uri += `/${path}`;
                }

                router.push({
                    uri: uri,
                    params: params
                });

                // hmm
                return {
                    type: Apps.type,
                    state: MailboxState.DONE
                }
            } else {
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