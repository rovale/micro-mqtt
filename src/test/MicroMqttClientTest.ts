/**
 * Tests for the MQTT client.
 */
/// <reference path='_common.ts' />
import { MicroMqttClient } from '../module/micro-mqtt';
import ConnectionOptions from '../module/ConnectionOptions';
import { Network, NetworkConnectOptions, NetworkSocket } from '../module/micro-mqtt';
import { ConnectFlags } from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';

function pack(...chars: number[]) {
    return String.fromCharCode(...chars);
}

function isOfControlPacketType(packet: string, packetType: ControlPacketType) {
    return (packet.charCodeAt(0) >> 4).should.equal(packetType);
}

function hasRemainingLength(packet: string, length: number) {
    length.should.be.lessThan(127, 'When needed extend the assertions to support longer remaining length');
    return packet.charCodeAt(1).should.equal(length);
}

function hasMqttProtocol(packet: string) {
    packet.charCodeAt(2).should.equal(0, 'String length MSB of the protocol name should be 0');
    packet.charCodeAt(3).should.equal(4, 'String length LSB of the protocol name should be 4');

    return String.fromCharCode(packet.charCodeAt(4), packet.charCodeAt(5), packet.charCodeAt(6), packet.charCodeAt(7))
        .should.equal('MQTT');
}

function hasProtocolLevel4(packet: string) {
    return packet.charCodeAt(8).should.equal(4);
}

function hasConnectFlags(packet: string, flags: number) {
    return packet.charCodeAt(9).should.equal(flags);
}

function hasKeepAliveOf60Seconds(packet: string) {
    packet.charCodeAt(10).should.equal(0);
    return packet.charCodeAt(11).should.equal(60);
}

function hasPayloadStartingAt(packet: string, start: number, ...elements: string[]) : Chai.Assertion {
    // console.log(elements);
    if (elements.length === 0) {
        return packet.length.should.equal(start, 'Expected no more data in the payload');
    }

    const element = elements[0];
    const length = element.length;
    length.should.be.lessThan(255, 'When needed extend the assertions to support longer lengths');
    packet.charCodeAt(start).should.equal(0, `String length MSB of ${element} should be 0`);
    packet.charCodeAt(start + 1).should.equal(length, `String length LSB of ${element} should be ${length}`);
    packet.substr(start + 2, length).should.equal(element);

    return hasPayloadStartingAt(packet, start + 1 + length + 1, ...elements.splice(1));
}

function hasPayload(packet: string, ...elements: string[]) {
    return hasPayloadStartingAt(packet, 12, ...elements);
}

interface EmittedEvent {
    event: string;
    args: any[];
}

class MicroMqttClientTestSubclass extends MicroMqttClient {
    public emittedEvents: EmittedEvent[] = [];

    constructor(options: ConnectionOptions, network?: Network) {
        super(options, network);
        this.emit = (event: string, ...args: any[]) => {
            this.emittedEvents.push({ event: event, args: args });
            return true;
        };
    }

    public emittedInfo() {
        return this.emittedEvents.filter(e => e.event === 'info');
    }
}

class TestNetwork implements Network {
    public connectIsCalled = false;
    public options: NetworkConnectOptions;
    public callback: (socket: NetworkSocket) => void;

    public connect(options: NetworkConnectOptions, callback: (socket: NetworkSocket) => void) {
        this.connectIsCalled = true;
        this.options = options;
        this.callback = callback;
    };
}

interface EventSubscription {
    event: string;
    listener: Function;
}

class TestNetworkSocket implements NetworkSocket {
    public written: string[] = [];
    public eventSubscriptions: EventSubscription[] = [];

    public write(data: string) {
        this.written.push(data);
    };
    public on(event: string, listener: Function) {
        this.eventSubscriptions.push({ event: event, listener: listener });
    };
    public end: () => void;
}

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
            const expectedPacket = pack(16, 23, 0, 4) + 'MQTT' + pack(4, 2, 0, 60, 0, 11) + 'some-client';
            const packet = networkSocket.written[0];

            packet.should.satisfy((p: string) => isOfControlPacketType(p, ControlPacketType.Connect));
            packet.should.satisfy((p: string) => hasRemainingLength(p, (expectedPacket.length - 2)));
            packet.should.satisfy(hasMqttProtocol);
            packet.should.satisfy(hasProtocolLevel4);
            packet.should.satisfy((p: string) => hasConnectFlags(p, ConnectFlags.CleanSession));
            packet.should.satisfy(hasKeepAliveOf60Seconds);
            packet.should.satisfy((p: string) => hasPayload(p, 'some-client'));

            packet.should.equal(expectedPacket);
            packet.should.contain('some-client');
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
            const packet = networkSocket.written[0];
            packet.should.satisfy((p: string) => hasConnectFlags(p, ConnectFlags.UserName | ConnectFlags.CleanSession));
            packet.should.satisfy((p: string) => hasPayload(p, 'some-client', 'some-username'));
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
            const packet = networkSocket.written[0];
            packet.should.satisfy((p: string) => hasConnectFlags(p,
                ConnectFlags.UserName | ConnectFlags.Password | ConnectFlags.CleanSession));
            packet.should.satisfy((p: string) => hasPayload(p, 'some-client', 'some-username', 'some-password'));
        });
    });
});
