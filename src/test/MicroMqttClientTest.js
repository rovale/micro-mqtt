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
var ControlPacketVerifier_1 = require('./ControlPacketVerifier');
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
            var packet = new ControlPacketVerifier_1["default"](networkSocket.written[0]);
            packet.shouldBeOfType(1 /* Connect */);
            packet.shouldHaveRemainingLength();
            packet.shouldHaveMqttProtocol();
            packet.shouldHaveProtocolLevel4();
            packet.shouldHaveConnectFlags(2 /* CleanSession */);
            packet.shouldHaveKeepAliveOf60Seconds();
            packet.shouldHavePayload('some-client');
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
            var packet = new ControlPacketVerifier_1["default"](networkSocket.written[0]);
            packet.shouldHaveConnectFlags(128 /* UserName */ | 2 /* CleanSession */);
            packet.shouldHavePayload('some-client', 'some-username');
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
            var packet = new ControlPacketVerifier_1["default"](networkSocket.written[0]);
            packet.shouldHaveConnectFlags(128 /* UserName */ | 64 /* Password */ | 2 /* CleanSession */);
            packet.shouldHavePayload('some-client', 'some-username', 'some-password');
        });
    });
});
