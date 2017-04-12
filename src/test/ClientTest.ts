/**
 * Tests for the MQTT client.
 */
// tslint:disable-next-line:no-reference
/// <reference path='_common.ts'/>
import { ConnectFlags } from '../module/ConnectFlags';
import { ConnectReturnCode } from '../module/ConnectReturnCode';
import { ControlPacketType } from '../module/ControlPacketType';
import { Message } from '../module/Message';
import { Protocol } from '../module/micro-mqtt';
import { ClientTestSubclass, MockNet, MockSocket, NotConnectedWifi} from './TestClasses';
import { ConnectPacketVerifier, SubscribePacketVerifier, PublishPacketVerifier,
    PubAckPacketVerifier, GenericControlPacketVerifier } from './ControlPacketVerifier';
import { ControlPacketBuilder, MqttClientTestSubclassBuilder } from './Builders';
import * as sinon from 'sinon';
import { SinonFakeTimers } from 'sinon';

describe('The MQTT client', () => {
    let subject: ClientTestSubclass;
    let socket: MockSocket;

    context('When establishing a network connection', () => {
        let net: MockNet;

        context('to a specific host and port', () => {
            beforeEach(() => {
                net = new MockNet();
                net.connectIsCalled.should.equal(false, 'did not expect the client to connect to the network yet');
                subject = new ClientTestSubclass({ host: 'some-host', port: 1234, clientId: 'some-clientId' }, net);
                subject.connect();
            });

            it('it should emit information about this action.', () => {
                subject.shouldHaveEmittedInfo('Connecting to some-host:1234');
            });

            it('it should try to establish a connection to the expected host and port.', () => {
                net.connectIsCalled.should.equal(true, 'expected the client to connect to the network');
                net.options.host.should.equal('some-host');
                (net.options.port || 0).should.equal(1234);
            });
        });

        context('without specifying the port', () => {
            beforeEach(() => {
                net = new MockNet();
                subject = new ClientTestSubclass({ host: 'some-host', clientId: 'some-clientId' }, net);
                subject.connect();
            });

            it('it should default to port 1883.', () => {
                (net.options.port || 0).should.equal(1883);
            });
        });
    });

    context('When the network connection is not established within 5 seconds', () => {
        let net: MockNet;
        let clock: SinonFakeTimers;

        beforeEach(() => {
            clock = sinon.useFakeTimers();

            net = new MockNet();
            subject = new ClientTestSubclass({
                host: 'host',
                clientId: 'some-client'
            }, net);

            socket = new MockSocket();
            subject.connect();
        });

        afterEach(() => {
            clock.reset();
        });

        it('it should emit an error.', () => {
            clock.tick(5000);
            subject.shouldHaveEmittedError('No connection. Retrying.');
        });

        it('it should try it again.', () => {
            net.connectIsCalledTwice.should.equal(false, 'because it is the first attempt.');
            clock.tick(5000);
            net.connectIsCalledTwice.should.equal(true, 'because it should try it again.');
        });
    });

    context('When there is no wifi connection', () => {
        let net: MockNet;

        beforeEach(() => {
            net = new MockNet();
            subject = new ClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, net, new NotConnectedWifi());

            socket = new MockSocket();
            subject.connect();
        });

        it('it should emit an error.', () => {
            subject.shouldHaveEmittedError('No wifi connection.');
        });

        it('it should try it again.', () => {
            net.connectIsCalled.should.equal(false, 'because it should not try to connect.');
        });
    });

    context('When the network connection is established', () => {
        let net: MockNet;

        beforeEach(() => {
            socket = new MockSocket();
            net = new MockNet(socket);
            subject = new ClientTestSubclass({
                host: 'host',
                clientId: 'some-client',
                username: 'some-username',
                password: 'some-password',
                will: {
                    topic: 'some/willTopic',
                    message: 'offline'
                }
            }, net);

            subject.connect();
            net.callback();
        });

        it('it should send a Connect packet.', () => {
            socket.sentPackages.should.have.lengthOf(1);
            const packet = new ConnectPacketVerifier(socket.sentPackages[0]);
            packet.shouldHaveConnectFlags(ConnectFlags.UserName | ConnectFlags.Password | ConnectFlags.CleanSession | ConnectFlags.Will);
            packet.shouldHavePayload('some-client', 'some/willTopic', 'offline', 'some-username', 'some-password');
        });
    });

    context('When receiving an unexpected packet', () => {
        beforeEach(() => {
            socket = new MockSocket();

            subject = new MqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(new MockNet(socket))
                .build();

            socket.receivePackage(Protocol.createSubscribe('Some unexpected packet', 0));
        });

        it('it should emit some debug information.', () => {
            subject.shouldHaveEmittedEvent(subject.emittedDebugInfo(),
                i => { return i.should.contain('Rcvd:').and.contain('Some unexpected packet'); });
        });

        it('it should emit an error.', () => {
            subject.shouldHaveEmittedError('MQTT unexpected packet type: 8.');
        });
    });

    context('When not receiving a ConnAck packet within 5 seconds', () => {
        let clock: SinonFakeTimers;
        let net: MockNet;

        beforeEach(() => {
            clock = sinon.useFakeTimers();

            socket = new MockSocket();
            net = new MockNet(socket);

            subject = new MqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(net)
                .build();
        });

        afterEach(() => {
            clock.reset();
        });

        it('it should close the connection.', () => {
            socket.ended.should.equal(false, 'because currently should still be connected.');
            clock.tick(5000);
            socket.ended.should.equal(true, 'because now it should be closed.');
        });
    });

    // tslint:disable-next-line:max-func-body-length
    context('When receiving a ConnAck packet', () => {
        beforeEach(() => {
            socket = new MockSocket();

            subject = new MqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(new MockNet(socket))
                .build();
        });

        context('with ConnectReturnCode UnacceptableProtocolVersion', () => {
            beforeEach(() => {
                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(ConnectReturnCode.UnacceptableProtocolVersion)
                    .build();

                socket.receivePackage(connAckPacket);
            });

            it('it should emit an error.', () => {
                subject.shouldHaveEmittedError('Connection refused, unacceptable protocol version.');
            });
        });

        context('with ConnectReturnCode IdentifierRejected', () => {
            beforeEach(() => {
                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(ConnectReturnCode.IdentifierRejected)
                    .build();

                socket.receivePackage(connAckPacket);
            });

            it('it should emit an error.', () => {
                subject.shouldHaveEmittedError('Connection refused, identifier rejected.');
            });
        });

        context('with ConnectReturnCode ServerUnavailable', () => {
            beforeEach(() => {
                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(ConnectReturnCode.ServerUnavailable)
                    .build();

                socket.receivePackage(connAckPacket);
            });

            it('it should emit an error.', () => {
                subject.shouldHaveEmittedError('Connection refused, server unavailable.');
            });
        });

        context('with ConnectReturnCode BadUserNameOrPassword', () => {
            beforeEach(() => {
                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(ConnectReturnCode.BadUserNameOrPassword)
                    .build();

                socket.receivePackage(connAckPacket);
            });

            it('it should emit an error.', () => {
                subject.shouldHaveEmittedError('Connection refused, bad user name or password.');
            });
        });

        context('with ConnectReturnCode NotAuthorized', () => {
            beforeEach(() => {
                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(ConnectReturnCode.NotAuthorized)
                    .build();

                socket.receivePackage(connAckPacket);
            });

            it('it should emit an error.', () => {
                subject.shouldHaveEmittedError('Connection refused, not authorized.');
            });
        });

        context('with an unknown return code', () => {
            beforeEach(() => {
                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(<ConnectReturnCode>111)
                    .build();

                socket.receivePackage(connAckPacket);
            });

            it('it should emit an error.', () => {
                subject.shouldHaveEmittedError('Connection refused, unknown return code: 111.');
            });
        });

        context('with ConnectReturnCode Accepted', () => {
            let clock: SinonFakeTimers;

            beforeEach(() => {
                clock = sinon.useFakeTimers();

                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(ConnectReturnCode.Accepted)
                    .build();

                socket.receivePackage(connAckPacket);
            });

            afterEach(() => {
                clock.restore();
            });

            it('it should not emit errors.', () => {
                subject.shouldNotEmitErrors();
            });

            it('it should emit information about this succes.', () => {
                subject.shouldHaveEmittedInfo('MQTT connection accepted.');
            });

            it('it should emit the \'connected\' event.', () => {
                const emittedConnect = subject.emittedConnected();
                emittedConnect.should.have.lengthOf(1);
            });

            it('it should send the first PingReq packet after 40 seconds.', () => {
                subject.clearEmittedEvents();
                socket.clear();

                clock.tick(40 * 1000);

                subject.shouldHaveEmittedDebugInfo('Sent: Ping request.');

                socket.sentPackages.should.have.lengthOf(1);
                new GenericControlPacketVerifier(socket.sentPackages[0], ControlPacketType.PingReq)
                    .verify();
            });

            it('it should send PingReq packets every 40 seconds.', () => {
                subject.clearEmittedEvents();
                socket.clear();

                const expectedNumberOfPingReqPackets = 10;
                clock.tick(expectedNumberOfPingReqPackets * 40 * 1000);

                socket.sentPackages.should.have.lengthOf(expectedNumberOfPingReqPackets);
            });
        });
    });

    context('When receiving a Publish packet', () => {
        context('With QoS 0', () => {
            beforeEach(() => {
                socket = new MockSocket();

                subject = new MqttClientTestSubclassBuilder()
                    .whichIsConnectedOn(new MockNet(socket))
                    .build();

                const publishPacket = Protocol.createPublish('some/topic', 'some-message', 0, false);

                socket.receivePackage(publishPacket);
            });

            it('it should emit a \'receive\' event.', () => {
                const events = subject.emittedReceive();
                events.should.have.lengthOf(1);
                (<Message>(events[0].args)).topic.should.equal('some/topic');
            });
        });

        context('With QoS 1', () => {
            let clock: SinonFakeTimers;

            beforeEach(() => {
                clock = sinon.useFakeTimers();

                socket = new MockSocket();

                subject = new MqttClientTestSubclassBuilder()
                    .whichIsConnectedOn(new MockNet(socket))
                    .build();

                const publishPacket = Protocol.createPublish('some/topic', 'some-message', 1, false);

                socket.receivePackage(publishPacket);
            });

            afterEach(() => {
                clock.reset();
            });

            it('it should emit a \'receive\' event.', () => {
                const events = subject.emittedReceive();
                events.should.have.lengthOf(1);
                (<Message>(events[0].args)).topic.should.equal('some/topic');
            });

            it('it should send a PubAck packet.', () => {
                clock.tick(1);
                socket.sentPackages.should.have.lengthOf(1);
                const packet = new PubAckPacketVerifier(socket.sentPackages[0]);
                packet.shouldHaveValidRemainingLength();
                packet.shouldHavePacketId(Protocol.Constants.FixedPackedId);
            });
        });
    });

    context('When receiving a PingResp packet', () => {
        beforeEach(() => {
            socket = new MockSocket();

            subject = new MqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(new MockNet(socket))
                .build();

            socket.receivePackage(new ControlPacketBuilder(ControlPacketType.PingResp).build());
        });

        it('it should not emit errors.', () => {
            subject.shouldNotEmitErrors();
        });
    });

    context('When receiving a PubAck packet', () => {
        beforeEach(() => {
            socket = new MockSocket();

            subject = new MqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(new MockNet(socket))
                .build();

            socket.receivePackage(new ControlPacketBuilder(ControlPacketType.PubAck).build());
        });

        it('it should not emit errors.', () => {
            subject.shouldNotEmitErrors();
        });
    });

    context('When receiving a SubAck packet', () => {
        beforeEach(() => {
            socket = new MockSocket();

            subject = new MqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(new MockNet(socket))
                .build();

            socket.receivePackage(new ControlPacketBuilder(ControlPacketType.SubAck).build());
        });

        it('it should not emit errors.', () => {
            subject.shouldNotEmitErrors();
        });
    });

    context('When subscribing to a topic', () => {
        beforeEach(() => {
            socket = new MockSocket();

            subject = new MqttClientTestSubclassBuilder()
                .whichIsConnectedOn(new MockNet(socket))
                .build();
        });

        context('without specifying the QoS', () => {
            beforeEach(() => {
                subject.subscribe('some/topic');
            });

            it('it should send a Subscribe packet with QoS 0.', () => {
                socket.sentPackages.should.have.lengthOf(1);
                const packet = new SubscribePacketVerifier(socket.sentPackages[0]);
                packet.shouldHaveQoS0();
            });
        });

        context('specifying the QoS 1', () => {
            beforeEach(() => {
                subject.subscribe('some/topic', 1);
            });

            it('it should send a Subscribe packet with QoS 1.', () => {
                socket.sentPackages.should.have.lengthOf(1);
                const packet = new SubscribePacketVerifier(socket.sentPackages[0]);
                packet.shouldHaveQoS1();
            });
        });
    });

    context('When publishing a message', () => {
        beforeEach(() => {
            socket = new MockSocket();

            subject = new MqttClientTestSubclassBuilder()
                .whichIsConnectedOn(new MockNet(socket))
                .build();

            subject.publish('some/topic', 'some-message');
        });

        context('without specifying the QoS', () => {
            beforeEach(() => {
                socket = new MockSocket();

                subject = new MqttClientTestSubclassBuilder()
                    .whichIsConnectedOn(new MockNet(socket))
                    .build();

                subject.publish('some/topic', 'some-message');
            });

            it('it should send a Publish packet with QoS 0.', () => {
                socket.sentPackages.should.have.lengthOf(1);
                const packet = new PublishPacketVerifier(socket.sentPackages[0]);
                packet.shouldHaveQoS0();
            });
        });

        context('with QoS 1.', () => {
            beforeEach(() => {
                socket = new MockSocket();

                subject = new MqttClientTestSubclassBuilder()
                    .whichIsConnectedOn(new MockNet(socket))
                    .build();

                subject.publish('some/topic', 'some-message', 1);
            });

            it('it should send a Publish packet with QoS 1.', () => {
                socket.sentPackages.should.have.lengthOf(1);
                const packet = new PublishPacketVerifier(socket.sentPackages[0]);
                packet.shouldHaveQoS1();
            });
        });

        context('with QoS 1, retained.', () => {
            beforeEach(() => {
                socket = new MockSocket();

                subject = new MqttClientTestSubclassBuilder()
                    .whichIsConnectedOn(new MockNet(socket))
                    .build();

                subject.publish('some/topic', 'some-message', 1, true);
            });

            it('it should send a Publish packet with QoS 1, retained.', () => {
                socket.sentPackages.should.have.lengthOf(1);
                const packet = new PublishPacketVerifier(socket.sentPackages[0]);
                packet.shouldHaveQoS1();
                packet.shouldBeRetained();
            });
        });
    });

    context('When the network connection is lost', () => {
        let clock: SinonFakeTimers;
        let net: MockNet;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            socket = new MockSocket();
            net = new MockNet(socket);

            subject = new MqttClientTestSubclassBuilder()
                .whichIsConnectedOn(net)
                .build();

            socket.close();
            socket.ended.should.equal(false, 'because it is still open.');
        });

        afterEach(() => {
            clock.restore();
        });

        it('it should emit an error.', () => {
            subject.shouldHaveEmittedError('Disconnected.');
        });

        it('it should not send PingReq packets anymore.', () => {
            clock.tick(40 * 1000 * 10);
            socket.sentPackages.should.have.lengthOf(0);
        });

        it('it should close the current socket.', () => {
            clock.tick(5000);
            socket.ended.should.equal(true, 'because it should close the socket.');
        });

        it('it should reconnect.', () => {
            clock.tick(5000);
            net.connectIsCalledTwice.should.equal(true, 'because it should reconnect.');
        });
    });

    context('When receiving two Publish packets at once', () => {
        beforeEach(() => {
            socket = new MockSocket();

            subject = new MqttClientTestSubclassBuilder()
                .whichIsConnectedOn(new MockNet(socket))
                .build();

            const publishPacket = Protocol.createPublish('some/topic', 'some-message', 0, false);

            socket.receivePackage(publishPacket + publishPacket);
        });

        it('it should emit two \'receive\' events.', () => {
            const events = subject.emittedReceive();
            events.should.have.lengthOf(2);
        });
    });
});