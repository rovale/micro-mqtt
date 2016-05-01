/**
 * MQTT over TCP/IP sockets.
 */
/**
 * Optimization, the TypeScript compiler replaces the constant enums.
 */
const enum Constants {
    ConnectionTimeout = 5
}

export interface NetConnectOptions {
    host: string;
    port: number;
}

export interface Socket {
    write: (data: string) => void;
    on: (event: string, listener: (data: string) => void) => void;
    removeAllListeners: (event: string) => void;
    end: () => void;
}

export interface Net {
    connect: (options: NetConnectOptions, callback: (socket: Socket) => void) => void;
}

export class MqttNet implements Net {
    private net: Net;
    private sct: Socket;

    private ctId: number;

    protected emit: (event: string, arg?: string) => boolean;

    constructor(net: Net = require('net')) {
        this.net = net;
    }

    public connect(options: NetConnectOptions, callback?: (socket: Socket) => void) {
        this.emit('info', `Connecting to ${options.host}:${options.port}`);

        this.ctId = setTimeout(() => {
            this.emit('error', 'Network connection timeout. Retrying.');
            this.connect(options, callback);
        }, Constants.ConnectionTimeout * 1000);

        this.net.connect({ host: options.host, port: options.port }, (socket: Socket) => {
            clearTimeout(this.ctId);
            this.emit('info', 'Network connection established.');
            this.sct = socket;

            if (callback) {
                callback(socket);
            }

            this.sct.on('end', () => {
                this.emit('error', 'Connection lost. Reconnecting.');
                this.connect(options, callback);
            });

            // Remove this handler from the memory.
            this.sct.removeAllListeners('connect');
        });
    };
}