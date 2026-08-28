import MailboxState from "../../constants/mailboxStates";
import PromiseDevice from "../../helpers/promiseDevice.js";

export default class SystemInfo {
    static type = "sysinfo";
    static needsScreenOn = false;

    async handle(_) {
        return await this.get();
    }

    async get() {
        const main = await PromiseDevice.getInfo();
        const storage =  await PromiseDevice.getStorageOverview();
        const serial = await PromiseDevice.getSerial() ?? "-";

        let deviceId = "";
        // there are 2 functions
        // might as well use them :)
        deviceId = await PromiseDevice.getDeviceId()
            .catch(() => PromiseDevice.getId())
            .catch(() => "-");

        return {
            type: SystemInfo.type,
            state: MailboxState.DONE,
            res: {
                main,
                storage,
                serial,
                deviceId
            }
        }
    }
}