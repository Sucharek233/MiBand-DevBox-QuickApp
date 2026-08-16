import geolocation from "@system.geolocation"

export default class GeolocationProvider {
    // static type = "geolocationProvider";

    constructor() {
        this.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        this.sensors = undefined
    }

    async getAvailableSensors() {
        const functions = Reflect.ownKeys(geolocation.nativeInst);
        const sensors = {};

        for (const fn of functions) {
            if (typeof fn === "string" && fn.startsWith("subscribe") && fn !== "subscribe") {
                const sensorName = fn.substring(9); // remove subscribe from the start of the function
                sensors[sensorName] = {
                    subscribeFn: fn,
                    unsubscribeFn: `un${fn}`,
                    properties: [],
                    sampleData: null,
                    available: false
                };
            }
        }
        console.log(sensors);
        return sensors;
    }

    async getSensorProps(sensors, timeoutMs = 1000) {
        const sensorNames = Object.keys(sensors);

        for (const name of sensorNames) {
            console.log(`Getting ${name}`);
            const meta = sensors[name];
            const subscribeMethod = geolocation.nativeInst[meta.subscribeFn];
            const unsubscribeMethod = geolocation.nativeInst[meta.unsubscribeFn];

            if (typeof subscribeMethod !== "function") continue;

            let isSettled = false;

            await new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    if (!isSettled) {
                        isSettled = true;
                        if (typeof unsubscribeMethod === "function") {
                            try { unsubscribeMethod(); } catch (e) {}
                        }
                        resolve();
                    }
                }, timeoutMs);

                try {
                    subscribeMethod({
                        callback: (data) => {
                            if (!isSettled) {
                                isSettled = true;
                                clearTimeout(timeoutId);

                                meta.available = true;
                                meta.sampleData = data;
                                meta.properties = Object.keys(data || {});

                                if (typeof unsubscribeMethod === "function") {
                                    try { unsubscribeMethod(); } catch (e) {}
                                }

                                resolve();
                            }
                        },
                        fail: (msg, code) => {
                            if (!isSettled) {
                                isSettled = true;
                                clearTimeout(timeoutId);
                                meta.available = false;
                                meta.error = `${msg} (${code})`;
                                resolve();
                            }
                        }
                    });
                } catch (err) {
                    if (!isSettled) {
                        isSettled = true;
                        clearTimeout(timeoutId);
                        meta.available = false;
                        meta.error = err.message;
                        resolve();
                    }
                }
            });

            await this.sleep(150);
        }

        return sensors;
    }

    async gatherSensorData() {
        const sensorList = await this.getAvailableSensors();
        this.sensors = await this.getSensorProps(sensorList);

        console.log(this.sensors);
        return this.sensors;
    }

    getSensor(sensorName, onData, onError) {
        const subscribeFnName = `subscribe${sensorName}`;
        const unsubscribeFnName = `unsubscribe${sensorName}`;

        const subscribeMethod = sensor[subscribeFnName];
        const unsubscribeMethod = sensor[unsubscribeFnName];

        if (typeof subscribeMethod !== "function") {
            throw new Error(`Not supported`);
        }

        subscribeMethod({
            callback: (ret) => {
                if (typeof onData === "function") {
                    onData(ret);
                }
            },
            fail: (msg, code) => {
                if (typeof onError === "function") {
                    onError(code, msg);
                } else {
                    console.log(code, msg);
                }
            }
        });

        // Return the control handle object
        return {
            unsubscribe: () => {
                try {
                    unsubscribeMethod();
                    console.log(`[${sensorName}] Successfully unsubscribed.`);
                } catch (err) {
                    console.log(`[${sensorName}] Failed to unsubscribe:`, err.message);
                }
            }
        };
    }
}