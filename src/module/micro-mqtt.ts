/// <reference path='_common.ts'/>
import ConnectionOptions from './ConnectionOptions';
import ControlPacketType from './ControlPacketType';

const pingInterval = 40;
const connectionTimeout = 5;
const defaultPort = 1883;
const defaultQosLevel = 0;

/**
 * Connect flags
 * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349229
 */
export const enum ConnectFlags {
    UserName        = 0b10000000,
    Password        = 0b01000000,
    WillRetain      = 0b00100000,
    WillQoS2        = 0b00010000,
    WillQoS1        = 0b00001000,
    Will            = 0b00000100,
    CleanSession    = 0b00000010
}

/**
 * Connect Return code
 * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349256
 */
const enum ConnectReturnCode {
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
    end: () => void;
}

export interface Network {
    connect: (options: NetworkConnectOptions, callback: (socket: NetworkSocket) => void) => void;
}

/**
 * The MQTT client.
 */
export class MicroMqttClient {
    public version = '0.0.7';

    private options: ConnectionOptions;
    private network: Network;

    private networkSocket: NetworkSocket;
    private connected = false;

    protected emit: (event: string, ...args: any[]) => boolean;

    private connectionTimeOutId: number;
    private pingIntervalId: number;

    constructor(options: ConnectionOptions, network: Network = require('net')) {
        options.port = options.port || defaultPort;
        options.clientId = options.clientId || MicroMqttClient.generateClientId();
        options.cleanSession = options.cleanSession || true;

        this.options = options;
        this.network = network;
    }

    private static generateClientId = () => {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + s4();
    };

    private static getConnectionError(returnCode: number) {
        let error = 'Connection refused, ';
        switch (returnCode) {
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
                error += 'unknown return code: ' + returnCode + '.';
        }
        return error;
    }

    public connect = () => {
        this.emit('info', `Connecting MicroMqttClient ${this.version} to ${this.options.host}:${this.options.port}`);
        this.network.connect({ host: this.options.host, port: this.options.port }, (socket) => this.onNetworkConnected(socket));
        // TODO: Reconnect on timeout
    };

    private onNetworkConnected = (socket: NetworkSocket) => {
        this.emit('info', 'Network connection established');
        this.networkSocket = socket;

        this.networkSocket.write(MqttProtocol.createConnectPacket(this.options));
        // Disconnect if no CONNACK is received
        this.connectionTimeOutId = setTimeout(() => {
            this.disconnect();
        }, connectionTimeout * 1000);

        this.networkSocket.on('data', (data: string) => this.onNetworkData(data));
        this.networkSocket.on('end', this.onNetworkEnd);
    };

    private onNetworkData = (data: string) => {
        const controlPacketType: ControlPacketType = data.charCodeAt(0) >> 4;

        this.emit('debug', `Rcvd: ${controlPacketType}: '${data}'`);

        switch (controlPacketType) {
            case ControlPacketType.Publish:
                const parsedData = MqttProtocol.parsePublish(data);
                this.emit('publish', parsedData);
                break;
            case ControlPacketType.PubAck:
            case ControlPacketType.SubAck:
            case ControlPacketType.UnsubAck:
            case ControlPacketType.PingResp:
                break;
            case ControlPacketType.PingReq:
                this.networkSocket.write(ControlPacketType.PingResp + '\x00'); // reply to PINGREQ
                break;
            case ControlPacketType.ConnAck:
                clearTimeout(this.connectionTimeOutId);
                const returnCode = data.charCodeAt(3);
                if (returnCode === ConnectReturnCode.Accepted) {
                    this.connected = true;
                    this.emit('info', 'MQTT connection accepted');
                    this.emit('connected');

                    // Set up regular keep alive ping
                    this.pingIntervalId = setInterval(() => {
                        this.ping();
                    }, pingInterval * 1000);
                } else {
                    const connectionError = MicroMqttClient.getConnectionError(returnCode);
                    this.emit('error', connectionError);
                }
                break;
            default:
                this.emit('error', 'MQTT unsupported packet type: ' + controlPacketType);
                this.emit('error', '[MQTT]' + data.split('').map((c) => { return c.charCodeAt(0); }));
                break;
        }
    };

    private onNetworkEnd = () => {
        this.emit('info', 'MQTT client disconnected');
        clearInterval(this.pingIntervalId);
        this.networkSocket = undefined;
        this.emit('disconnected');
        this.emit('close');
    };

    /** Disconnect from server */
    public disconnect = () => {
        this.networkSocket.write(String.fromCharCode(ControlPacketType.Disconnect << 4) + '\x00');
        this.networkSocket.end();
        this.connected = false;
    };

    /** Publish message using specified topic */
    public publish = (topic: string, message: string, qos = defaultQosLevel) => {
        this.networkSocket.write(MqttProtocol.createPublishPacket(topic, message, qos));
    };

    /** Subscribe to topic (filter) */
    public subscribe = (topic: string, qos = defaultQosLevel) => {
        this.networkSocket.write(MqttProtocol.createSubscribePacket(topic, qos));
    };

    /** Unsubscribe to topic (filter) */
    public unsubscribe = (topic: string) => {
        this.networkSocket.write(MqttProtocol.createUnsubscribePacket(topic));
    };

    /** Send ping request to server */
    private ping = () => {
        this.networkSocket.write(String.fromCharCode(ControlPacketType.PingReq << 4) + '\x00');
        this.emit('debug', 'Sent: Ping request');
    };
}

/**
 * The specifics of the MQTT protocol.
 */

// FIXME: The packet id is fixed.
const fixedPackedId = 1;
const keepAlive = 60;

export class MqttProtocol {
    /** 
     * Remaining Length
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718023
     */
    public static remainingLength(length: number) {
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

    /** PUBLISH packet parser - returns object with topic and message */
    public static parsePublish(data: string) {
        if (data.length > 5 && typeof data !== undefined) {
            const cmd = data.charCodeAt(0);
            const remainingLength = data.charCodeAt(1);
            const variableLength = data.charCodeAt(2) << 8 | data.charCodeAt(3);
            return {
                topic: data.substr(4, variableLength),
                message: data.substr(4 + variableLength, remainingLength - variableLength),
                dup: (cmd & 0b00001000) >> 3,
                qos: (cmd & 0b00000110) >> 1,
                retain: cmd & 0b00000001
            };
        }
        return undefined;
    }

    /**
     * Connect flags
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349229
     */
    private static createConnectionFlags(options: ConnectionOptions) {
        let flags = 0;
        flags |= (options.username) ? ConnectFlags.UserName : 0;
        flags |= (options.username && options.password) ? ConnectFlags.Password : 0;
        flags |= (options.cleanSession) ? ConnectFlags.CleanSession : 0;
        return flags;
    };

    /** Returns the MSB and LSB. */
    private static getBytes(int16: number) {
        return [int16 >> 8, int16 & 255];
    }

    /**
     * Keep alive
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349237
     */
    private static keepAliveBytes() {
        return MqttProtocol.getBytes(keepAlive);
    }

    /** 
     * Structure of UTF-8 encoded strings
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Figure_1.1_Structure
     */
    private static createString(s: string) {
        return String.fromCharCode(...MqttProtocol.getBytes(s.length)) + s;
    };

    /** 
     * Structure of an MQTT Control Packet
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800392
     */
    private static createPacket(fixed1: number, variable: string, payload: string) {
        const fixed2 = this.remainingLength(variable.length + payload.length);

        return String.fromCharCode(fixed1) +
            String.fromCharCode(...fixed2) +
            variable +
            payload;
    }

    /**
     * CONNECT – Client requests a connection to a Server
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718028
     */
    public static createConnectPacket(options: ConnectionOptions) {
        const cmd = ControlPacketType.Connect << 4;

        const protocolName = this.createString('MQTT');
        const protocolLevel = String.fromCharCode(4);
        const flags = String.fromCharCode(this.createConnectionFlags(options));

        const keepAlive: string = String.fromCharCode(...MqttProtocol.keepAliveBytes());

        let payload = this.createString(options.clientId);
        if (options.username) {
            payload += this.createString(options.username);
            if (options.password) {
                payload += this.createString(options.password);
            }
        }

        return this.createPacket(
            cmd,
            protocolName + protocolLevel + flags + keepAlive,
            payload
        );
    };

    public static createPublishPacket(topic: string, message: string, qos: number) {
        const cmd = ControlPacketType.Publish << 4 | (qos << 1);
        const pid = String.fromCharCode(fixedPackedId << 8, fixedPackedId & 255);
        const variable = (qos === 0) ? this.createString(topic) : this.createString(topic) + pid;
        return this.createPacket(cmd, variable, message);
    }

    public static createSubscribePacket(topic: string, qos: number) {
        const cmd = ControlPacketType.Subscribe << 4 | 2;
        const pid = String.fromCharCode(fixedPackedId << 8, fixedPackedId & 255);
        return this.createPacket(cmd,
            pid,
            this.createString(topic) +
            String.fromCharCode(qos));
    }

    public static createUnsubscribePacket(topic: string) {
        const cmd = ControlPacketType.Unsubscribe << 4 | 2;
        const pid = String.fromCharCode(fixedPackedId << 8, fixedPackedId & 255);
        return this.createPacket(cmd,
            pid,
            this.createString(topic));
    }
}
