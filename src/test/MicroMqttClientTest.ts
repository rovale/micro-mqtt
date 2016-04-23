/**
 * Tests for the MQTT client.
 */
/// <reference path='_common.ts' />
import { ConnectFlags, ConnectReturnCode } from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { MicroMqttClientTestSubclass, TestNetwork, TestNetworkSocket} from './TestClasses';
import ControlPacketVerifier from './ControlPacketVerifier';
import ControlPacketBuilder from './ControlPacketBuilder';
import * as sinon from 'sinon';

describe('MicroMqttClient', () => {
    let subject: MicroMqttClientTestSubclass;
    let network: TestNetwork;
    let networkSocket: TestNetworkSocket;
    let clock: Sinon.SinonFakeTimers;

    describe('When connecting to a specific host and port', () => {
        beforeEach(() => {
            network = new TestNetwork();
            network.connectIsCalled.should.be.equal(false, 'did not expect the client to connect to the network yet');
            subject = new MicroMqttClientTestSubclass({ host: 'some-host', port: 1234 }, network);
            subject.connect();
        });

        it('it should emit information about this action', () => {
            const emittedInfo = subject.emittedInfo();
            emittedInfo.should.have.lengthOf(1);
            emittedInfo[0].args.should.have.lengthOf(1);
            emittedInfo[0].args[0].should.equal(`Connecting MicroMqttClient ${subject.version} to some-host:1234`);
        });

        it('it should try to establish a connection to the expected host and port', () => {
            network.connectIsCalled.should.be.equal(true, 'expected the client to connect to the network');
            network.options.host.should.equal('some-host');
            network.options.port.should.equal(1234);
        });
    });

    describe('When connecting without specifying the port', () => {
        beforeEach(() => {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({ host: 'some-host' }, network);
            subject.connect();
        });

        it('it should default to port 1883', () => {
            network.options.port.should.equal(1883);
        });
    });

    describe('When the connection is established', () => {
        beforeEach(() => {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });

        it('it should send a connect packet', () => {
            networkSocket.sentPackages.should.have.lengthOf(1);
            const packet = new ControlPacketVerifier(networkSocket.sentPackages[0]);

            packet.shouldBeOfType(ControlPacketType.Connect);
            packet.shouldHaveRemainingLength();
            packet.shouldHaveMqttProtocol();
            packet.shouldHaveProtocolLevel4();
            packet.shouldHaveConnectFlags(ConnectFlags.CleanSession);
            packet.shouldHaveKeepAliveOf60Seconds();
            packet.shouldHavePayload('some-client');
        });
    });

    describe('When connecting with a username', () => {
        beforeEach(() => {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass(
                { host: 'host', clientId: 'some-client', username: 'some-username' }, network);
            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });

        it('it should include that info in the connect packet', () => {
            networkSocket.sentPackages.should.have.lengthOf(1);
            const packet = new ControlPacketVerifier(networkSocket.sentPackages[0]);
            packet.shouldHaveConnectFlags(ConnectFlags.UserName | ConnectFlags.CleanSession);
            packet.shouldHavePayload('some-client', 'some-username');
        });
    });

    describe('When connecting with a username and password', () => {
        beforeEach(() => {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass(
                { host: 'host', clientId: 'some-client', username: 'some-username', password: 'some-password' }, network);
            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });

        it('it should include that info in the connect packet', () => {
            networkSocket.sentPackages.should.have.lengthOf(1);
            const packet = new ControlPacketVerifier(networkSocket.sentPackages[0]);
            packet.shouldHaveConnectFlags(ConnectFlags.UserName | ConnectFlags.Password | ConnectFlags.CleanSession);
            packet.shouldHavePayload('some-client', 'some-username', 'some-password');
        });
    });

    describe('When receiving an unexpected packet', () => {
        beforeEach(() => {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
            networkSocket.receivePackage('Some unexpected packet');
        });

        it('it should emit some debug information', () => {
            const emittedDebugInfo = subject.emittedDebugInfo();
            emittedDebugInfo.should.have.lengthOf(1);
            emittedDebugInfo[0].args.should.have.lengthOf(1);
            const debugInfo: string = emittedDebugInfo[0].args[0];
            debugInfo.should.contain('Rcvd:');
            debugInfo.should.contain('\'Some unexpected packet\'');
        });

        it('it should emit an error', () => {
            const emittedError = subject.emittedError();
            emittedError.should.have.lengthOf(1);
            emittedError[0].args.should.have.lengthOf(1);
            const error: string = emittedError[0].args[0];
            error.should.contain('MQTT unsupported packet type:');
        });
    });

    describe('When receiving a ConnAck Accepted packet', () => {
        beforeEach(() => {
            clock = sinon.useFakeTimers();

            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
            subject.clearEmittedEvents();

            const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                .withConnectReturnCode(ConnectReturnCode.Accepted)
                .build();

            networkSocket.receivePackage(connAckPacket);
        });

        afterEach(() => {
            clock.restore();
        });

        it('it should not emit errors', () => {
            subject.shouldNotEmitErrors();
        });

        it('it should emit information about this succes', () => {
            const emittedInfo = subject.emittedInfo();
            emittedInfo.should.have.lengthOf(1);
            emittedInfo[0].args.should.have.lengthOf(1);
            emittedInfo[0].args[0].should.equal('MQTT connection accepted');
        });

        it('it should emit the \'connected\' event', () => {
            const emittedConnect = subject.emittedConnected();
            emittedConnect.should.have.lengthOf(1);
        });

        it('it should start sending Ping packets every 40 seconds', () => {
            subject.clearEmittedEvents();
            networkSocket.clear();

            clock.tick(40 * 1000);

            const emittedDebugInfo = subject.emittedDebugInfo();
            emittedDebugInfo.should.have.lengthOf(1);
            emittedDebugInfo[0].args.should.have.lengthOf(1);
            emittedDebugInfo[0].args[0].should.equal('Sent: Ping request');

            networkSocket.sentPackages.should.have.lengthOf(1);
            const packet = new ControlPacketVerifier(networkSocket.sentPackages[0]);
            packet.shouldBeOfType(ControlPacketType.PingReq);

            clock.tick(2 * 40 * 1000);
            networkSocket.sentPackages.should.have.lengthOf(3);
        });
    });
});
