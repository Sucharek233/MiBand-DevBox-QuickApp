import sensor from "@system.sensor"

export default class SensorProvider {
    // static type = "sensorProvider";

    constructor() {
        this.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        this.sensors = undefined
    }

    // Just return the functions
    async getAvailableSensorsLite() {
        const functions = Reflect.ownKeys(sensor);
        const sensors = {};

        for (const fn of functions) {
            if (typeof fn === "string" && fn.startsWith("subscribe") && fn !== "subscribe") {
                const sensorName = fn.substring(9); // remove subscribe from the start of the function
                sensors[sensorName] = {
                    subscribeFn: fn,
                    unsubscribeFn: `un${fn}`,
                    available: true
                };
            }
        }
        return sensors;
    }
    
    async getAvailableSensors() {
        const functions = Reflect.ownKeys(sensor);
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
        return sensors;
    }

    async getSensorProps(sensors, timeoutMs = 1500) {
        const sensorNames = Object.keys(sensors);
    
        for (const name of sensorNames) {
            const meta = sensors[name];
            
            // Ensure functions exist
            if (typeof sensor[meta.subscribeFn] !== "function") {
                meta.available = false;
                meta.error = "Subscribe method missing";
                continue;
            }
    
            let isSettled = false;
            let isSubscribed = false;
    
            await new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    if (!isSettled) {
                        isSettled = true;
                        meta.available = false;
                        meta.error = "Timeout waiting for data";
    
                        // Only attempt unsubscribe if subscribe succeeded
                        if (isSubscribed && typeof sensor[meta.unsubscribeFn] === "function") {
                            try {
                                sensor[meta.unsubscribeFn]();
                            } catch (e) {
                                /* ignore cleanup errors */
                            }
                        }
                        resolve();
                    }
                }, timeoutMs);
    
                try {
                    // Call method with proper 'sensor' binding
                    sensor[meta.subscribeFn]({
                        callback: (ret) => {
                            if (!isSettled) {
                                isSettled = true;
                                clearTimeout(timeoutId);
    
                                meta.available = true;
                                meta.sampleData = ret;
                                meta.properties = Object.keys(ret || {});
    
                                // Unsubscribe cleanly
                                if (typeof sensor[meta.unsubscribeFn] === "function") {
                                    try {
                                        sensor[meta.unsubscribeFn]();
                                    } catch (e) {
                                        /* ignore cleanup errors */
                                    }
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
    
                    isSubscribed = true;
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
    
            await this.sleep(500);
        }
    
        return sensors;
    }

    async gatherSensorData() {
        const sensorList = await this.getAvailableSensors();
        this.sensors = await this.getSensorProps(sensorList);

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
            callback: (ret) => onData(ret),
            fail: (msg, code) => onError(msg, code)
        });
        return {
            unsubscribe: () => unsubscribeMethod()
        };
    }
}