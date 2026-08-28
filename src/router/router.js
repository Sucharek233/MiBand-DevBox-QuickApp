export default class Router {
    constructor() {
        this.routes = {};
    }

    register(type, needsScreenOn, handler) {
        this.routes[type] = {
            handler: handler,
            needsScreenOn: needsScreenOn
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