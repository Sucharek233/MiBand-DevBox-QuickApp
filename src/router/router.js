export default class Router {
    constructor() {
        this.routes = {};
    }

    register(type, needsLua, handler) {
        this.routes[type] = {
            handler: handler,
            needsLua: needsLua
        };
    }

    async handle(message) {
        const handler = this.routes[message.type];
        if (!handler) {
            throw new Error(
                `Unknown message type: ${message.type}`
            );
        }
        return handler(message);
    }
}