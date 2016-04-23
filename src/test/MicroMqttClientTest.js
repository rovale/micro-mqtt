"use strict";
var TestClasses_1 = require('./TestClasses');
var ControlPacketVerifier_1 = require('./ControlPacketVerifier');
var Builders_1 = require('./Builders');
var sinon = require('sinon');
describe('MicroMqttClient', function () {
    var subject;
    var networkSocket;
    describe('When establishing a network connection', function () {
        var network;
        describe('to a specific host and port', function () {
            beforeEach(function () {
                network = new TestClasses_1.TestNetwork();
                network.connectIsCalled.should.be.equal(false, 'did not expect the client to connect to the network yet');
                subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'some-host', port: 1234 }, network);
                subject.connect();
            });
            it('it should emit information about this action', function () {
                subject.shouldHaveEmittedInfo("Connecting MicroMqttClient " + subject.version + " to some-host:1234");
            });
            it('it should try to establish a connection to the expected host and port', function () {
                network.connectIsCalled.should.be.equal(true, 'expected the client to connect to the network');
                network.options.host.should.equal('some-host');
                network.options.port.should.equal(1234);
            });
        });
        describe('without specifying the port', function () {
            beforeEach(function () {
                network = new TestClasses_1.TestNetwork();
                subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'some-host' }, network);
                subject.connect();
            });
            it('it should default to port 1883', function () {
                network.options.port.should.equal(1883);
            });
        });
    });
    describe('When the network connection is established', function () {
        var network;
        describe('and no username and password are specified', function () {
            beforeEach(function () {
                network = new TestClasses_1.TestNetwork();
                subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
                networkSocket = new TestClasses_1.TestNetworkSocket();
                subject.connect();
                network.callback(networkSocket);
            });
            it('it should send a Connect packet without username and password', function () {
                networkSocket.sentPackages.should.have.lengthOf(1);
                var packet = new ControlPacketVerifier_1["default"](networkSocket.sentPackages[0]);
                packet.shouldBeOfType(1 /* Connect */);
                packet.shouldHaveValidRemainingLength();
                packet.shouldHaveMqttProtocol();
                packet.shouldHaveProtocolLevel4();
                packet.shouldHaveConnectFlags(2 /* CleanSession */);
                packet.shouldHaveKeepAliveOf60Seconds();
                packet.shouldHavePayload('some-client');
            });
        });
        describe('and only a username is specified', function () {
            beforeEach(function () {
                network = new TestClasses_1.TestNetwork();
                subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'host', clientId: 'some-client', username: 'some-username' }, network);
                networkSocket = new TestClasses_1.TestNetworkSocket();
                subject.connect();
                network.callback(networkSocket);
            });
            it('it should send a Connect packet with username and without password', function () {
                networkSocket.sentPackages.should.have.lengthOf(1);
                var packet = new ControlPacketVerifier_1["default"](networkSocket.sentPackages[0]);
                packet.shouldHaveConnectFlags(128 /* UserName */ | 2 /* CleanSession */);
                packet.shouldHavePayload('some-client', 'some-username');
            });
        });
        describe('and the username and password are specified', function () {
            beforeEach(function () {
                network = new TestClasses_1.TestNetwork();
                subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'host', clientId: 'some-client', username: 'some-username', password: 'some-password' }, network);
                networkSocket = new TestClasses_1.TestNetworkSocket();
                subject.connect();
                network.callback(networkSocket);
            });
            it('it should send a Connect packet with username and password', function () {
                networkSocket.sentPackages.should.have.lengthOf(1);
                var packet = new ControlPacketVerifier_1["default"](networkSocket.sentPackages[0]);
                packet.shouldHaveConnectFlags(128 /* UserName */ | 64 /* Password */ | 2 /* CleanSession */);
                packet.shouldHavePayload('some-client', 'some-username', 'some-password');
            });
        });
    });
    describe('When receiving an unexpected packet', function () {
        beforeEach(function () {
            networkSocket = new TestClasses_1.TestNetworkSocket();
            subject = new Builders_1.MicroMqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket)
                .build();
            networkSocket.receivePackage('Some unexpected packet');
        });
        it('it should emit some debug information', function () {
            subject.shouldHaveEmittedEvent(subject.emittedDebugInfo(), function (i) { return i.should.contain('Rcvd:').and.contain('\'Some unexpected packet\''); });
        });
        it('it should emit an error', function () {
            subject.shouldHaveEmittedEvent(subject.emittedError(), function (e) { return e.should.contain('MQTT unsupported packet type:'); });
        });
    });
    describe('When receiving a ConnAck packet', function () {
        beforeEach(function () {
            networkSocket = new TestClasses_1.TestNetworkSocket();
            subject = new Builders_1.MicroMqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket)
                .build();
        });
        describe('with ConnectReturnCode UnacceptableProtocolVersion', function () {
            beforeEach(function () {
                var connAckPacket = new Builders_1.ControlPacketBuilder(2 /* ConnAck */)
                    .withConnectReturnCode(1 /* UnacceptableProtocolVersion */)
                    .build();
                networkSocket.receivePackage(connAckPacket);
            });
            it('it should emit an error', function () {
                subject.shouldHaveEmittedError('Connection refused, unacceptable protocol version.');
            });
        });
        describe('with ConnectReturnCode IdentifierRejected', function () {
            beforeEach(function () {
                var connAckPacket = new Builders_1.ControlPacketBuilder(2 /* ConnAck */)
                    .withConnectReturnCode(2 /* IdentifierRejected */)
                    .build();
                networkSocket.receivePackage(connAckPacket);
            });
            it('it should emit an error', function () {
                subject.shouldHaveEmittedError('Connection refused, identifier rejected.');
            });
        });
        describe('with ConnectReturnCode ServerUnavailable', function () {
            beforeEach(function () {
                var connAckPacket = new Builders_1.ControlPacketBuilder(2 /* ConnAck */)
                    .withConnectReturnCode(3 /* ServerUnavailable */)
                    .build();
                networkSocket.receivePackage(connAckPacket);
            });
            it('it should emit an error', function () {
                subject.shouldHaveEmittedError('Connection refused, server unavailable.');
            });
        });
        describe('with ConnectReturnCode BadUserNameOrPassword', function () {
            beforeEach(function () {
                var connAckPacket = new Builders_1.ControlPacketBuilder(2 /* ConnAck */)
                    .withConnectReturnCode(4 /* BadUserNameOrPassword */)
                    .build();
                networkSocket.receivePackage(connAckPacket);
            });
            it('it should emit an error', function () {
                subject.shouldHaveEmittedError('Connection refused, bad user name or password.');
            });
        });
        describe('with ConnectReturnCode NotAuthorized', function () {
            beforeEach(function () {
                var connAckPacket = new Builders_1.ControlPacketBuilder(2 /* ConnAck */)
                    .withConnectReturnCode(5 /* NotAuthorized */)
                    .build();
                networkSocket.receivePackage(connAckPacket);
            });
            it('it should emit an error', function () {
                subject.shouldHaveEmittedError('Connection refused, not authorized.');
            });
        });
        describe('with an unknown return code', function () {
            beforeEach(function () {
                var connAckPacket = new Builders_1.ControlPacketBuilder(2 /* ConnAck */)
                    .withConnectReturnCode(111)
                    .build();
                networkSocket.receivePackage(connAckPacket);
            });
            it('it should emit an error', function () {
                subject.shouldHaveEmittedError('Connection refused, unknown return code: 111.');
            });
        });
        describe('with ConnectReturnCode Accepted', function () {
            var clock;
            beforeEach(function () {
                clock = sinon.useFakeTimers();
                var connAckPacket = new Builders_1.ControlPacketBuilder(2 /* ConnAck */)
                    .withConnectReturnCode(0 /* Accepted */)
                    .build();
                networkSocket.receivePackage(connAckPacket);
            });
            afterEach(function () {
                clock.restore();
            });
            it('it should not emit errors', function () {
                subject.shouldNotEmitErrors();
            });
            it('it should emit information about this succes', function () {
                subject.shouldHaveEmittedInfo('MQTT connection accepted');
            });
            it('it should emit the \'connected\' event', function () {
                var emittedConnect = subject.emittedConnected();
                emittedConnect.should.have.lengthOf(1);
            });
            it('it should send the first PingReq packet after 40 seconds', function () {
                subject.clearEmittedEvents();
                networkSocket.clear();
                clock.tick(40 * 1000);
                subject.shouldHaveEmittedDebugInfo('Sent: Ping request');
                networkSocket.sentPackages.should.have.lengthOf(1);
                var packet = new ControlPacketVerifier_1["default"](networkSocket.sentPackages[0]);
                packet.shouldBeOfType(12 /* PingReq */);
                packet.shouldHaveValidRemainingLength();
            });
            it('it should send PingReq packets every 40 seconds', function () {
                subject.clearEmittedEvents();
                networkSocket.clear();
                var expectedNumberOfPingReqPackets = 10;
                clock.tick(expectedNumberOfPingReqPackets * 40 * 1000);
                networkSocket.sentPackages.should.have.lengthOf(expectedNumberOfPingReqPackets);
            });
        });
    });
});
