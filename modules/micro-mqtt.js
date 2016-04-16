"use strict";
/* Copyright (c) 2014 Lars Toft Jacobsen (boxed.dk), Gordon Williams. See the file LICENSE for copying permission. */
/*
Simple MQTT protocol wrapper for Espruino sockets.
*/
/** 'private' constants */
var C = {
    PACKET_ID: 1 // Bad...fixed packet id
};
;
;
var MicroMqttClient = (function () {
    function MicroMqttClient(server, options) {
        var _this = this;
        this.server = server;
        this.version = "0.0.4";
        this.connected = false;
        this.C = {
            DEF_QOS: 0,
            DEF_PORT: 1883,
            DEF_KEEP_ALIVE: 60,
            CONNECT_TIMEOUT: 5000,
            PING_INTERVAL: 40,
            PROTOCOL_LEVEL: 4 // MQTT protocol level    
        };
        /** Establish connection and set up keep alive ping */
        this.connect = function (net) {
            var connectionTimeOutId;
            var pingIntervalId;
            var onNetConnected = function () {
                console.log('Client connected');
                net.write(_this.mqttConnect(_this.clientId));
                // Disconnect if no CONNACK is received
                connectionTimeOutId = setTimeout(function () {
                    _this.disconnect();
                }, _this.C.CONNECT_TIMEOUT);
                // Set up regular keep_alive ping
                pingIntervalId = setInterval(function () {
                    // console.log("Pinging MQTT server");
                    _this.ping();
                }, _this.pingInterval * 1000);
                // Incoming data
                net.on('data', function (data) {
                    var type = data.charCodeAt(0) >> 4;
                    if (type === 3 /* Publish */) {
                        var parsedData = parsePublish(data);
                        _this.emit('publish', parsedData);
                        _this.emit('message', parsedData.topic, parsedData.message);
                    }
                    else if (type === 4 /* PubAck */) {
                    }
                    else if (type === 9 /* SubAck */) {
                    }
                    else if (type === 11 /* UnsubAck */) {
                    }
                    else if (type === 12 /* PingReq */) {
                        // silently reply to pings
                        net.write(13 /* PingResp */ + "\x00"); // reply to PINGREQ
                    }
                    else if (type === 13 /* PingResp */) {
                        _this.emit('ping_reply');
                    }
                    else if (type === 2 /* ConnAck */) {
                        clearTimeout(connectionTimeOutId);
                        var returnCode = data.charCodeAt(3);
                        if (returnCode === 0 /* Accepted */) {
                            _this.connected = true;
                            console.log("MQTT connection accepted");
                            _this.emit('connected');
                        }
                        else {
                            var mqttError = "Connection refused, ";
                            switch (returnCode) {
                                case 1 /* UnacceptableProtocolVersion */:
                                    mqttError += "unacceptable protocol version.";
                                    break;
                                case 2 /* IdentifierRejected */:
                                    mqttError += "identifier rejected.";
                                    break;
                                case 3 /* ServerUnavailable */:
                                    mqttError += "server unavailable.";
                                    break;
                                case 4 /* BadUserNameOrPassword */:
                                    mqttError += "bad user name or password.";
                                    break;
                                case 5 /* NotAuthorized */:
                                    mqttError += "not authorized.";
                                    break;
                                default:
                                    mqttError += "unknown return code: " + returnCode + ".";
                            }
                            console.log(mqttError);
                            _this.emit('error', mqttError);
                        }
                    }
                    else {
                        console.log("MQTT unsupported packet type: " + type);
                        console.log("[MQTT]" + data.split("").map(function (c) { return c.charCodeAt(0); }));
                    }
                });
                net.on('end', function () {
                    console.log('MQTT client disconnected');
                    clearInterval(pingIntervalId);
                    _this.emit('disconnected');
                    _this.emit('close');
                });
                _this.net = net;
            };
            if (net) {
                onNetConnected();
            }
            else {
                net = require("net")
                    .connect({ host: _this.server, port: _this.port }, onNetConnected);
            }
        };
        /** Disconnect from server */
        this.disconnect = function () {
            _this.net.write(fromCharCode(14 /* Disconnect */ << 4) + "\x00");
            _this.net.end();
            _this.net = false;
            _this.connected = false;
        };
        /** Publish message using specified topic */
        this.publish = function (topic, message, qos) {
            if (qos === void 0) { qos = _this.C.DEF_QOS; }
            _this.net.write(mqttPublish(topic, message, qos));
        };
        /** Subscribe to topic (filter) */
        this.subscribe = function (topic, qos) {
            if (qos === void 0) { qos = _this.C.DEF_QOS; }
            _this.net.write(mqttSubscribe(topic, qos));
        };
        /** Unsubscribe to topic (filter) */
        this.unsubscribe = function (topic) {
            _this.net.write(mqttUnsubscribe(topic));
        };
        /** Send ping request to server */
        this.ping = function () {
            _this.net.write(fromCharCode(12 /* PingReq */ << 4) + "\x00");
        };
        /* Packet specific functions *******************/
        /** Create connection flags
        
        */
        this.createFlagsForConnection = function (options) {
            var flags = 0;
            flags |= (_this.username) ? 0x80 : 0;
            flags |= (_this.username && _this.password) ? 0x40 : 0;
            flags |= (options.clean_session) ? 0x02 : 0;
            return createEscapedHex(flags);
        };
        /** CONNECT control packet
            Clean Session and Userid/Password are currently only supported
            connect flag. Wills are not
            currently supported.
        */
        this.mqttConnect = function (clean) {
            var cmd = 1 /* Connect */ << 4;
            var flags = _this.createFlagsForConnection({
                clean_session: clean
            });
            var keep_alive = fromCharCode(_this.keepAlive >> 8, _this.keepAlive & 255);
            /* payload */
            var payload = mqttStr(_this.clientId);
            if (_this.username) {
                payload += mqttStr(_this.username);
                if (_this.password) {
                    payload += mqttStr(_this.password);
                }
            }
            return mqttPacket(cmd, mqttStr(_this.protocolName) /*protocol name*/ +
                _this.protocolLevel /*protocol level*/ +
                flags +
                keep_alive, payload);
        };
        console.log("MicroMqttClient " + this.version);
        this.server = server;
        var options = options || {};
        this.port = options.port || this.C.DEF_PORT;
        this.clientId = options.clientId || mqttUid();
        this.keepAlive = options.keepAlive || this.C.DEF_KEEP_ALIVE;
        this.cleanSession = options.cleanSession || true;
        this.username = options.username;
        this.password = options.password;
        this.pingInterval =
            this.keepAlive < this.C.PING_INTERVAL ? (this.keepAlive - 5) : this.C.PING_INTERVAL;
        this.protocolName = options.protocolName || "MQTT";
        this.protocolLevel = createEscapedHex(options.protocolLevel || this.C.PROTOCOL_LEVEL);
    }
    return MicroMqttClient;
}());
exports.MicroMqttClient = MicroMqttClient;
/* Utility functions ***************************/
var fromCharCode = String.fromCharCode;
/** MQTT string (length MSB, LSB + data) */
function mqttStr(s) {
    return fromCharCode(s.length >> 8, s.length & 255) + s;
}
;
/** MQTT packet length formatter - algorithm from reference docs */
function mqttPacketLength(length) {
    var encLength = '';
    do {
        var encByte = length & 127;
        length = length >> 7;
        // if there are more data to encode, set the top bit of this byte
        if (length > 0) {
            encByte += 128;
        }
        encLength += fromCharCode(encByte);
    } while (length > 0);
    return encLength;
}
/** MQTT standard packet formatter */
function mqttPacket(cmd, variable, payload) {
    return fromCharCode(cmd) + mqttPacketLength(variable.length + payload.length) + variable + payload;
}
/** PUBLISH packet parser - returns object with topic and message */
function parsePublish(data) {
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
}
/** Generate random UID */
var mqttUid = (function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return function () {
        return s4() + s4() + s4();
    };
})();
/** PUBLISH control packet */
function mqttPublish(topic, message, qos) {
    var cmd = 3 /* Publish */ << 4 | (qos << 1);
    var pid = fromCharCode(C.PACKET_ID << 8, C.PACKET_ID & 255);
    // Packet id must be included for QOS > 0
    var variable = (qos === 0) ? mqttStr(topic) : mqttStr(topic) + pid;
    return mqttPacket(cmd, variable, message);
}
/** SUBSCRIBE control packet */
function mqttSubscribe(topic, qos) {
    var cmd = 8 /* Subscribe */ << 4 | 2;
    var pid = fromCharCode(C.PACKET_ID << 8, C.PACKET_ID & 255);
    return mqttPacket(cmd, pid /*Packet id*/, mqttStr(topic) +
        fromCharCode(qos) /*QOS*/);
}
/** UNSUBSCRIBE control packet */
function mqttUnsubscribe(topic) {
    var cmd = 10 /* Unsubscribe */ << 4 | 2;
    var pid = fromCharCode(C.PACKET_ID << 8, C.PACKET_ID & 255);
    return mqttPacket(cmd, pid /*Packet id*/, mqttStr(topic));
}
/** Create escaped hex value from number */
function createEscapedHex(number) {
    return fromCharCode(parseInt(number.toString(16), 16));
}
