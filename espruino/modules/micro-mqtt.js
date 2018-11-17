"use strict";
exports.__esModule = true;
/**
 * The specifics of the MQTT protocol.
 */
var Protocol;
(function (Protocol) {
    var strChr = String.fromCharCode;
    /**
     * Remaining Length
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718023
     */
    function encodeRemainingLength(remainingLength) {
        var length = remainingLength;
        var encBytes = [];
        do {
            var encByte = length & 127;
            length = length >> 7;
            // if there are more data to encode, set the top bit of this byte
            if (length > 0) {
                encByte += 128;
            }
            encBytes.push(encByte);
        } while (length > 0);
        return encBytes;
    }
    Protocol.encodeRemainingLength = encodeRemainingLength;
    /**
     * Connect flags
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349229
     */
    function createConnectFlags(options) {
        var flags = 0;
        flags |= (options.username) ? 128 /* UserName */ : 0;
        flags |= (options.username && options.password) ? 64 /* Password */ : 0;
        flags |= 2 /* CleanSession */;
        if (options.will) {
            flags |= 4 /* Will */;
            flags |= (options.will.qos || 0) << 3;
            flags |= (options.will.retain) ? 32 /* WillRetain */ : 0;
        }
        return flags;
    }
    // Returns the MSB and LSB.
    function getBytes(int16) {
        return [int16 >> 8, int16 & 255];
    }
    /**
     * Structure of UTF-8 encoded strings
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Figure_1.1_Structure
     */
    function pack(s) {
        return strChr.apply(void 0, getBytes(s.length)) + s;
    }
    /**
     * Structure of an MQTT Control Packet
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800392
     */
    function createPacket(byte1, variable, payload) {
        if (payload === void 0) { payload = ''; }
        var byte2 = encodeRemainingLength(variable.length + payload.length);
        return strChr(byte1) + strChr.apply(void 0, byte2) +
            variable +
            payload;
    }
    /**
     * CONNECT - Client requests a connection to a Server
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718028
     */
    function createConnect(options) {
        var byte1 = 1 /* Connect */ << 4;
        var protocolName = pack('MQTT');
        var protocolLevel = strChr(4);
        var flags = strChr(createConnectFlags(options));
        var keepAlive = strChr.apply(void 0, getBytes(60 /* KeepAlive */));
        var payload = pack(options.clientId);
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
        return createPacket(byte1, protocolName + protocolLevel + flags + keepAlive, payload);
    }
    Protocol.createConnect = createConnect;
    /** PINGREQ - PING request
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800454
     */
    function createPingReq() {
        return strChr(12 /* PingReq */ << 4, 0);
    }
    Protocol.createPingReq = createPingReq;
    /**
     * PUBLISH - Publish message
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800410
     */
    function createPublish(topic, message, qos, retained) {
        var byte1 = 3 /* Publish */ << 4 | (qos << 1);
        byte1 |= (retained) ? 1 : 0;
        var pid = strChr.apply(void 0, getBytes(1 /* FixedPackedId */));
        var variable = (qos === 0) ? pack(topic) : pack(topic) + pid;
        return createPacket(byte1, variable, message);
    }
    Protocol.createPublish = createPublish;
    function parsePublish(data) {
        var cmd = data.charCodeAt(0);
        var qos = (cmd & 6) >> 1;
        var remainingLength = data.charCodeAt(1);
        var topicLength = data.charCodeAt(2) << 8 | data.charCodeAt(3);
        var variableLength = topicLength;
        if (qos > 0) {
            variableLength += 2;
        }
        var messageLength = (remainingLength - variableLength) - 2;
        var message = {
            topic: data.substr(4, topicLength),
            content: data.substr(variableLength + 4, messageLength),
            qos: qos,
            retain: cmd & 1
        };
        if (data.charCodeAt(remainingLength + 2) > 0) {
            message.next = remainingLength + 2;
        }
        if (qos > 0) {
            message.pid = data.charCodeAt(variableLength + 4 - 2) << 8 |
                data.charCodeAt(variableLength + 4 - 1);
        }
        return message;
    }
    Protocol.parsePublish = parsePublish;
    /**
     * PUBACK - Publish acknowledgement
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800416
     */
    function createPubAck(pid) {
        var byte1 = 4 /* PubAck */ << 4;
        return createPacket(byte1, strChr.apply(void 0, getBytes(pid)));
    }
    Protocol.createPubAck = createPubAck;
    /**
     * SUBSCRIBE - Subscribe to topics
     * http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800436
     */
    function createSubscribe(topic, qos) {
        var byte1 = 8 /* Subscribe */ << 4 | 2;
        var pid = strChr.apply(void 0, getBytes(1 /* FixedPackedId */));
        return createPacket(byte1, pid, pack(topic) +
            strChr(qos));
    }
    Protocol.createSubscribe = createSubscribe;
})(Protocol = exports.Protocol || (exports.Protocol = {}));
/**
 * The MQTT client.
 */
var Client = /** @class */ (function () {
    // tslint:disable-next-line:no-unsafe-any
    function Client(opt, net) {
        if (net === void 0) { net = require('net'); }
        var _this = this;
        this.version = '0.0.17';
        this.wdId = -123 /* Uninitialized */;
        this.piId = -123 /* Uninitialized */;
        this.connected = false;
        this.handleData = function (data) {
            var controlPacketType = data.charCodeAt(0) >> 4;
            switch (controlPacketType) {
                case 2 /* ConnAck */:
                    var returnCode = data.charCodeAt(3);
                    if (returnCode === 0 /* Accepted */) {
                        _this.emit('info', 'MQTT connection accepted.');
                        _this.emit('connected');
                        _this.connected = true;
                        _this.piId = setInterval(_this.ping, 40 /* PingInterval */ * 1000);
                    }
                    else {
                        var connectionError = Client.describe(returnCode);
                        _this.emit('error', connectionError);
                    }
                    break;
                case 3 /* Publish */:
                    var message_1 = Protocol.parsePublish(data);
                    _this.emit('receive', message_1);
                    if (message_1.qos > 0) {
                        setTimeout(function () {
                            _this.write(Protocol.createPubAck(message_1.pid || 0));
                        }, 0);
                    }
                    if (message_1.next) {
                        _this.handleData(data.substr(message_1.next));
                    }
                    break;
                case 13 /* PingResp */:
                case 4 /* PubAck */:
                case 9 /* SubAck */:
                    break;
                default:
                    _this.emit('error', "MQTT unexpected packet type: " + controlPacketType + ".");
            }
        };
        this.ping = function () {
            _this.write(Protocol.createPingReq());
            _this.emit('debug', 'Sent: Ping request.');
        };
        opt.port = opt.port || 1883 /* DefaultPort */;
        opt.clientId = opt.clientId;
        if (opt.will) {
            opt.will.qos = opt.will.qos || 0 /* DefaultQos */;
            opt.will.retain = opt.will.retain || false;
        }
        this.opt = opt;
        this.net = net;
    }
    Client.describe = function (code) {
        var error = 'Connection refused, ';
        switch (code) {
            case 1 /* UnacceptableProtocolVersion */:
                error += 'unacceptable protocol version.';
                break;
            case 2 /* IdentifierRejected */:
                error += 'identifier rejected.';
                break;
            case 3 /* ServerUnavailable */:
                error += 'server unavailable.';
                break;
            case 4 /* BadUserNameOrPassword */:
                error += 'bad user name or password.';
                break;
            case 5 /* NotAuthorized */:
                error += 'not authorized.';
                break;
            default:
                error += "unknown return code: " + code + ".";
        }
        return error;
    };
    Client.prototype.disconnect = function () {
        if (this.wdId !== -123 /* Uninitialized */) {
            clearInterval(this.wdId);
            this.wdId = -123 /* Uninitialized */;
        }
        if (this.piId !== -123 /* Uninitialized */) {
            clearInterval(this.piId);
            this.piId = -123 /* Uninitialized */;
        }
        if (this.sct) {
            this.sct.removeAllListeners('connect');
            this.sct.removeAllListeners('data');
            this.sct.removeAllListeners('close');
            this.sct.end();
        }
    };
    Client.prototype.connect = function () {
        var _this = this;
        this.emit('info', "Connecting to " + this.opt.host + ":" + this.opt.port);
        if (this.wdId === -123 /* Uninitialized */) {
            this.wdId = setInterval(function () {
                if (!_this.connected) {
                    _this.emit('error', 'No connection. Retrying.');
                    _this.disconnect();
                    _this.connect();
                }
            }, 5 /* WatchDogInterval */ * 1000);
        }
        this.sct = this.net.connect({ host: this.opt.host, port: this.opt.port }, function () {
            _this.emit('info', 'Network connection established.');
            if (_this.sct) {
                _this.onConnect();
                _this.write(Protocol.createConnect(_this.opt));
                _this.sct.removeAllListeners('connect');
            }
        });
        this.sct.on('data', function (data) {
            var controlPacketType = data.charCodeAt(0) >> 4;
            _this.emit('debug', "Rcvd: " + controlPacketType + ": '" + data + "'.");
            _this.handleData(data);
        });
        this.sct.on('close', function () {
            _this.emit('error', 'Disconnected.');
            _this.connected = false;
        });
    };
    // Publish a message
    Client.prototype.publish = function (topic, message, qos, retained) {
        if (qos === void 0) { qos = 0 /* DefaultQos */; }
        if (retained === void 0) { retained = false; }
        this.write(Protocol.createPublish(topic, message, qos, retained));
    };
    // Subscribe to topic
    Client.prototype.subscribe = function (topic, qos) {
        if (qos === void 0) { qos = 0 /* DefaultQos */; }
        this.write(Protocol.createSubscribe(topic, qos));
    };
    // tslint:disable-next-line:no-empty
    Client.prototype.onConnect = function () {
    };
    Client.prototype.write = function (data) {
        if (this.sct) {
            this.sct.write(data);
        }
    };
    return Client;
}());
exports.Client = Client;
//# sourceMappingURL=micro-mqtt.js.map