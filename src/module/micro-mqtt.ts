// tslint:disable-next-line:no-reference
/// <reference path='_common.ts'/>
import { ConnectionOptions } from './ConnectionOptions';
import { ConnectFlags } from './ConnectFlags';
import { ConnectReturnCode } from './ConnectReturnCode';
import { ControlPacketType } from './ControlPacketType';
import { Message } from './Message';
import { Net, Socket, Wifi } from './Net';

/**
 * Optimization, the TypeScript compiler replaces the constant enums.
 */
const enum Constants {
    PingInterval = 40,
    WatchDogInterval = 5,
    DefaultPort = 1883,
    DefaultQos = 0,
    Uninitialized = -123
}

/**
 * The specifics of the MQTT protocol.
 */
export module Protocol {
    /**
     * Optimization, the TypeScript compiler replaces the constant enums.
     */
    export const enum Constants {
        // FIXME: The packet id is fixed.
        FixedPackedId = 1,
        KeepAlive = 60
    }

    const strChr = String.fromCharCode;

    /**
     * Remaining Length
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718023
     */
    export function remainingLength(length: number) {
        const encBytes: number[] = [];
        do {
            let encByte = length & 127;
            length = length >> 7;
            // if there are more data to encode, set the top bit of this byte
            if (length > 0) {
                encByte += 128;
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
            flags |= (options.will.qos || 0) << 3;
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
        return strChr(...getBytes(s.length)) + s;
    }

    /**
     * Structure of an MQTT Control Packet
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800392
     */
    function createPacket(byte1: number, variable: string, payload: string = '') {
        const byte2 = remainingLength(variable.length + payload.length);

        return strChr(byte1) +
            strChr(...byte2) +
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
        const protocolLevel = strChr(4);
        const flags = strChr(createConnectFlags(options));

        const keepAlive: string = strChr(...getBytes(Constants.KeepAlive));

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
        return strChr(ControlPacketType.PingReq << 4, 0);
    }

    /**
     * PUBLISH - Publish message
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800410
     */
    export function createPublish(topic: string, message: string, qos: number, retained: boolean) {
        let byte1 = ControlPacketType.Publish << 4 | (qos << 1);
        byte1 |= (retained) ? 1 : 0;

        const pid = strChr(...getBytes(Constants.FixedPackedId));
        const variable = (qos === 0) ? pack(topic) : pack(topic) + pid;
        return createPacket(byte1, variable, message);
    }

    export function parsePublish(data: string): Message {
        const cmd = data.charCodeAt(0);
        const qos = (cmd & 0b00000110) >> 1;
        const remainingLength = data.charCodeAt(1);
        const topicLength = data.charCodeAt(2) << 8 | data.charCodeAt(3);
        let variableLength = topicLength;
        if (qos > 0) {
            variableLength += 2;
        }

        const messageLength = (remainingLength - variableLength) - 2;

        const message: Message = {
            topic: data.substr(4, topicLength),
            content: data.substr(4 + variableLength, messageLength),
            qos: qos,
            retain: cmd & 1
        };

        if (data.charCodeAt(remainingLength + 2) > 0) {
            message.next = remainingLength + 2;
        }

        if (qos > 0) {
            message.pid = data.charCodeAt(4 + variableLength - 2) << 8 |
                data.charCodeAt(4 + variableLength - 1);
        }

        return message;
    }

    /**
     * PUBACK - Publish acknowledgement
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800416
     */
    export function createPubAck(pid: number) {
        const byte1 = ControlPacketType.PubAck << 4;
        return createPacket(byte1, strChr(...getBytes(pid)));
    }

    /**
     * SUBSCRIBE - Subscribe to topics
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800436
     */
    export function createSubscribe(topic: string, qos: number) {
        const byte1 = ControlPacketType.Subscribe << 4 | 2;
        const pid = strChr(...getBytes(Constants.FixedPackedId));
        return createPacket(byte1,
            pid,
            pack(topic) +
            strChr(qos));
    }
}

/**
 * The MQTT client.
 */
export class Client {
    public version: string = '0.0.17';

    private opt: ConnectionOptions;

    private net: Net;
    private sct: Socket;

    protected emit: (event: string, arg?: string | Message) => boolean;
    public on: (event: string, listener: (arg: string | Message) => void) => void;

    private wdId: number = Constants.Uninitialized;
    private piId: number = Constants.Uninitialized;

    private wifi: Wifi;
    private connected: boolean = false;

    constructor(opt: ConnectionOptions, net: Net = require('net'), wifi: Wifi = require('Wifi')) {
        opt.port = opt.port || Constants.DefaultPort;
        opt.clientId = opt.clientId || '';

        if (opt.will) {
            opt.will.qos = opt.will.qos || Constants.DefaultQos;
            opt.will.retain = opt.will.retain || false;
        }

        this.opt = opt;
        this.net = net;
        this.wifi = wifi;
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

    public connect() {
        this.emit('info', `Connecting to ${this.opt.host}:${this.opt.port}`);

        if (this.wdId === Constants.Uninitialized) {
            this.wdId = setInterval(() => {
                if (!this.connected) {
                    this.emit('error', 'No connection. Retrying.');

                    if (this.piId !== Constants.Uninitialized) {
                        clearInterval(this.piId);
                        this.piId = Constants.Uninitialized;
                    }

                    if (this.sct) {
                        this.sct.removeAllListeners('connect');
                        this.sct.removeAllListeners('data');
                        this.sct.removeAllListeners('close');
                        this.sct.end();
                    }

                    this.connect();
                }
            }, Constants.WatchDogInterval * 1000);
        }

        if (this.wifi.getStatus().station !== 'connected') {
            this.emit('error', 'No wifi connection.');
            return;
        }

        this.sct = this.net.connect({ host: this.opt.host, port: this.opt.port }, () => {
            this.emit('info', 'Network connection established.');
            this.sct.write(Protocol.createConnect(this.opt));
            this.sct.removeAllListeners('connect');
        });

        this.sct.on('data', (data: string) => {
            const controlPacketType: ControlPacketType = data.charCodeAt(0) >> 4;
            this.emit('debug', `Rcvd: ${controlPacketType}: '${data}'.`);
            this.handleData(data);
        });

        this.sct.on('close', () => {
            this.emit('error', 'Disconnected.');
            this.connected = false;
        });
    }

    private handleData = (data: string) => {
        const controlPacketType: ControlPacketType = data.charCodeAt(0) >> 4;
        switch (controlPacketType) {
            case ControlPacketType.ConnAck:
                const returnCode = data.charCodeAt(3);
                if (returnCode === ConnectReturnCode.Accepted) {
                    this.emit('info', 'MQTT connection accepted.');
                    this.emit('connected');
                    this.connected = true;
                    this.piId = setInterval(this.ping, Constants.PingInterval * 1000);
                } else {
                    const connectionError = Client.describe(returnCode);
                    this.emit('error', connectionError);
                }
                break;
            case ControlPacketType.Publish:
                const message = Protocol.parsePublish(data);
                this.emit('receive', message);
                if (message.qos > 0) {
                    setTimeout(() => { this.sct.write(Protocol.createPubAck(message.pid || 0)); }, 0);
                }
                if (message.next) {
                    this.handleData(data.substr(message.next));
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
    }

    /** Publish a message */
    public publish(topic: string, message: string, qos: number = Constants.DefaultQos, retained: boolean = false) {
        this.sct.write(Protocol.createPublish(topic, message, qos, true));
    }

    /** Subscribe to topic */
    public subscribe(topic: string, qos: number = Constants.DefaultQos) {
        this.sct.write(Protocol.createSubscribe(topic, qos));
    }

    private ping = () => {
        this.sct.write(Protocol.createPingReq());
        this.emit('debug', 'Sent: Ping request.');
    }
}
