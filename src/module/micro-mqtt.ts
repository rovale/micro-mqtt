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
    end: () => void;
}

export interface Network {
    connect: (options: NetworkConnectOptions, callback: (socket: NetworkSocket) => void) => void;
}

/**
 * The MQTT client.
 */
export class MicroMqttClient {
    public version = '0.0.11';

    private options: ConnectionOptions;
    private network: Network;

    private networkSocket: NetworkSocket;
    private connected = false;

    protected emit: (event: string, ...args: any[]) => boolean;

    private connectionTimeOutId: number;
    private pingIntervalId: number;

    constructor(options: ConnectionOptions, network: Network = require('net')) {
        options.port = options.port || defaultPort;
        options.clientId = options.clientId || '';

        this.options = options;
        this.network = network;
    }

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
        this.connectionTimeOutId = setTimeout(() => {
            // TODO: Add a retry mechanism
        }, connectionTimeout * 1000);

        this.networkSocket.on('data', (data: string) => this.onNetworkData(data));
        this.networkSocket.on('end', this.onNetworkEnd);
    };

    private onNetworkData = (data: string) => {
        const controlPacketType: ControlPacketType = data.charCodeAt(0) >> 4;

        this.emit('debug', `Rcvd: ${controlPacketType}: '${data}'`);

        switch (controlPacketType) {
            case ControlPacketType.ConnAck:
                clearTimeout(this.connectionTimeOutId);
                const returnCode = data.charCodeAt(3);
                if (returnCode === ConnectReturnCode.Accepted) {
                    this.connected = true;
                    this.emit('info', 'MQTT connection accepted');
                    this.emit('connected');

                    this.pingIntervalId = setInterval(this.ping, pingInterval * 1000);
                } else {
                    const connectionError = MicroMqttClient.getConnectionError(returnCode);
                    this.emit('error', connectionError);
                }
                break;
            case ControlPacketType.Publish:
                const parsedData = MqttProtocol.parsePublishPacket(data);
                this.emit('publish', parsedData);
                break;
            case ControlPacketType.PubAck:
            case ControlPacketType.SubAck:
            case ControlPacketType.UnsubAck:
            case ControlPacketType.PingResp:
            case ControlPacketType.PingReq:
                break;
            default:
                this.emit('error', 'MQTT unsupported packet type: ' + controlPacketType);
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

    /** Publish message using specified topic */
    public publish = (topic: string, message: string, qos = defaultQosLevel) => {
        this.networkSocket.write(MqttProtocol.createPublishPacket(topic, message, qos));
    };

    /** Subscribe to topic (filter) */
    public subscribe = (topic: string, qos = defaultQosLevel) => {
        this.networkSocket.write(MqttProtocol.createSubscribePacket(topic, qos));
    };

    /** Send ping request to server */
    private ping = () => {
        this.networkSocket.write(MqttProtocol.createPingReqPacket());
        this.emit('debug', 'Sent: Ping request');
    };
}

/**
 * The specifics of the MQTT protocol.
 */

// FIXME: The packet id is fixed.
const fixedPackedId = 1;
const keepAlive = 60;

export module MqttProtocol {
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
    function createConnectionFlags(options: ConnectionOptions) {
        let flags = 0;
        flags |= (options.username) ? ConnectFlags.UserName : 0;
        flags |= (options.username && options.password) ? ConnectFlags.Password : 0;
        flags |= ConnectFlags.CleanSession;
        return flags;
    }

    /** Returns the MSB and LSB. */
    function getBytes(int16: number) {
        return [int16 >> 8, int16 & 255];
    }

    /**
     * Keep alive
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349237
     */
    function keepAliveBytes() {
        return getBytes(keepAlive);
    }

    /** 
     * Structure of UTF-8 encoded strings
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Figure_1.1_Structure
     */
    function createString(s: string) {
        return String.fromCharCode(...getBytes(s.length)) + s;
    }

    /** 
     * Structure of an MQTT Control Packet
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800392
     */
    function createPacket(fixed1: number, variable: string, payload: string) {
        const fixed2 = remainingLength(variable.length + payload.length);

        return String.fromCharCode(fixed1) +
            String.fromCharCode(...fixed2) +
            variable +
            payload;
    }

    /**
     * CONNECT - Client requests a connection to a Server
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718028
     */
    export function createConnectPacket(options: ConnectionOptions) {
        const cmd = ControlPacketType.Connect << 4;

        const protocolName = createString('MQTT');
        const protocolLevel = String.fromCharCode(4);
        const flags = String.fromCharCode(createConnectionFlags(options));

        const keepAlive: string = String.fromCharCode(...keepAliveBytes());

        let payload = createString(options.clientId);
        if (options.username) {
            payload += createString(options.username);
            if (options.password) {
                payload += createString(options.password);
            }
        }

        return createPacket(
            cmd,
            protocolName + protocolLevel + flags + keepAlive,
            payload
        );
    }

    /** PINGREQ - PING request
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800454
    */
    export function createPingReqPacket() {
        return String.fromCharCode(ControlPacketType.PingReq << 4, 0);
    }

    /** 
     * PUBLISH - Publish message
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800410
     */
    export function createPublishPacket(topic: string, message: string, qos: number) {
        const cmd = ControlPacketType.Publish << 4 | (qos << 1);
        const pid = String.fromCharCode(fixedPackedId >> 8, fixedPackedId & 255);
        const variable = (qos === 0) ? createString(topic) : createString(topic) + pid;
        return createPacket(cmd, variable, message);
    }

    export interface PublishPacket {
        topic: string;
        message: string;
        qos: number;
        retain: number;
    }

    export function parsePublishPacket(data: string): PublishPacket {
        const cmd = data.charCodeAt(0);
        const qos = (cmd & 0b00000110) >> 1;
        const remainingLength = data.charCodeAt(1);
        const topicLength = data.charCodeAt(2) << 8 | data.charCodeAt(3);
        let variableLength = topicLength;
        if (qos > 0) {
            variableLength += 2;
        }

        return {
            topic: data.substr(4, topicLength),
            message: data.substr(4 + variableLength, remainingLength - variableLength),
            qos: qos,
            retain: cmd & 0b00000001
        };
    }

    /** 
     * SUBSCRIBE - Subscribe to topics
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800436
     */
    export function createSubscribePacket(topic: string, qos: number) {
        const cmd = ControlPacketType.Subscribe << 4 | 2;
        const pid = String.fromCharCode(fixedPackedId >> 8, fixedPackedId & 255);
        return createPacket(cmd,
            pid,
            createString(topic) +
            String.fromCharCode(qos));
    }
}
