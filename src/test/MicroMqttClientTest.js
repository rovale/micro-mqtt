"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * Tests for the MQTT client.
 */
/// <reference path='_common.ts' />
var micro_mqtt_1 = require('../module/micro-mqtt');
function pack() {
    var chars = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        chars[_i - 0] = arguments[_i];
    }
    return String.fromCharCode.apply(String, chars);
}
function isOfControlPacketType(packet, packetType) {
    return (packet.charCodeAt(0) >> 4).should.equal(packetType);
}
function hasRemainingLength(packet, length) {
    length.should.be.lessThan(127, 'When needed extend the assertions to support longer remaining length');
    return packet.charCodeAt(1).should.equal(length);
}
function hasMqttProtocol(packet) {
    packet.charCodeAt(2).should.equal(0, 'String length MSB of the protocol name should be 0');
    packet.charCodeAt(3).should.equal(4, 'String length LSB of the protocol name should be 4');
    return String.fromCharCode(packet.charCodeAt(4), packet.charCodeAt(5), packet.charCodeAt(6), packet.charCodeAt(7))
        .should.equal('MQTT');
}
function hasProtocolLevel4(packet) {
    return packet.charCodeAt(8).should.equal(4);
}
function hasConnectFlags(packet, flags) {
    return packet.charCodeAt(9).should.equal(flags);
}
function hasKeepAliveOf60Seconds(packet) {
    packet.charCodeAt(10).should.equal(0);
    return packet.charCodeAt(11).should.equal(60);
}
function hasPayloadStartingAt(packet, start) {
    var elements = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        elements[_i - 2] = arguments[_i];
    }
    // console.log(elements);
    if (elements.length === 0) {
        return packet.length.should.equal(start, 'Expected no more data in the payload');
    }
    var element = elements[0];
    var length = element.length;
    length.should.be.lessThan(255, 'When needed extend the assertions to support longer lengths');
    packet.charCodeAt(start).should.equal(0, "String length MSB of " + element + " should be 0");
    packet.charCodeAt(start + 1).should.equal(length, "String length LSB of " + element + " should be " + length);
    packet.substr(start + 2, length).should.equal(element);
    return hasPayloadStartingAt.apply(void 0, [packet, start + 1 + length + 1].concat(elements.splice(1)));
}
function hasPayload(packet) {
    var elements = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        elements[_i - 1] = arguments[_i];
    }
    return hasPayloadStartingAt.apply(void 0, [packet, 12].concat(elements));
}
var MicroMqttClientTestSubclass = (function (_super) {
    __extends(MicroMqttClientTestSubclass, _super);
    function MicroMqttClientTestSubclass(options, network) {
        var _this = this;
        _super.call(this, options, network);
        this.emittedEvents = [];
        this.emit = function (event) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            _this.emittedEvents.push({ event: event, args: args });
            return true;
        };
    }
    MicroMqttClientTestSubclass.prototype.emittedInfo = function () {
        return this.emittedEvents.filter(function (e) { return e.event === 'info'; });
    };
    return MicroMqttClientTestSubclass;
}(micro_mqtt_1.MicroMqttClient));
var TestNetwork = (function () {
    function TestNetwork() {
        this.connectIsCalled = false;
    }
    TestNetwork.prototype.connect = function (options, callback) {
        this.connectIsCalled = true;
        this.options = options;
        this.callback = callback;
    };
    ;
    return TestNetwork;
}());
var TestNetworkSocket = (function () {
    function TestNetworkSocket() {
        this.written = [];
        this.eventSubscriptions = [];
    }
    TestNetworkSocket.prototype.write = function (data) {
        this.written.push(data);
    };
    ;
    TestNetworkSocket.prototype.on = function (event, listener) {
        this.eventSubscriptions.push({ event: event, listener: listener });
    };
    ;
    return TestNetworkSocket;
}());
describe('MicroMqttClient', function () {
    var subject;
    var network;
    var networkSocket;
    describe('When connecting to a specific host and port', function () {
        beforeEach(function () {
            network = new TestNetwork();
            network.connectIsCalled.should.be.equal(false, 'did not expect the client to connect to the network yet');
            subject = new MicroMqttClientTestSubclass({ host: 'some-host', port: 1234 }, network);
            subject.connect();
        });
        it('it should emit information about this action', function () {
            var emittedInfo = subject.emittedInfo();
            emittedInfo.should.have.length(1);
            emittedInfo[0].args.should.have.length(1);
            emittedInfo[0].args[0].should.equal("Connecting MicroMqttClient " + subject.version + " to some-host:1234");
        });
        it('it should try to establish a connection to the expected host and port', function () {
            network.connectIsCalled.should.be.equal(true, 'expected the client to connect to the network');
            network.options.host.should.equal('some-host');
            network.options.port.should.equal(1234);
        });
    });
    describe('When connecting without specifying the port', function () {
        beforeEach(function () {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({ host: 'some-host' }, network);
            subject.connect();
        });
        it('it should default to port 1883', function () {
            network.options.port.should.equal(1883);
        });
    });
    describe('When the connection is established', function () {
        beforeEach(function () {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });
        it('it should send a connect packet', function () {
            networkSocket.written.should.have.length(1);
            var expectedPacket = pack(16, 23, 0, 4) + 'MQTT' + pack(4, 2, 0, 60, 0, 11) + 'some-client';
            var packet = networkSocket.written[0];
            packet.should.satisfy(function (p) { return isOfControlPacketType(p, 1 /* Connect */); });
            packet.should.satisfy(function (p) { return hasRemainingLength(p, (expectedPacket.length - 2)); });
            packet.should.satisfy(hasMqttProtocol);
            packet.should.satisfy(hasProtocolLevel4);
            packet.should.satisfy(function (p) { return hasConnectFlags(p, 2 /* CleanSession */); });
            packet.should.satisfy(hasKeepAliveOf60Seconds);
            packet.should.satisfy(function (p) { return hasPayload(p, 'some-client'); });
            packet.should.equal(expectedPacket);
            packet.should.contain('some-client');
        });
    });
    describe('When connecting with a username', function () {
        beforeEach(function () {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({ host: 'host', clientId: 'some-client', username: 'some-username' }, network);
            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });
        it('it should include that info in the connect packet', function () {
            networkSocket.written.should.have.length(1);
            var packet = networkSocket.written[0];
            packet.should.satisfy(function (p) { return hasConnectFlags(p, 128 /* UserName */ | 2 /* CleanSession */); });
            packet.should.satisfy(function (p) { return hasPayload(p, 'some-client', 'some-username'); });
        });
    });
    describe('When connecting with a username and password', function () {
        beforeEach(function () {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({ host: 'host', clientId: 'some-client', username: 'some-username', password: 'some-password' }, network);
            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });
        it('it should include that info in the connect packet', function () {
            networkSocket.written.should.have.length(1);
            var packet = networkSocket.written[0];
            packet.should.satisfy(function (p) { return hasConnectFlags(p, 128 /* UserName */ | 64 /* Password */ | 2 /* CleanSession */); });
            packet.should.satisfy(function (p) { return hasPayload(p, 'some-client', 'some-username', 'some-password'); });
        });
    });
});
