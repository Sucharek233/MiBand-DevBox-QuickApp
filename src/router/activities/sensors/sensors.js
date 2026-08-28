import PromiseBrightness from "../../../helpers/promiseBrightness"
import SensorProvider from "./providers/system.sensor";
import MailboxState from "../../../constants/mailboxStates";

export default class Sensors {
    static type = "sensors";
    static needsScreenOn = true;

    constructor(interconnect) {
        this.interconnect = interconnect;
        this.sensorProvider = new SensorProvider();
        this.brightness = PromiseBrightness;

        this.subscribed = false;
        this.subscribedSensor = undefined;

        this.maxEntriesPerSend = 10;
        this.data = [];

        this.sendInterval = 1000
        this.sendTimer = null;
    }

    async handle(message) {
        return await this.prepare(message.args);
    }

    async prepare(args) {
        const sensor = args.sensor;
        const request = args.req;

        if (!request) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: "No request"
            }
        }

        if (request == "list") {
            return await this.returnList();

        } else if (request == "listLite") {
            return await this.returnListLite();

        } else if (request == "sub") {
            if (!sensor) {
                return {
                    type: Sensors.type,
                    state: MailboxState.ERROR,
                    msg: "No sensor"
                }
            }
            
            return await this.subscribe(sensor);
            
        } else if (request == "unsub") {
            await this.brightness.setKeepScreenOn(false);
            return await this.unsubscribe();
        }
    }

    async returnList() {
        const sensorList = await this.sensorProvider.gatherSensorData();
        return {
            type: Sensors.type,
            state: MailboxState.DONE,
            res: sensorList
        }
    }

    async returnListLite() {
        const sensorList = await this.sensorProvider.getAvailableSensorsLite();
        return {
            type: Sensors.type,
            state: MailboxState.DONE,
            res: sensorList
        }
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
                samples.push(
                    this.data[Math.floor(i * step)]
                );
            }
        }

        const result = {
            type: Sensors.type,
            state: MailboxState.STREAM,
            samples: samples
        };

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

    async subscribe(sensor) {
        if (this.subscribed) {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: "Already subscribed"
            };
        }

        if (!sensor || sensor.trim() == "") {
            return {
                type: Sensors.type,
                state: MailboxState.ERROR,
                msg: "No sensor specified"
            };
        }

        try {
            this.subscribedSensor = this.sensorProvider.getSensor(
                sensor,
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
            // Rollback state if initialization fails
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