"use strict";
var FixedPackedId = 1; // Bad...fixed packet id
var KeepAlive = 60;
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
exports.__esModule = true;
exports["default"] = MqttProtocol;
//# sourceMappingURL=MqttProtocol.js.map