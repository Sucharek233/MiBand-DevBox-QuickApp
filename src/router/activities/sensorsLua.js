import PromiseFile from "../../helpers/promiseFile"
import PromiseBrightness from "../../helpers/promiseBrightness"
import MailboxState from "../../constants/mailboxStates";

export default class SensorsLua {
    static type = "sensorsLua";
    static needsScreenOn = true;

    constructor(mailbox, interconnect) {
        this.mailbox = mailbox;
        this.interconnect = interconnect;

        this.brightness = PromiseBrightness
        this.file = PromiseFile;
        this.outputFile = undefined;

        this.pollingRate = 1000;
        this.isPolling = false;
        this.pollTimer = null;
        this.lastReadingRaw = null;
    }
    
    async handle(message) {
        return await this.run(message.args);
    }

    async run(args) {
        const type = args.type;

        if (type.startsWith("list")) {
            const sensorList = await this.getSensorList(type);
            return {
                type: SensorsLua.type,
                state: sensorList.appState,
                res: sensorList.res
            }
        } else if (type == "sub") {
            return await this.subscribe(args);
        } else if (type == "unsub") {
            return await this.unsubscribe();
        }
    }

    async getSensorList(type) {
        const result = await this.mailbox.request(
            SensorsLua.type,
            {type: type}
        );

        return result;
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
                result: result.res
            }
        }

        this.pollingRate = args.sendInterval ?? 1000;
        this.outputFile = result.out;

        this.lastReadingRaw = null;
        if (this.outputFile) {
            this.startPolling();
        }

        return {
            type: SensorsLua.type,
            state: result.appState,
            result: result.res
        };
    }

    async unsubscribe() {
        this.stopPolling();

        const result = await this.mailbox.request(
            SensorsLua.type,
            {type: "unsub"}
        );

        // clean up output file
        if (this.outputFile) {
            const outputFileExists = await this.file.exists(this.outputFile);
            if (outputFileExists) await this.file.delete(this.outputFile);
        }
        
        return {
            type: SensorsLua.type,
            state: result.appState,
            result: result.res
        };
    }

    async sendData(rawReading) {
        const result = {
            type: SensorsLua.type,
            state: MailboxState.STREAM,
            samples: rawReading
        };

        console.log(result);
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
            this.pollTimer = setTimeout(() => this.poll(), this.pollingRate);
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
