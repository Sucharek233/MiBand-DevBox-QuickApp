import file from '@system.file';

// Official docs:
// https://iot.mi.com/vela/quickapp/en/features/data/file.html

// Very useful btw:
// https://iot.mi.com/vela/quickapp/en/guide/framework/project-structure.html#uri

class PromiseFile {
    listFiles(uri) {
        return new Promise((resolve, reject) => {
            file.list({
                uri: uri,

                success: ({ fileList }) => resolve(fileList),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    writeText(uri, text, encoding = 'UTF-8') {
        return new Promise((resolve, reject) => {
            file.writeText({
                uri: uri,
                text: text,
                encoding: encoding,
                
                success: () => resolve(),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    readText(uri, encoding = 'UTF-8') {
        return new Promise((resolve, reject) => {
            file.readText({
                uri: uri,
                encoding: encoding,

                success: ({ text }) => resolve(text),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    writeBuffer(uri, buffer, position = 0, append = false) {
        return new Promise((resolve, reject) => {
            file.writeArrayBuffer({
                uri: uri,
                buffer: buffer,
                position: position,
                append: append,

                success: () => resolve(),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    readBuffer(uri, position = 0, length = undefined) {
        return new Promise((resolve, reject) => {
            file.readArrayBuffer({
                uri: uri,
                position: position,
                length: length,

                success: function(data) {
                    const buffer = data.buffer;
                    // The emulator returns Int8Array and values overflow
                    // Here it get's converted to the proper type (if wrong)
                    const safeBuffer =
                        (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
                    resolve(safeBuffer);
                },
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    copy(srcUri, dstUri) {
        return new Promise((resolve, reject) => {
            file.copy({
                srcUri: srcUri,
                dstUri: dstUri,

                success: (data) => resolve(data.uri),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    move(srcUri, dstUri) {
        return new Promise((resolve, reject) => {
            file.move({
                srcUri: srcUri,
                dstUri: dstUri,
                
                success: (data) => resolve(data.uri),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    delete(uri) {
        return new Promise((resolve, reject) => {
            file.delete({
                uri: uri,
                
                success: () => resolve(),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    // Checks if a file or folder exists
    exists(uri) {
        return new Promise((resolve) => {
            file.access({
                uri: uri,
                
                success: () => resolve(true),
                fail: () => resolve(false) 
            });
        });
    }

    mkdir(uri, recursive = true) {
        return new Promise((resolve, reject) => {
            file.mkdir({
                uri: uri,
                recursive: recursive,

                success: () => resolve(),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }

    rmdir(uri, recursive = true) {
        return new Promise((resolve, reject) => {
            file.rmdir({
                uri: uri,
                recursive: recursive,
                
                success: () => resolve(),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }


    // Returns info about a file or folder
    getInfo(uri) {
        return new Promise((resolve, reject) => {
            file.get({
                uri: uri,

                success: (meta) => resolve(meta),
                fail: (_, code) => reject(new Error(code))
            });
        });
    }
}

export default new PromiseFile();