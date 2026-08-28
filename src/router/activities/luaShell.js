import MailboxState from "../../constants/mailboxStates";

export default class LuaShell {
    static type = "luashell";
    static needsLua = true;

    constructor(mailbox) {
        this.mailbox = mailbox;
    }
    
    async handle(msgObj) {
        return await this.execute(msgObj.args);
    }

    async execute(args) {
        const code = args.code;

        try {
            const result = await this.mailbox.request(
                LuaShell.type,
                {code: code}
            );

            const state = result.luaState;
            const prints = result.print;
            if (state == MailboxState.ERROR) {
                const reason = result.reason;
                const message = result.msg;

                const errResult = {
                    type: LuaShell.type,
                    state: MailboxState.ERROR,
                    reason: reason,
                    msg: message
                }
                if (reason == "runtime") {
                    errResult["print"] = prints;
                }

                return errResult;
            }

            return {
                type: LuaShell.type,
                state: MailboxState.DONE,
                res: result.res,
                print: prints
            }
        } catch (e) {
            return {
                type: LuaShell.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            }
        }
        
    }
}
