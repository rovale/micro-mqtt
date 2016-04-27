/// <reference path='_common.ts'/>
import ConnectionOptions from './ConnectionOptions';
import ControlPacketType from './ControlPacketType';

const pingInterval = 40;
const connectionTimeout = 5;
const defaultPort = 1883;
const defaultQos = 0;

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
    public version = '0.0.16';

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

        if (options.will) {
            options.will.qos = options.will.qos || defaultQos;
            options.will.retain = options.will.retain || false;
        }

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
        this.handleData(data);
    };

    private handleData = (data: string) => {
        const controlPacketType: ControlPacketType = data.charCodeAt(0) >> 4;
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
                if (parsedData.qos > 0) {
                    setTimeout(() => { this.networkSocket.write(MqttProtocol.createPubAckPacket(parsedData.pid)); }, 0);
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
                this.emit('error', 'MQTT unexpected packet type: ' + controlPacketType);
                break;
        }
    };

    private onNetworkEnd = () => {
        this.emit('info', 'MQTT client disconnected');
        clearInterval(this.pingIntervalId);
        this.networkSocket = undefined;
        this.emit('disconnected');
    };

    /** Publish a message */
    public publish = (topic: string, message: string, qos = defaultQos, retained = false) => {
        this.networkSocket.write(MqttProtocol.createPublishPacket(topic, message, qos, true));
    };

    /** Subscribe to topic */
    public subscribe = (topic: string, qos = defaultQos) => {
        this.networkSocket.write(MqttProtocol.createSubscribePacket(topic, qos));
    };

    private ping = () => {
        this.networkSocket.write(MqttProtocol.createPingReqPacket());
        this.emit('debug', 'Sent: Ping request');
    };
}

/**
 * The specifics of the MQTT protocol.
 */
export module MqttProtocol {
    // FIXME: The packet id is fixed.
    export const fixedPackedId = 1;
    const keepAlive = 60;

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
    export function createConnectPacket(options: ConnectionOptions) {
        const byte1 = ControlPacketType.Connect << 4;

        const protocolName = createString('MQTT');
        const protocolLevel = String.fromCharCode(4);
        const flags = String.fromCharCode(createConnectFlags(options));

        const keepAlive: string = String.fromCharCode(...keepAliveBytes());

        let payload = createString(options.clientId);

        if (options.will) {
            payload += createString(options.will.topic);
            payload += createString(options.will.message);
        }

        if (options.username) {
            payload += createString(options.username);
            if (options.password) {
                payload += createString(options.password);
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
    export function createPingReqPacket() {
        return String.fromCharCode(ControlPacketType.PingReq << 4, 0);
    }

    /** 
     * PUBLISH - Publish message
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800410
     */
    export function createPublishPacket(topic: string, message: string, qos: number, retained: boolean) {
        let byte1 = ControlPacketType.Publish << 4 | (qos << 1);
        byte1 |= (retained) ? 1 : 0;

        const pid = String.fromCharCode(fixedPackedId >> 8, fixedPackedId & 255);
        const variable = (qos === 0) ? createString(topic) : createString(topic) + pid;
        return createPacket(byte1, variable, message);
    }

    export interface PublishPacket {
        pid?: number;
        topic: string;
        message: string;
        qos: number;
        retain: number;
        next?: number;
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
    export function createPubAckPacket(pid: number) {
        const byte1 = ControlPacketType.PubAck << 4;
        return createPacket(byte1, String.fromCharCode(pid >> 8, pid & 255));
    }

    /** 
     * SUBSCRIBE - Subscribe to topics
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800436
     */
    export function createSubscribePacket(topic: string, qos: number) {
        const byte1 = ControlPacketType.Subscribe << 4 | 2;
        const pid = String.fromCharCode(fixedPackedId >> 8, fixedPackedId & 255);
        return createPacket(byte1,
            pid,
            createString(topic) +
            String.fromCharCode(qos));
    }
}
