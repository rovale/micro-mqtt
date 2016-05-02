/**
 * MQTT over TCP/IP sockets.
 */
/**
 * Optimization, the TypeScript compiler replaces the constant enums.
 */
const enum Constants {
    ConnectionTimeout = 5,
    DefaultPort = 1883
}

export interface NetConnectOptions {
    host: string;
    port: number;
}

export interface Net {
    connect: (options: NetConnectOptions, callback: (socket: Socket) => void) => void;
}

export interface Socket {
    write: (data: string) => void;
    on: (event: string, listener: (data: string) => void) => void;
    removeAllListeners: (event: string) => void;
    end: () => void;
}

export class MqttNet {
    private host: string;
    private port: number;

    private net: Net;
    private sct: Socket;

    private ctId: number;

    protected emit: (event: string, arg?: string) => boolean;

    constructor(host: string, port: number = Constants.DefaultPort, net: Net = require('net')) {
        this.host = host;
        this.port = port;
        this.net = net;
    }

    public connect(callback?: (socket: Socket) => void) {
        this.emit('info', `Connecting to ${this.host}:${this.port}`);

        this.ctId = setTimeout(() => {
            this.emit('error', 'Network connection timeout. Retrying.');
            this.connect(callback);
        }, Constants.ConnectionTimeout * 1000);

        this.net.connect({ host: this.host, port: this.port }, (socket: Socket) => {
            clearTimeout(this.ctId);
            this.emit('info', 'Network connection established.');
            this.sct = socket;

            if (callback) {
                callback(socket);
            }

            this.sct.on('end', () => {
                this.emit('error', 'Connection lost. Reconnecting.');
                this.connect(callback);
            });

            // Remove this handler from the memory.
            this.sct.removeAllListeners('connect');
        });
    };
}