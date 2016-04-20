"use strict";
/*
A MQTT client for Espruino.

Based on the Espruino MQTT.js module by Lars Toft Jacobsen (boxed.dk), Gordon Williams.
See the file LICENSE for copying permission.
*/
var FixedPackedId = 1; // Bad...fixed packet id
var DefaultQosLevel = 0;
var DefaultPort = 1883;
var ConnectionTimeout = 5;
var KeepAlive = 60;
var PingInterval = 40;
var MicroMqttClient = (function () {
    function MicroMqttClient(options, network) {
        var _this = this;
        if (network === void 0) { network = require("net"); }
        this.options = options;
        this.network = network;
        this.version = "0.0.6";
        this.connected = false;
        this.connect = function () {
            _this.emit("info", "Connecting MicroMqttClient " + _this.version + " to " + _this.options.host + ":" + _this.options.port);
            _this.network.connect({ host: _this.options.host, port: _this.options.port }, function (socket) { return _this.onNetworkConnected(socket); });
            // TODO: Reconnect on timeout
        };
        this.onNetworkConnected = function (socket) {
            _this.emit("info", "Network connection established");
            _this.networkSocket = socket;
            _this.networkSocket.write(MqttProtocol.createConnectPacket(_this.options));
            // Disconnect if no CONNACK is received
            _this.connectionTimeOutId = setTimeout(function () {
                _this.disconnect();
            }, ConnectionTimeout * 1000);
            _this.networkSocket.on("data", function (data) { return _this.onNetworkData(data); });
            _this.networkSocket.on("end", _this.onNetworkEnd);
        };
        // Incoming data
        this.onNetworkData = function (data) {
            var type = data.charCodeAt(0) >> 4;
            _this.emit("debug", "Rcvd: " + type + ": \"" + data + "\"");
            switch (type) {
                case 3 /* Publish */:
                    var parsedData = MqttProtocol.parsePublish(data);
                    _this.emit("publish", parsedData);
                    break;
                case 4 /* PubAck */:
                case 9 /* SubAck */:
                case 11 /* UnsubAck */:
                case 13 /* PingResp */:
                    break;
                case 12 /* PingReq */:
                    _this.networkSocket.write(13 /* PingResp */ + "\x00"); // reply to PINGREQ
                    break;
                case 2 /* ConnAck */:
                    clearTimeout(_this.connectionTimeOutId);
                    var returnCode = data.charCodeAt(3);
                    if (returnCode === 0 /* Accepted */) {
                        _this.connected = true;
                        _this.emit("info", "MQTT connection accepted");
                        _this.emit("connected");
                        // Set up regular keep alive ping
                        _this.pingIntervalId = setInterval(function () {
                            _this.ping();
                        }, PingInterval * 1000);
                    }
                    else {
                        var connectionError = MicroMqttClient.getConnectionError(returnCode);
                        _this.emit("error", connectionError);
                    }
                    break;
                default:
                    _this.emit("error", "MQTT unsupported packet type: " + type);
                    _this.emit("error", "[MQTT]" + data.split("").map(function (c) { return c.charCodeAt(0); }));
                    break;
            }
        };
        this.onNetworkEnd = function () {
            _this.emit("info", "MQTT client disconnected");
            clearInterval(_this.pingIntervalId);
            _this.networkSocket = undefined;
            _this.emit("disconnected");
            _this.emit("close");
        };
        /** Disconnect from server */
        this.disconnect = function () {
            _this.networkSocket.write(String.fromCharCode(14 /* Disconnect */ << 4) + "\x00");
            _this.networkSocket.end();
            _this.connected = false;
        };
        /** Publish message using specified topic */
        this.publish = function (topic, message, qos) {
            if (qos === void 0) { qos = DefaultQosLevel; }
            _this.networkSocket.write(MqttProtocol.createPublishPacket(topic, message, qos));
        };
        /** Subscribe to topic (filter) */
        this.subscribe = function (topic, qos) {
            if (qos === void 0) { qos = DefaultQosLevel; }
            _this.networkSocket.write(MqttProtocol.createSubscribePacket(topic, qos));
        };
        /** Unsubscribe to topic (filter) */
        this.unsubscribe = function (topic) {
            _this.networkSocket.write(MqttProtocol.createUnsubscribePacket(topic));
        };
        /** Send ping request to server */
        this.ping = function () {
            _this.networkSocket.write(String.fromCharCode(12 /* PingReq */ << 4) + "\x00");
            _this.emit("debug", "Sent: Ping request");
        };
        options.port = options.port || DefaultPort;
        options.clientId = options.clientId || MicroMqttClient.generateClientId();
        options.cleanSession = options.cleanSession || true;
    }
    MicroMqttClient.getConnectionError = function (returnCode) {
        var error = "Connection refused, ";
        switch (returnCode) {
            case 1 /* UnacceptableProtocolVersion */:
                error += "unacceptable protocol version.";
                break;
            case 2 /* IdentifierRejected */:
                error += "identifier rejected.";
                break;
            case 3 /* ServerUnavailable */:
                error += "server unavailable.";
                break;
            case 4 /* BadUserNameOrPassword */:
                error += "bad user name or password.";
                break;
            case 5 /* NotAuthorized */:
                error += "not authorized.";
                break;
            default:
                error += "unknown return code: " + returnCode + ".";
        }
        return error;
    };
    MicroMqttClient.generateClientId = function () {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + s4();
    };
    return MicroMqttClient;
}());
exports.MicroMqttClient = MicroMqttClient;
var MqttProtocol = (function () {
    function MqttProtocol() {
    }
    // Remaining Length
    // http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718023
    MqttProtocol.remainingLenght = function (length) {
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
    };
    /** PUBLISH packet parser - returns object with topic and message */
    MqttProtocol.parsePublish = function (data) {
        if (data.length > 5 && typeof data !== undefined) {
            var cmd = data.charCodeAt(0);
            var rem_len = data.charCodeAt(1);
            var var_len = data.charCodeAt(2) << 8 | data.charCodeAt(3);
            return {
                topic: data.substr(4, var_len),
                message: data.substr(4 + var_len, rem_len - var_len),
                dup: (cmd & 8) >> 3,
                qos: (cmd & 6) >> 1,
                retain: cmd & 1
            };
        }
        else {
            return undefined;
        }
    };
    MqttProtocol.createConnectionFlags = function (options) {
        var flags = 0;
        flags |= (options.username) ? 0x80 : 0;
        flags |= (options.username && options.password) ? 0x40 : 0;
        flags |= (options.cleanSession) ? 0x02 : 0;
        return flags;
    };
    ;
    // Structure of UTF-8 encoded strings
    // http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Figure_1.1_Structure
    MqttProtocol.createString = function (s) {
        return String.fromCharCode(s.length >> 8, s.length & 255) + s;
    };
    ;
    // Structure of an MQTT Control Packet
    // http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800392
    MqttProtocol.createPacket = function (fixed1, variable, payload) {
        var fixed2 = this.remainingLenght(variable.length + payload.length);
        return String.fromCharCode(fixed1) +
            String.fromCharCode.apply(String, fixed2) +
            variable +
            payload;
    };
    MqttProtocol.createConnectPacket = function (options) {
        var cmd = 1 /* Connect */ << 4;
        var protocolName = this.createString("MQTT");
        var protocolLevel = String.fromCharCode(4);
        var flags = String.fromCharCode(this.createConnectionFlags(options));
        var keepAlive = String.fromCharCode(KeepAlive >> 8, KeepAlive & 255);
        var payload = this.createString(options.clientId);
        if (options.username) {
            payload += this.createString(options.username);
            if (options.password) {
                payload += this.createString(options.password);
            }
        }
        return this.createPacket(cmd, protocolName + protocolLevel + flags + keepAlive, payload);
    };
    ;
    MqttProtocol.createPublishPacket = function (topic, message, qos) {
        var cmd = 3 /* Publish */ << 4 | (qos << 1);
        var pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
        var variable = (qos === 0) ? this.createString(topic) : this.createString(topic) + pid;
        return this.createPacket(cmd, variable, message);
    };
    MqttProtocol.createSubscribePacket = function (topic, qos) {
        var cmd = 8 /* Subscribe */ << 4 | 2;
        var pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
        return this.createPacket(cmd, pid, this.createString(topic) +
            String.fromCharCode(qos));
    };
    MqttProtocol.createUnsubscribePacket = function (topic) {
        var cmd = 10 /* Unsubscribe */ << 4 | 2;
        var pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
        return this.createPacket(cmd, pid, this.createString(topic));
    };
    return MqttProtocol;
}());
exports.MqttProtocol = MqttProtocol;
//# sourceMappingURL=micro-mqtt.js.map