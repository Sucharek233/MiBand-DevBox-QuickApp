import PromiseBrightness from "../../../../helpers/promiseBrightness"
import SensorProvider from "./providers/system.sensor";
import MailboxState from "../../../../constants/mailboxStates";
import ArgsValidator from "../../../../helpers/argsValidator";

const handlers = {
    list: {
        run: async function(self, _) {
            return await self.returnList();
        }
    },

    listLite: {
        run: async function(self, _) {
            return await self.returnListLite();
        }
    },

    sub: {
        required: {
            sensor: "string"
        },

        optional: {
            streamEntries: {
                type: "number",
                default: 10
            },

            sendInterval: {
                type: "number",
                default: 1000
            }
        },

        run: async function(self, args) {
            return await self.subscribe(args);
        }
    },

    unsub: {
        run: async function(self, _) {
            return await self.unsubscribe();
        }
    }
};

export default class Sensors {
    static type = "sensors";
    static needsScreenOn = true;

    constructor(interconnect) {
        this.interconnect = interconnect;
        this.sensorProvider = new SensorProvider();
        this.brightness = PromiseBrightness;

        this.subscribed = false;
        this.subscribedSensor = undefined;

        this.data = [];

        this.maxEntriesPerSend = 10;
        this.sendInterval = 1000;
        this.sendTimer = null;
    }

    async handle(message) {
        const args = message.args || {};
        const type = args.type;

        const handler = handlers[type];

        if (!handler) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: "Unknown type"
            };
        }

        const validation = ArgsValidator.validate(args, handler);
        if (!validation.valid) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: validation.error
            };
        }

        try {
            return await handler.run(this, args);
        } catch (e) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            };
        }
    }

    async returnList() {
        const sensorList = await this.sensorProvider.gatherSensorData();
        return {
            type: Sensors.type,
            state: MailboxState.DONE,
            res: sensorList
        };
    }

    async returnListLite() {
        const sensorList = await this.sensorProvider.getAvailableSensorsLite();
        return {
            type: Sensors.type,
            state: MailboxState.DONE,
            res: sensorList
        };
    }

    async sendData() {
        await this.brightness.setKeepScreenOn(true);

        if (this.data.length === 0) {
            return;
        }

        let samples;

        if (this.data.length <= this.maxEntriesPerSend) {
            samples = this.data;
        } else {
            const step = this.data.length / this.maxEntriesPerSend;
            samples = [];

            for (let i = 0; i < this.maxEntriesPerSend; i++) {
                samples.push(this.data[Math.floor(i * step)]);
            }
        }

        const result = {
            type: Sensors.type,
            state: MailboxState.STREAM,
            samples: samples
        };

        console.log(result);

        await this.interconnect.send(result);

        this.data.length = 0;
    }

    onData(ret) {
        this.data.push(ret);
    }

    onError(msg, code) {
        return {
            type: Sensors.type,
            state: MailboxState.ERROR,
            msg: msg,
            code: code
        };
    }

    async subscribe(args) {
        if (this.subscribed) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: "Already subscribed"
            };
        }

        try {
            this.maxEntriesPerSend = args.streamEntries;
            this.sendInterval = args.sendInterval;

            this.subscribedSensor = this.sensorProvider.getSensor(
                args.sensor,
                this.onData.bind(this),
                this.onError.bind(this)
            );

            this.subscribed = true;

            setTimeout(() => {
                this.startSendLoop();
            }, this.sendInterval);

            return {
                type: Sensors.type,
                state: MailboxState.DONE,
                msg: "Subscribed"
            };
        } catch (e) {
            this.subscribed = false;

            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            };
        }
    }

    startSendLoop() {
        if (!this.subscribed) return;

        this.sendData();

        this.sendTimer = setTimeout(() => {
            this.startSendLoop();
        }, this.sendInterval);
    }

    async unsubscribe() {
        if (!this.subscribed && !this.subscribedSensor) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: "Not subscribed"
            };
        }

        if (!this.subscribedSensor) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: "Sensor object not found"
            };
        }

        try {
            this.subscribedSensor.unsubscribe();
            clearTimeout(this.sendTimer);

            this.subscribedSensor = null;
            this.sendTimer = null;
            this.data = [];

            this.subscribed = false;

            return {
                type: Sensors.type,
                state: MailboxState.DONE,
                msg: "Unsubscribed"
            };
        } catch (e) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: e.message,
                stack: e.stack
            };
        }
    }
}