const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.join(__dirname, "../src/communication/interconnect.js"), "utf8"
).replace('import interconnect from "@system.interconnect";', "")
 .replace('import app from "@system.app";', "")
 .replace("export default class InterconnectClient", "globalThis.InterconnectClient = class InterconnectClient");

function createClient(app, interconnect) {
    const context = vm.createContext({ app, interconnect, console });
    vm.runInContext(source, context);
    return new context.InterconnectClient();
}

test("legacy runtime waits for a real open event before allowing sends", async () => {
    let instances = 0;
    let opened = 0;
    let received;
    let sent;
    const connection = {
        send({ data, success }) { sent = data; success("ack"); }
    };
    const client = createClient({}, { instance() { instances++; return connection; } });
    client.onOpen(() => opened++);
    client.onMessage(data => { received = data; });

    await client.connect();
    assert.equal(client.isConnected(), false);
    assert.equal(client.connecting, true);
    assert.throws(() => client.send("too early"), /Not connected/);
    connection.onopen();
    assert.equal(client.isConnected(), true);
    assert.equal(client.connecting, false);
    assert.equal(opened, 1);
    await client.connect();
    assert.equal(instances, 1);
    connection.onmessage({ data: "ping" });
    assert.equal(received, "ping");
    assert.equal(await client.send("pong"), "ack");
    assert.equal(sent, "pong");
    connection.onclose();
    assert.equal(client.isConnected(), false);
    assert.throws(() => client.send("too late"), /Not connected/);
});

test("newer runtime retains its capability and readiness queries", async () => {
    let queried = false;
    const client = createClient({
        canIUse(name) { assert.equal(name, "@system.interconnect"); return true; }
    }, {
        instance: () => ({ getReadyState({ success }) { queried = true; success({ status: 1 }); } })
    });
    await client.connect();
    assert.equal(queried, true);
    assert.equal(client.isConnected(), true);
    assert.equal(client.connecting, false);
});

test("explicitly unavailable interconnect is still rejected", async () => {
    const client = createClient({ canIUse: () => false }, {
        instance() { assert.fail("must not create an unsupported connection"); }
    });
    await assert.rejects(client.connect(), /Interconnect API unavailable/);
    assert.equal(client.connecting, false);
});

test("missing instance API produces an actionable error", async () => {
    const client = createClient({}, {});
    await assert.rejects(client.connect(), /Interconnect instance API unavailable/);
    assert.equal(client.connecting, false);
});

test("synchronous initialization failure does not block retry", async () => {
    let attempts = 0;
    const connection = {};
    const client = createClient({}, {
        instance() { if (++attempts === 1) throw new Error("temporary failure"); return connection; }
    });
    await assert.rejects(client.connect(), /temporary failure/);
    assert.equal(client.connecting, false);
    await client.connect();
    connection.onopen();
    assert.equal(attempts, 2);
    assert.equal(client.isConnected(), true);
});

test("close and error events clear a pending legacy connection attempt", async () => {
    const connection = {};
    const client = createClient({}, { instance: () => connection });
    await client.connect();
    connection.onclose();
    assert.equal(client.connecting, false);
    await client.connect();
    connection.onerror({ code: 1006 });
    assert.equal(client.connecting, false);
    assert.equal(client.isConnected(), false);
});

test("disconnect clears a pending legacy connection attempt", async () => {
    let destroyed = false;
    const client = createClient({}, { instance: () => ({ destroy() { destroyed = true; } }) });
    await client.connect();
    client.disconnect();
    assert.equal(destroyed, true);
    assert.equal(client.connecting, false);
    assert.equal(client.isConnected(), false);
});
