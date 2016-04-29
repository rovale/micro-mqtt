/// <reference path='_common.ts'/>
import ConnectionOptions from './ConnectionOptions';
import ControlPacketType from './ControlPacketType';

/**
 * Optimization, the TypeScript compiler replaces the constant enums.
 */
const enum Constants {
    PingInterval = 40,
    ConnectionTimeout = 5,
    DefaultPort = 1883,
    DefaultQos = 0
}

/**
 * Connect flags
 * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349229
 */
export const enum ConnectFlags {
    UserName = 0b10000000,
    Password = 0b01000000,
    WillRetain = 0b00100000,
    WillQoS2 = 0b00010000,
    WillQoS1 = 0b00001000,
    Will = 0b00000100,
    CleanSession = 0b00000010
}

/**
 * Connect Return code
 * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349256
 */
export const enum ConnectReturnCode {
    Accepted = 0,
    UnacceptableProtocolVersion = 1,
    IdentifierRejected = 2,
    ServerUnavailable = 3,
    BadUserNameOrPassword = 4,
    NotAuthorized = 5
}

export interface NetworkConnectOptions {
    host: string;
    port: number;
}

export interface NetworkSocket {
    write: (data: string) => void;
    on: (event: string, listener: (data: string) => void) => void;
    removeAllListeners: (event: string) => void;
    end: () => void;
}

export interface Network {
    connect: (options: NetworkConnectOptions, callback: (socket: NetworkSocket) => void) => void;
}

export interface PublishPacket {
    pid?: number;
    topic: string;
    message: string;
    qos: number;
    retain: number;
    next?: number;
}

/**
 * The MQTT client.
 */
export interface Client {
    on: (event: string, listener: (arg: string | PublishPacket) => void) => void;
}

export class Client {
    public version = '0.0.17';

    private opt: ConnectionOptions;

    private net: Network;
    private sct: NetworkSocket;

    protected emit: (event: string, arg?: string | PublishPacket) => boolean;

    private ctId: number;
    private piId: number;

    constructor(opt: ConnectionOptions, net: Network = require('net')) {
        opt.port = opt.port || Constants.DefaultPort;
        opt.clientId = opt.clientId || '';

        if (opt.will) {
            opt.will.qos = opt.will.qos || Constants.DefaultQos;
            opt.will.retain = opt.will.retain || false;
        }

        this.opt = opt;
        this.net = net;
    }

    private static describe(code: ConnectReturnCode) {
        let error = 'Connection refused, ';
        switch (code) {
            case ConnectReturnCode.UnacceptableProtocolVersion:
                error += 'unacceptable protocol version.';
                break;
            case ConnectReturnCode.IdentifierRejected:
                error += 'identifier rejected.';
                break;
            case ConnectReturnCode.ServerUnavailable:
                error += 'server unavailable.';
                break;
            case ConnectReturnCode.BadUserNameOrPassword:
                error += 'bad user name or password.';
                break;
            case ConnectReturnCode.NotAuthorized:
                error += 'not authorized.';
                break;
            default:
                error += 'unknown return code: ' + code + '.';
        }
        return error;
    }

    public connect = () => {
        this.emit('info', `Connecting to ${this.opt.host}:${this.opt.port}`);

        this.net.connect({ host: this.opt.host, port: this.opt.port }, (socket: NetworkSocket) => {
            clearTimeout(this.ctId);
            this.emit('info', 'Network connection established.');
            this.sct = socket;

            this.sct.write(Protocol.createConnect(this.opt));

            this.ctId = setTimeout(() => {
                this.emit('error', 'MQTT connection timeout. Reconnecting.');
                this.connect();
            }, Constants.ConnectionTimeout * 1000);

            this.sct.on('data', (data: string) => {
                const controlPacketType: ControlPacketType = data.charCodeAt(0) >> 4;
                this.emit('debug', `Rcvd: ${controlPacketType}: '${data}'.`);
                this.handleData(data);
            });

            this.sct.on('end', () => {
                this.emit('error', 'MQTT client disconnected. Reconnecting.');
                clearInterval(this.piId);
                this.connect();
            });

            // Remove this handler from the memory.
            this.sct.removeAllListeners('connect');
        });

        this.ctId = setTimeout(() => {
            this.emit('error', 'Network connection timeout. Retrying.');
            this.connect();
        }, Constants.ConnectionTimeout * 1000);
    };

    private handleData = (data: string) => {
        const controlPacketType: ControlPacketType = data.charCodeAt(0) >> 4;
        switch (controlPacketType) {
            case ControlPacketType.ConnAck:
                clearTimeout(this.ctId);
                const returnCode = data.charCodeAt(3);
                if (returnCode === ConnectReturnCode.Accepted) {
                    this.emit('info', 'MQTT connection accepted.');
                    this.emit('connected');

                    this.piId = setInterval(this.ping, Constants.PingInterval * 1000);
                } else {
                    const connectionError = Client.describe(returnCode);
                    this.emit('error', connectionError);
                }
                break;
            case ControlPacketType.Publish:
                const parsedData = Protocol.parsePublish(data);
                this.emit('publish', parsedData);
                if (parsedData.qos > 0) {
                    setTimeout(() => { this.sct.write(Protocol.createPubAck(parsedData.pid)); }, 0);
                }
                if (parsedData.next) {
                    this.handleData(data.substr(parsedData.next));
                }

                break;
            case ControlPacketType.PingResp:
            case ControlPacketType.PubAck:
            case ControlPacketType.SubAck:
                break;
            default:
                this.emit('error', `MQTT unexpected packet type: ${controlPacketType}.`);
                break;
        }
    };

    /** Publish a message */
    public publish = (topic: string, message: string, qos = Constants.DefaultQos, retained = false) => {
        this.sct.write(Protocol.createPublish(topic, message, qos, true));
    };

    /** Subscribe to topic */
    public subscribe = (topic: string, qos = Constants.DefaultQos) => {
        this.sct.write(Protocol.createSubscribe(topic, qos));
    };

    private ping = () => {
        this.sct.write(Protocol.createPingReq());
        this.emit('debug', 'Sent: Ping request.');
    };
}

/**
 * The specifics of the MQTT protocol.
 */
export module Protocol {
    export const enum Constants {
        // FIXME: The packet id is fixed.
        FixedPackedId = 1,
        KeepAlive = 60
    }

    /** 
     * Remaining Length
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718023
     */
    export function remainingLength(length: number) {
        const encBytes: number[] = [];
        do {
            let encByte = length & 0b01111111;
            length = length >> 7;
            // if there are more data to encode, set the top bit of this byte
            if (length > 0) {
                encByte += 0b10000000;
            }
            encBytes.push(encByte);
        } while (length > 0);
        return encBytes;
    }

    /**
     * Connect flags
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349229
     */
    function createConnectFlags(options: ConnectionOptions) {
        let flags = 0;
        flags |= (options.username) ? ConnectFlags.UserName : 0;
        flags |= (options.username && options.password) ? ConnectFlags.Password : 0;
        flags |= ConnectFlags.CleanSession;

        if (options.will) {
            flags |= ConnectFlags.Will;
            flags |= options.will.qos << 3;
            flags |= (options.will.retain) ? ConnectFlags.WillRetain : 0;
        }

        return flags;
    }

    /** Returns the MSB and LSB. */
    function getBytes(int16: number) {
        return [int16 >> 8, int16 & 255];
    }

    /** 
     * Structure of UTF-8 encoded strings
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Figure_1.1_Structure
     */
    function pack(s: string) {
        return String.fromCharCode(...getBytes(s.length)) + s;
    }

    /** 
     * Structure of an MQTT Control Packet
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800392
     */
    function createPacket(byte1: number, variable: string, payload: string = '') {
        const byte2 = remainingLength(variable.length + payload.length);

        return String.fromCharCode(byte1) +
            String.fromCharCode(...byte2) +
            variable +
            payload;
    }

    /**
     * CONNECT - Client requests a connection to a Server
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718028
     */
    export function createConnect(options: ConnectionOptions) {
        const byte1 = ControlPacketType.Connect << 4;

        const protocolName = pack('MQTT');
        const protocolLevel = String.fromCharCode(4);
        const flags = String.fromCharCode(createConnectFlags(options));

        const keepAlive: string = String.fromCharCode(...getBytes(Constants.KeepAlive));

        let payload = pack(options.clientId);

        if (options.will) {
            payload += pack(options.will.topic);
            payload += pack(options.will.message);
        }

        if (options.username) {
            payload += pack(options.username);
            if (options.password) {
                payload += pack(options.password);
            }
        }

        return createPacket(
            byte1,
            protocolName + protocolLevel + flags + keepAlive,
            payload
        );
    }

    /** PINGREQ - PING request
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800454
    */
    export function createPingReq() {
        return String.fromCharCode(ControlPacketType.PingReq << 4, 0);
    }

    /** 
     * PUBLISH - Publish message
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800410
     */
    export function createPublish(topic: string, message: string, qos: number, retained: boolean) {
        let byte1 = ControlPacketType.Publish << 4 | (qos << 1);
        byte1 |= (retained) ? 1 : 0;

        const pid = String.fromCharCode(...getBytes(Constants.FixedPackedId));
        const variable = (qos === 0) ? pack(topic) : pack(topic) + pid;
        return createPacket(byte1, variable, message);
    }

    export function parsePublish(data: string): PublishPacket {
        const cmd = data.charCodeAt(0);
        const qos = (cmd & 0b00000110) >> 1;
        const remainingLength = data.charCodeAt(1);
        const topicLength = data.charCodeAt(2) << 8 | data.charCodeAt(3);
        let variableLength = topicLength;
        if (qos > 0) {
            variableLength += 2;
        }

        const messageLength = (remainingLength - variableLength) - 2;

        let packet: PublishPacket = {
            topic: data.substr(4, topicLength),
            message: data.substr(4 + variableLength, messageLength),
            qos: qos,
            retain: cmd & 0b00000001
        };

        if (data.charCodeAt(remainingLength + 2) > 0) {
            packet.next = remainingLength + 2;
        }

        if (qos > 0) {
            packet.pid = data.charCodeAt(4 + variableLength - 2) << 8 |
                data.charCodeAt(4 + variableLength - 1);
        }

        return packet;
    }

    /** 
     * PUBACK - Publish acknowledgement
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800416
     */
    export function createPubAck(pid: number) {
        const byte1 = ControlPacketType.PubAck << 4;
        return createPacket(byte1, String.fromCharCode(...getBytes(pid)));
    }

    /** 
     * SUBSCRIBE - Subscribe to topics
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800436
     */
    export function createSubscribe(topic: string, qos: number) {
        const byte1 = ControlPacketType.Subscribe << 4 | 2;
        const pid = String.fromCharCode(...getBytes(Constants.FixedPackedId));
        return createPacket(byte1,
            pid,
            pack(topic) +
            String.fromCharCode(qos));
    }
}
