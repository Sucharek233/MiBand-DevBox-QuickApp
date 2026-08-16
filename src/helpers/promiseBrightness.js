import brightness from '@system.brightness';

// Official docs:
// https://iot.mi.com/vela/quickapp/en/features/system/brightness.html

class PromiseBrightness {
    // Returns value 0 - 255
    getValue() {
        return new Promise((resolve, reject) => {
            brightness.getValue({
                success: ({ value }) => resolve(value),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    // Brightness value 0 - 255
    setValue(value) {
        return new Promise((resolve, reject) => {
            brightness.setValue({
                value: value,

                success: () => resolve(),
                fail: (_, code) => reject(code)
            });
        });
    }

    // Mode - 0: manual, 1: auto
    getMode() {
        return new Promise((resolve, reject) => {
            brightness.getMode({
                success: ({ mode }) => resolve(mode),
                fail: (_, code) => reject(code)
            });
        });
    }

    // Mode - 0: manual, 1: auto
    setMode(mode) {
        return new Promise((resolve, reject) => {
            brightness.setMode({
                mode: mode,

                success: () => resolve(),
                fail: (_, code) => reject(code)
            });
        });
    }

    setKeepScreenOn(keepScreenOn) {
        return new Promise((resolve, reject) => {
            brightness.setKeepScreenOn({
                keepScreenOn: keepScreenOn,

                success: () => resolve(),
                fail: (_, code) => reject(code)
            });
        });
    }
}

export default new PromiseBrightness();