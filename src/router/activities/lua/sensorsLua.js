import PromiseFile from "../../../helpers/promiseFile";
import PromiseBrightness from "../../../helpers/promiseBrightness";
import MailboxState from "../../../constants/mailboxStates";
import ArgsValidator from "../../../helpers/argsValidator";

const handlers = {
    sub: {
        required: {
            sensor: "string"
        },

        optional: {
            provider: {
                type: "string",
                default: "file"
            },
            sendInterval: {
                type: "number",
                default: 1000
            },
            
            // lua specific
            useKnown: {
                type: "boolean",
                default: true
            },
            dataPollPeriod: {
                type: "number",
                default: 80
            },
            streamEntries: {
                type: "number",
                default: 10
            }
        },

        run: async function(self, args) {
            return await self.subscribe(args);
        }
    },

    unsub: {
        run: async function(self, args) {
            return await self.unsubscribe(args);
        }
    }
};

export default class SensorsLua {
    static type = "sensorsLua";
    static needsScreenOn = true;

    constructor(mailbox, interconnect) {
        this.mailbox = mailbox;
        this.interconnect = interconnect;

        this.brightness = PromiseBrightness;
        this.file = PromiseFile;
        this.outputFile = undefined;

        this.pollingRate = 1000;
        this.isPolling = false;
        this.pollTimer = null;
        this.lastReadingRaw = null;
    }
    
    async handle(message) {
        const args = message.args || {};
        const type = args.type;

        const handler = handlers[type];

        if (handler) {
            const validation = ArgsValidator.validate(args, handler);

            if (!validation.valid) {
                return {
                    type: SensorsLua.type,
                    state: MailboxState.ERROR,
                    msg: validation.error
                };
            }

            try {
                return await handler.run(this, args);
            } catch (e) {
                return {
                    type: SensorsLua.type,
                    state: MailboxState.ERROR,
                    msg: e.message,
                    stack: e.stack
                };
            }
        }

        return await this.run(args);
    }

    async run(args) {
        const result = await this.mailbox.request(
            SensorsLua.type,
            args
        );

        return {
            type: SensorsLua.type,
            state: result.appState,
            res: result.res
        };
    }

    async subscribe(args) {
        const result = await this.mailbox.request(
            SensorsLua.type,
            args
        );
        
        if (result.appState == MailboxState.ERROR) {
            return {
                type: SensorsLua.type,
                state: MailboxState.ERROR,
                res: result.res
            };
        }

        this.pollingRate = args.sendInterval;
        this.outputFile = result.out;

        this.lastReadingRaw = null;

        if (this.outputFile) {
            this.startPolling();
        }

        return {
            type: SensorsLua.type,
            state: result.appState,
            res: result.res
        };
    }

    async unsubscribe(args) {
        this.stopPolling();

        const result = await this.mailbox.request(
            SensorsLua.type,
            args
        );

        if (this.outputFile) {
            const outputFileExists = await this.file.exists(this.outputFile);

            if (outputFileExists) {
                await this.file.delete(this.outputFile);
            }

            this.outputFile = undefined;
        }

        return {
            type: SensorsLua.type,
            state: result.appState,
            res: result.res
        };
    }

    async sendData(rawReading) {
        const result = {
            type: SensorsLua.type,
            state: MailboxState.STREAM,
            samples: rawReading
        };

        await this.interconnect.send(result);
    }

    startPolling() {
        if (this.isPolling) return;

        this.isPolling = true;
        this.poll();
    }
    
    async poll() {
        if (!this.isPolling || !this.outputFile) return;

        this.brightness.setKeepScreenOn(true);

        try {
            const rawContent = await this.file.readText(this.outputFile);

            if (rawContent && rawContent !== this.lastReadingRaw) {
                this.lastReadingRaw = rawContent;
                this.sendData(rawContent);
            }
        } catch (fileErr) {
            // console.log("[SensorsLua] Error reading output file:", fileErr.message);
        }

        if (this.isPolling) {
            this.pollTimer = setTimeout(
                () => this.poll(),
                this.pollingRate
            );
        }
    }

    stopPolling() {
        this.isPolling = false;

        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }
}