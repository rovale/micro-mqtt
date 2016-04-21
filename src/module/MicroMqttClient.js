/**
 * The MQTT client.
 */
"use strict";
var MqttProtocol_1 = require('./MqttProtocol');
var pingInterval = 40;
var connectionTimeout = 5;
var defaultPort = 1883;
var defaultQosLevel = 0;
var MicroMqttClient = (function () {
    function MicroMqttClient(options, network) {
        var _this = this;
        if (network === void 0) { network = require('net'); }
        this.version = '0.0.6';
        this.connected = false;
        this.connect = function () {
            _this.emit('info', "Connecting MicroMqttClient " + _this.version + " to " + _this.options.host + ":" + _this.options.port);
            _this.network.connect({ host: _this.options.host, port: _this.options.port }, function (socket) { return _this.onNetworkConnected(socket); });
            // TODO: Reconnect on timeout
        };
        this.onNetworkConnected = function (socket) {
            _this.emit('info', 'Network connection established');
            _this.networkSocket = socket;
            _this.networkSocket.write(MqttProtocol_1["default"].createConnectPacket(_this.options));
            // Disconnect if no CONNACK is received
            _this.connectionTimeOutId = setTimeout(function () {
                _this.disconnect();
            }, connectionTimeout * 1000);
            _this.networkSocket.on('data', function (data) { return _this.onNetworkData(data); });
            _this.networkSocket.on('end', _this.onNetworkEnd);
        };
        this.onNetworkData = function (data) {
            var controlPacketType = data.charCodeAt(0) >> 4;
            _this.emit('debug', "Rcvd: " + controlPacketType + ": '" + data + "'");
            switch (controlPacketType) {
                case 3 /* Publish */:
                    var parsedData = MqttProtocol_1["default"].parsePublish(data);
                    _this.emit('publish', parsedData);
                    break;
                case 4 /* PubAck */:
                case 9 /* SubAck */:
                case 11 /* UnsubAck */:
                case 13 /* PingResp */:
                    break;
                case 12 /* PingReq */:
                    _this.networkSocket.write(13 /* PingResp */ + '\x00'); // reply to PINGREQ
                    break;
                case 2 /* ConnAck */:
                    clearTimeout(_this.connectionTimeOutId);
                    var returnCode = data.charCodeAt(3);
                    if (returnCode === 0 /* Accepted */) {
                        _this.connected = true;
                        _this.emit('info', 'MQTT connection accepted');
                        _this.emit('connected');
                        // Set up regular keep alive ping
                        _this.pingIntervalId = setInterval(function () {
                            _this.ping();
                        }, pingInterval * 1000);
                    }
                    else {
                        var connectionError = MicroMqttClient.getConnectionError(returnCode);
                        _this.emit('error', connectionError);
                    }
                    break;
                default:
                    _this.emit('error', 'MQTT unsupported packet type: ' + controlPacketType);
                    _this.emit('error', '[MQTT]' + data.split('').map(function (c) { return c.charCodeAt(0); }));
                    break;
            }
        };
        this.onNetworkEnd = function () {
            _this.emit('info', 'MQTT client disconnected');
            clearInterval(_this.pingIntervalId);
            _this.networkSocket = undefined;
            _this.emit('disconnected');
            _this.emit('close');
        };
        /** Disconnect from server */
        this.disconnect = function () {
            _this.networkSocket.write(String.fromCharCode(14 /* Disconnect */ << 4) + '\x00');
            _this.networkSocket.end();
            _this.connected = false;
        };
        /** Publish message using specified topic */
        this.publish = function (topic, message, qos) {
            if (qos === void 0) { qos = defaultQosLevel; }
            _this.networkSocket.write(MqttProtocol_1["default"].createPublishPacket(topic, message, qos));
        };
        /** Subscribe to topic (filter) */
        this.subscribe = function (topic, qos) {
            if (qos === void 0) { qos = defaultQosLevel; }
            _this.networkSocket.write(MqttProtocol_1["default"].createSubscribePacket(topic, qos));
        };
        /** Unsubscribe to topic (filter) */
        this.unsubscribe = function (topic) {
            _this.networkSocket.write(MqttProtocol_1["default"].createUnsubscribePacket(topic));
        };
        /** Send ping request to server */
        this.ping = function () {
            _this.networkSocket.write(String.fromCharCode(12 /* PingReq */ << 4) + '\x00');
            _this.emit('debug', 'Sent: Ping request');
        };
        options.port = options.port || defaultPort;
        options.clientId = options.clientId || MicroMqttClient.generateClientId();
        options.cleanSession = options.cleanSession || true;
        this.options = options;
        this.network = network;
    }
    MicroMqttClient.getConnectionError = function (returnCode) {
        var error = 'Connection refused, ';
        switch (returnCode) {
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
                error += 'unknown return code: ' + returnCode + '.';
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
