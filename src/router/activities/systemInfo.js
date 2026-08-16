import promiseDevice from "../../helpers/prosimeDevice";

export default class SystemInfo {
    static type = "sysinfo";
    static needsLua = false;

    async handle(_) {
        return await this.get();
    }

    async get() {
        const main = await promiseDevice.getInfo();
        const storage =  await promiseDevice.getStorageOverview();
        const serial = await promiseDevice.getSerial() ?? "NA";

        let deviceId = "";
        // there are 2 functions
        // might as well use them :)
        try {
            deviceId = await promiseDevice.getDeviceId();
        } catch (_) {
            deviceId = await promiseDevice.getId();
        } finally {
            deviceId = "-";
        }

        return {
            type: SystemInfo.type,
            state: "done",
            res: {
                main,
                storage,
                serial,
                deviceId
            }
        }
    }
}