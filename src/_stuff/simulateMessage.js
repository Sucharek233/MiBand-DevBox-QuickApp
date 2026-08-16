aiot.appCtx.messageReceived(
    JSON.stringify(
        {
            type: "cmd",
            args: {
                cmd: "ls /"
            }
        }
    )
)

aiot.appCtx.messageReceived(
    JSON.stringify(
        {
            type: "qjs",
            args: {
                code: "return 'hi'"
            }
        }
    )
)

aiot.appCtx.messageReceived(
    JSON.stringify(
        {
            type: "modules",
            args: {
                type: "compat",
                modules: ["system.sensor", "system.app"]
            }
        }
    )
)
aiot.appCtx.messageReceived(
    JSON.stringify(
        {
            type: "modules",
            args: {
                type: "funcs",
                module: "system.app"
            }
        }
    )
)

aiot.appCtx.messageReceived(
    JSON.stringify(
        {
            type: "sensor",
            args: {
                type: "sub",
                sensor: "Accelerometer"
            }
        }
    )
)

// sum cool stuff
const sensor = this.$app_require$("@app-module/system.sensor");
let unsubNum = sensor.subscribe({ type: 2, callback: (res) => console.log(res) });
sensor.unsubscribe(unsubNum);

// other
setTimeout(async function() {
    try {
        console.log(await aiot.appCtx.file.writeText("internal://tmp/hi", "w"))
    } catch (error) {
        console.log(error.message, error.stack)
    }
    
}, 1)