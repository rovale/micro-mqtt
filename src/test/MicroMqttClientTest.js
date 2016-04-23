"use strict";
var TestClasses_1 = require('./TestClasses');
var ControlPacketVerifier_1 = require('./ControlPacketVerifier');
describe('MicroMqttClient', function () {
    var subject;
    var network;
    var networkSocket;
    describe('When connecting to a specific host and port', function () {
        beforeEach(function () {
            network = new TestClasses_1.TestNetwork();
            network.connectIsCalled.should.be.equal(false, 'did not expect the client to connect to the network yet');
            subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'some-host', port: 1234 }, network);
            subject.connect();
        });
        it('it should emit information about this action', function () {
            var emittedInfo = subject.emittedInfo();
            emittedInfo.should.have.lengthOf(1);
            emittedInfo[0].args.should.have.lengthOf(1);
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
            network = new TestClasses_1.TestNetwork();
            subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'some-host' }, network);
            subject.connect();
        });
        it('it should default to port 1883', function () {
            network.options.port.should.equal(1883);
        });
    });
    describe('When the connection is established', function () {
        beforeEach(function () {
            network = new TestClasses_1.TestNetwork();
            subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
            networkSocket = new TestClasses_1.TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });
        it('it should send a connect packet', function () {
            networkSocket.written.should.have.lengthOf(1);
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
            network = new TestClasses_1.TestNetwork();
            subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'host', clientId: 'some-client', username: 'some-username' }, network);
            networkSocket = new TestClasses_1.TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });
        it('it should include that info in the connect packet', function () {
            networkSocket.written.should.have.lengthOf(1);
            var packet = new ControlPacketVerifier_1["default"](networkSocket.written[0]);
            packet.shouldHaveConnectFlags(128 /* UserName */ | 2 /* CleanSession */);
            packet.shouldHavePayload('some-client', 'some-username');
        });
    });
    describe('When connecting with a username and password', function () {
        beforeEach(function () {
            network = new TestClasses_1.TestNetwork();
            subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'host', clientId: 'some-client', username: 'some-username', password: 'some-password' }, network);
            networkSocket = new TestClasses_1.TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });
        it('it should include that info in the connect packet', function () {
            networkSocket.written.should.have.lengthOf(1);
            var packet = new ControlPacketVerifier_1["default"](networkSocket.written[0]);
            packet.shouldHaveConnectFlags(128 /* UserName */ | 64 /* Password */ | 2 /* CleanSession */);
            packet.shouldHavePayload('some-client', 'some-username', 'some-password');
        });
    });
    describe('When the MQTT server sends an unexpected packet', function () {
        beforeEach(function () {
            network = new TestClasses_1.TestNetwork();
            subject = new TestClasses_1.MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
            networkSocket = new TestClasses_1.TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
            networkSocket.receive('Some unexpected packet');
        });
        it('it should emit some debug information', function () {
            var emittedDebugInfo = subject.emittedDebugInfo();
            emittedDebugInfo.should.have.lengthOf(1);
            emittedDebugInfo[0].args.should.have.lengthOf(1);
            var debugInfo = emittedDebugInfo[0].args[0];
            debugInfo.should.contain('Rcvd:');
            debugInfo.should.contain('\'Some unexpected packet\'');
        });
        it('it should emit an error', function () {
            var emittedError = subject.emittedError();
            emittedError.should.have.lengthOf(1);
            emittedError[0].args.should.have.lengthOf(1);
            var error = emittedError[0].args[0];
            error.should.contain('MQTT unsupported packet type:');
        });
    });
});
