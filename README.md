# MiBand DevBox QuickApp
QuickJS service for DevBox

This QuickApp is intended to run alongside the [MiBand DevBox Lua Service](https://github.com/Sucharek233/MiBand-DevBox-Watchface).

![Service preview](images/devbox.png)

## User Interface
- **Connect**: connect to the Android app
- **Ping Lua** - check whether the Lua service is responding
- **Logs** - show recent connection, request, response, and error messages
- **Clear** - clear the visible logs
- **Exit**

When a request is being handled, the app displays a screen saver overlay.

## How It Works
1. The app initializes an interconnect client and the mailbox at `internal://files/mailbox.json`
2. Lua and QuickJS activities are created and registered with the router
3. The interconnect client receives a JSON message containing an activity `type`
4. The router looks up the matching activity and passes it the decoded request
5. The activity validates its arguments, performs the operation directly or through the Lua mailbox, and returns a result
6. The QuickApp sends the result back through interconnect
7. If an activity fails, the QuickApp records the error and sends it back over interconnect

**Mi Fitness mod is required for this to work!**

The mailbox state is stored at `internal://files/state`. Requests that use the Lua service must be supported by the corresponding activity in that service.

## Mailbox States
| Value | State |
| ---: | --- |
| `0` | `DONE` |
| `1` | `IDLE` |
| `2` | `PENDING` |
| `3` | `RUNNING` |
| `4` | `ERROR` |
| `5` | `TIMEOUT` |
| `6` | `STREAM` |

## Request Format
Requests are in JSON containing:
- `type` - the target activity
- `args` - arguments passed to the activity

### Example
```json
{
  "type": "modules",
    "args": {
        "type": "compat",
        "modules": ["system.sensor", "system.app"]
    }
}
```

## Response Format
Responses preserve `type` and add `state`, `res`.

If an activity reports an error, `msg` and `stack` get added instead of `res`.

### Success example:
```json
{
  "type": "modules",
  "state": 0,
  "res": {
    "system.sensor": true,
    "system.app": true
  }
}
```

### Error example:
```json
{
  "type": "modules"
  "state": 4,
  "msg": "'hiidontexist' is not defined",
  "stack": "    at checkCompatibility (pages/index/index.js:1639)\\n    at run..."
}
```

## Available Activities

### Lua
| Name | Type | Purpose |
| --- | --- | --- |
| Ping | `ping` | Check that the service is responding |
| Terminal | `cmd` | Execute shell commands |
| File Manager | `io` | File operations and file streaming |
| Sensors | `sensorsLua` | List sensors and sensor data streaming |
| Apps | `apps` | Read and update application lists and manifests; retrieve icons |
| System Info | `sysInfoLua` | Read system information and get/set system properties |
| Lua Shell | `luashell` | Execute Lua code |

### QuickJS
| Name | Type | Purpose |
| --- | --- | --- |
| QuickJS Shell | `qjs` | Execute QuickJS code|
| System Info | `sysinfo` | Read system information |
| Sensors | `sensors` | List sensors and sensor data streaming |
| Module Compatibility | `modules` | Check if a module is available to use and its functions |
| Miscellaneous | `misc` | Misc utilities |

Refer to [DevBox docs](https://github.com/Sucharek233/MiBand-DevBox/tree/master/docs) for available arguments.

## Adding an Activity
1. Create the activity module under `src/router/activities/lua` or `src/router/activities/qjs`
2. Give it a unique static `type` value and a static `needsScreenOn` value
3. Implement its request handler and return a structured result using the mailbox states where appropriate
4. Register the activity in `src/pages/index/index.ux` inside `setupRouter()`
5. Add argument validation and any required helper

## Compilation
Open the project in [AIoT IDE](https://iot.mi.com/vela/quickapp) to compile and deploy the QuickApp.

The app is compiled with `jsc` enabled to improve performance. More on build flags [here](https://iot.mi.com/vela/quickapp/en/guide/start/toolkit-params.html#common-build-parameters).
```bash
npx aiot release --enable-jsc
```

## License
This project is licensed under the GPL v3.0 license.