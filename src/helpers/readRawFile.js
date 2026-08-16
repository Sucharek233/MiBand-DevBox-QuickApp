import base64 from "../libs/base64.min.js";
import crypto from "@system.crypto"
import promiseFile from "./promiseFile.js";

export default class ReadFileRaw {
    constructor(uri, chunkSize = 9984) {
        this.uri = uri;

        this.size = -1;
        this.totalChunks = 0;
        this.currChunk = 0;

        this.currPos = 0;
        
        this.chunkSize = chunkSize;
    }

    uint8ToByteString(uint8) {
        let str = "";
        const len = uint8.length;
        for (let i = 0; i < len; i++) {
            str += String.fromCharCode(uint8[i]);
        }
        return str;
    }

    async getChunk(start, length) {
        const chunk = await promiseFile.readBuffer(this.uri, start, length);
        console.log("file read");
        const byteStr = this.uint8ToByteString(chunk);
        console.log("in byteStr");
        // return base64.encode(byteStr);
        // return crypto.btoa(byteStr);
        return byteStr
    }

    async init() {
        if (this.size === -1) {
            const info = await promiseFile.getInfo(this.uri);
            this.size = info.length;
            // this.totalChunks = Math.ceil(this.size / this.chunkSize) || 1;
            this.totalChunks = 20;
        }
    }

    async next() {
        console.log("next");
        // if (this.size === -1) {
        //     await this.init();
        // }
        this.size = 90000;
        this.totalChunks = 25;
        console.log("init end");

        if (this.size === 0) {
            return {
                state: "finished",
                totalChunks: 0,
                currChunk: this.currChunk
            };
        }

        if (this.currPos >= this.size) {
            return {
                state: "finished",
                totalChunks: this.totalChunks,
            };
        }

        const bytesToRead = Math.min(this.chunkSize, this.size - this.currPos);

        console.log("get start");
        const base64Chunk = await this.getChunk(this.currPos, bytesToRead);
        console.log("get stop");

        this.currChunk++;
        this.currPos += bytesToRead;

        const isLastChunk = this.currPos >= this.size;

        return {
            state: isLastChunk ? "finished" : "next",
            chunk: base64Chunk,
            checksum: null, 
            totalChunks: this.totalChunks,
            currChunk: this.currChunk,
            bytesRead: bytesToRead
        };
    }

    reset() {
        this.currPos = 0;
        this.currChunk = 0;
        this.size = -1;
    }
}