import PromiseFile from "../../helpers/promiseFile"

export default class SensorsLua {
    static type = "sensorsLua";
    static needsLua = true;

    constructor(mailbox, interconnect) {
        this.mailbox = mailbox;
        this.interconnect = interconnect;

        this.file = PromiseFile;
        this.outputFile = undefined;

        this.pollingRate = 500;
        this.isPolling = false;
        this.pollTimer = null;
        this.lastReadingRaw = null;
    }
    
    async handle(msgObj) {
        return await this.run(msgObj.args);
    }

    async run(args) {
        const type = args.type;

        if (type.startsWith("list")) {
            const sensorList = await this.getSensorList(type);
            return {
                type: SensorsLua.type,
                state: "done",
                res: sensorList
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

        return result.res;
    }

    async subscribe(args) {
        const provider = args.provider;
        const sensorName = args.sensor;
        const useKnown = args.useKnown;
        const period = args.period;

        const result = await this.mailbox.request(
            SensorsLua.type,
            {
                type: "sub",
                provider: provider,
                sensor: sensorName,
                useKnown: useKnown,
                period: period
            }
        );
        if (result.sensorState == "err") {
            return {
                type: SensorsLua.type,
                state: "error",
                result: result.res
            }
        }

        this.outputFile = result.out;

        this.lastReadingRaw = null;
        if (this.outputFile) {
            this.startPolling();
        }

        return {
            type: SensorsLua.type,
            state: result.sensorState,
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
            state: result.sensorState,
            result: result.res
        };
    }

    async sendData(rawReading) {
        const result = {
            type: SensorsLua.type,
            state: "stream",
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
