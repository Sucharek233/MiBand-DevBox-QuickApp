const MailboxState = Object.freeze({
    IDLE: "idle",
    PENDING: "pending",
    RUNNING: "running",
    DONE: "done",
    ERROR: "error",
    TIMEOUT: "timeout"
});

export default MailboxState;