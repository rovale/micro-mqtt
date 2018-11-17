var events = require('events');
var Client = require('../../espruino/modules/micro-mqtt').Client;

class NodeEventEmitter extends events.EventEmitter {
}

class NodeClient extends Client {
    constructor(options) {
        super(options);

        this.nodeEventEmitter = new NodeEventEmitter();
    }

    on(event, listener) {
        this.nodeEventEmitter.on(event, listener);
    }

    emit(event, args) {
        this.nodeEventEmitter.emit(event, args)
    }    

    onConnect() {
        this.sct.setEncoding('binary');
    }

    write(data) {
        this.sct.write(data, 'binary');
    }
}

exports.NodeClient = NodeClient;
