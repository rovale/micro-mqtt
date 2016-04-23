"use strict";
var TestClasses_1 = require('./TestClasses');
var MicroMqttClientTestSubclassBuilder = (function () {
    function MicroMqttClientTestSubclassBuilder() {
    }
    MicroMqttClientTestSubclassBuilder.prototype.whichJustSentAConnectPacketOn = function (networkSocket) {
        var network = new TestClasses_1.TestNetwork();
        this.client = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
        this.client.connect();
        network.callback(networkSocket);
        this.client.clearEmittedEvents();
        return this;
    };
    MicroMqttClientTestSubclassBuilder.prototype.build = function () {
        return this.client;
    };
    return MicroMqttClientTestSubclassBuilder;
}());
exports.MicroMqttClientTestSubclassBuilder = MicroMqttClientTestSubclassBuilder;
var ControlPacketBuilder = (function () {
    function ControlPacketBuilder(controlPacketType) {
        this.controlPacketType = controlPacketType;
    }
    ControlPacketBuilder.prototype.withConnectReturnCode = function (connectReturnCode) {
        this.connectReturnCode = connectReturnCode;
        return this;
    };
    ControlPacketBuilder.prototype.build = function () {
        var result = String.fromCharCode(this.controlPacketType << 4);
        result += String.fromCharCode(0);
        result += String.fromCharCode(0);
        result += String.fromCharCode(this.connectReturnCode);
        return result;
    };
    return ControlPacketBuilder;
}());
exports.ControlPacketBuilder = ControlPacketBuilder;
