/**
 * Tests for the MQTT client.
 */
/// <reference path='_common.ts' />
import { ConnectFlags } from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { MicroMqttClientTestSubclass, TestNetwork, TestNetworkSocket} from './TestClasses';
import ControlPacketVerifier from './ControlPacketVerifier';

describe('MicroMqttClient', () => {
    let subject: MicroMqttClientTestSubclass;
    let network: TestNetwork;
    let networkSocket: TestNetworkSocket;

    describe('When connecting to a specific host and port', () => {
        beforeEach(() => {
            network = new TestNetwork();
            network.connectIsCalled.should.be.equal(false, 'did not expect the client to connect to the network yet');
            subject = new MicroMqttClientTestSubclass({ host: 'some-host', port: 1234 }, network);
            subject.connect();
        });

        it('it should emit information about this action', () => {
            const emittedInfo = subject.emittedInfo();
            emittedInfo.should.have.length(1);
            emittedInfo[0].args.should.have.length(1);
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
            networkSocket.written.should.have.length(1);
            const packet = new ControlPacketVerifier(networkSocket.written[0]);

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
            networkSocket.written.should.have.length(1);
            const packet = new ControlPacketVerifier(networkSocket.written[0]);
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
            networkSocket.written.should.have.length(1);
            const packet = new ControlPacketVerifier(networkSocket.written[0]);
            packet.shouldHaveConnectFlags(ConnectFlags.UserName | ConnectFlags.Password | ConnectFlags.CleanSession);
            packet.shouldHavePayload('some-client', 'some-username', 'some-password');
        });
    });
});
