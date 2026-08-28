import device from '@system.device';

// Official docs:
// https://iot.mi.com/vela/quickapp/en/features/basic/device.html

class PromiseDevice {
    // Returns value 0 - 255
    getInfo() {
        return new Promise((resolve, reject) => {
            device.getInfo({
                success: (ret) => resolve(ret),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    getDeviceId() {
        // device.getDeviceId() without a callback or any arguments should also work (works in the emulator)
        // but here I'm playing it safe with the callback
        return new Promise((resolve, reject) => {
            device.getDeviceId({
                success: ({ deviceId }) => resolve(deviceId),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }
    // does the same thing as getDeviceId(), but for some reason is also a function
    // there is one difference, this function requires a callback (tested in an emulator)
    getId() {
        return new Promise((resolve, reject) => {
            device.getId({
                success: ({ deviceId }) => resolve(deviceId),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    getSerial() {
        return new Promise((resolve, reject) => {
            device.getSerial({
                success: ({ serial }) => resolve(serial),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    getTotalStorage() {
        return new Promise((resolve, reject) => {
            device.getTotalStorage({
                success: ({ totalStorage }) => resolve(totalStorage),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    getAvailableStorage() {
        return new Promise((resolve, reject) => {
            device.getAvailableStorage({
                success: ({ availableStorage }) => resolve(availableStorage),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    // isn't an official function
    // returns total, available and used storage in bytes
    async getStorageOverview() {
        const total = await this.getTotalStorage();
        const available = await this.getAvailableStorage();
        const used = total - available;

        return {
            total,
            available,
            used
        }
    }
}

export default new PromiseDevice();