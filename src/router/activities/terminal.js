import MailboxState from "../../constants/mailboxStates";
import PromiseFile from "../../helpers/promiseFile";
import ArgsValidator from "../../helpers/argsValidator";

export default class Terminal {
    static type = "cmd";
    static needsScreenOn = true;

    constructor(mailbox) {
        this.mailbox = mailbox;
    }
    
    async handle(message) {
        const args = message.args || {};

        const schema = {
            required: {
                cmd: "string"
            },
            optional: {
                cwd: {
                    type: "string",
                    default: "/"
                }
            }
        };

        const validation = ArgsValidator.validate(args, schema);
        if (!validation.valid) {
            return {
                type: Terminal.type,
                state: MailboxState.ERROR,
                msg: validation.error
            };
        }

        return await this.run(args);
    }

    handleCmdFail(err) {
        let errMsg = err;
        let stack = "";

        if (typeof err == "object") {
            errMsg = err.message;
            stack = err.stack;
        }

        return {
            type: Terminal.type,
            state: MailboxState.ERROR,
            msg: errMsg,
            stack: stack
        };
    }

    async run(args) {
        try {
            const result = await this.mailbox.request(
                Terminal.type,
                args
            );

            const exitCode = result.code;
            const outputFile = result.out;
            
            const checkCmdOut = await PromiseFile.exists(outputFile);
            if (!checkCmdOut) {
                return this.handleCmdFail("Output file doesn't exist");
            }

            // later read buffer and send that to the phone
            // splitting and checksums will most likely be needed
            const cmdOut = await PromiseFile.readText(outputFile);

            return {
                type: Terminal.type,
                state: MailboxState.DONE,
                res: cmdOut,
                code: exitCode
            };
        } catch (e) {
            return this.handleCmdFail(e);
        }
    }
}