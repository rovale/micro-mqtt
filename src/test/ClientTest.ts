/**
 * Tests for the MQTT client.
 */
/// <reference path='_common.ts' />
import { ConnectFlags, ConnectReturnCode } from '../module/micro-mqtt';
import { Protocol, Message }  from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { ClientTestSubclass, MockNetwork, MockNetworkSocket} from './TestClasses';
import { ConnectPacketVerifier, SubscribePacketVerifier, PublishPacketVerifier,
    PubAckPacketVerifier, GenericControlPacketVerifier } from './ControlPacketVerifier';
import { ControlPacketBuilder, ClientTestSubclassBuilder } from './Builders';
import * as sinon from 'sinon';

describe('The MQTT client', () => {
    let subject: ClientTestSubclass;
    let networkSocket: MockNetworkSocket;

    context('When establishing a network connection', () => {
        let network: MockNetwork;

        context('to a specific host and port', () => {
            beforeEach(() => {
                network = new MockNetwork();
                network.connectIsCalled.should.equal(false, 'did not expect the client to connect to the network yet');
                subject = new ClientTestSubclass(network, { host: 'some-host', port: 1234 });
                subject.connect();
            });

            it('it should try to establish a connection to the expected host and port.', () => {
                network.connectIsCalled.should.equal(true, 'expected the client to connect to the network');
                network.options.host.should.equal('some-host');
                network.options.port.should.equal(1234);
            });
        });

        context('without specifying the port', () => {
            beforeEach(() => {
                network = new MockNetwork();
                subject = new ClientTestSubclass(network, { host: 'some-host' });
                subject.connect();
            });

            it('it should default to port 1883.', () => {
                network.options.port.should.equal(1883);
            });
        });
    });

    context('When the network connection is established', () => {
        let network: MockNetwork;

        beforeEach(() => {
            network = new MockNetwork();
            subject = new ClientTestSubclass(network,
                {
                    host: 'host',
                    clientId: 'some-client',
                    username: 'some-username',
                    password: 'some-password',
                    will: {
                        topic: 'some/willTopic',
                        message: 'offline'
                    }
                });

            networkSocket = new MockNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });

        it('it should send a Connect packet.', () => {
            networkSocket.sentPackages.should.have.lengthOf(1);
            const packet = new ConnectPacketVerifier(networkSocket.sentPackages[0]);
            packet.shouldHaveConnectFlags(ConnectFlags.UserName | ConnectFlags.Password | ConnectFlags.CleanSession | ConnectFlags.Will);
            packet.shouldHavePayload('some-client', 'some/willTopic', 'offline', 'some-username', 'some-password');
        });
    });

    context('When receiving an unexpected packet', () => {
        beforeEach(() => {
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket)
                .build();

            networkSocket.receivePackage(Protocol.createSubscribe('Some unexpected packet', 0));
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
        let clock: Sinon.SinonFakeTimers;
        let network: MockNetwork;

        beforeEach(() => {
            clock = sinon.useFakeTimers();

            network = new MockNetwork();
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket, network)
                .build();
        });

        afterEach(() => {
            clock.reset();
        });

        it('it should emit an error.', () => {
            clock.tick(5000);
            subject.shouldHaveEmittedError('MQTT connection timeout. Reconnecting.');
        });

        it('it should reconnect.', () => {
            network.connectIsCalledTwice.should.equal(false, 'because it is the first attempt.');
            clock.tick(5000);
            network.connectIsCalledTwice.should.equal(true, 'because it should reconnect.');
        });
    });

    context('When receiving a ConnAck packet', () => {
        beforeEach(() => {
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket)
                .build();
        });

        context('with ConnectReturnCode UnacceptableProtocolVersion', () => {
            beforeEach(() => {
                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(ConnectReturnCode.UnacceptableProtocolVersion)
                    .build();

                networkSocket.receivePackage(connAckPacket);
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

                networkSocket.receivePackage(connAckPacket);
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

                networkSocket.receivePackage(connAckPacket);
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

                networkSocket.receivePackage(connAckPacket);
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

                networkSocket.receivePackage(connAckPacket);
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

                networkSocket.receivePackage(connAckPacket);
            });

            it('it should emit an error.', () => {
                subject.shouldHaveEmittedError('Connection refused, unknown return code: 111.');
            });
        });

        context('with ConnectReturnCode Accepted', () => {
            let clock: Sinon.SinonFakeTimers;

            beforeEach(() => {
                clock = sinon.useFakeTimers();

                const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
                    .withConnectReturnCode(ConnectReturnCode.Accepted)
                    .build();

                networkSocket.receivePackage(connAckPacket);
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
                networkSocket.clear();

                clock.tick(40 * 1000);

                subject.shouldHaveEmittedDebugInfo('Sent: Ping request.');

                networkSocket.sentPackages.should.have.lengthOf(1);
                new GenericControlPacketVerifier(networkSocket.sentPackages[0], ControlPacketType.PingReq)
                    .verify();
            });

            it('it should send PingReq packets every 40 seconds.', () => {
                subject.clearEmittedEvents();
                networkSocket.clear();

                const expectedNumberOfPingReqPackets = 10;
                clock.tick(expectedNumberOfPingReqPackets * 40 * 1000);

                networkSocket.sentPackages.should.have.lengthOf(expectedNumberOfPingReqPackets);
            });
        });
    });

    context('When receiving a Publish packet', () => {
        context('With QoS 0', () => {
            beforeEach(() => {
                networkSocket = new MockNetworkSocket();

                subject = new ClientTestSubclassBuilder()
                    .whichIsConnectedOn(networkSocket)
                    .build();

                const publishPacket = Protocol.createPublish('some/topic', 'some-message', 0, false);

                networkSocket.receivePackage(publishPacket);
            });

            it('it should emit a \'receive\' event.', () => {
                const events = subject.emittedReceive();
                events.should.have.lengthOf(1);
                (<Message>(events[0].args)).topic.should.equal('some/topic');
            });
        });

        context('With QoS 1', () => {
            let clock: Sinon.SinonFakeTimers;

            beforeEach(() => {
                clock = sinon.useFakeTimers();

                networkSocket = new MockNetworkSocket();

                subject = new ClientTestSubclassBuilder()
                    .whichIsConnectedOn(networkSocket)
                    .build();

                const publishPacket = Protocol.createPublish('some/topic', 'some-message', 1, false);

                networkSocket.receivePackage(publishPacket);
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
                networkSocket.sentPackages.should.have.lengthOf(1);
                const packet = new PubAckPacketVerifier(networkSocket.sentPackages[0]);
                packet.shouldHaveValidRemainingLength();
                packet.shouldHavePacketId(Protocol.Constants.FixedPackedId);
            });
        });
    });

    context('When receiving a PingResp packet', () => {
        beforeEach(() => {
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket)
                .build();

            networkSocket.receivePackage(new ControlPacketBuilder(ControlPacketType.PingResp).build());
        });

        it('it should not emit errors.', () => {
            subject.shouldNotEmitErrors();
        });
    });

    context('When receiving a PubAck packet', () => {
        beforeEach(() => {
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket)
                .build();

            networkSocket.receivePackage(new ControlPacketBuilder(ControlPacketType.PubAck).build());
        });

        it('it should not emit errors.', () => {
            subject.shouldNotEmitErrors();
        });
    });

    context('When receiving a SubAck packet', () => {
        beforeEach(() => {
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket)
                .build();

            networkSocket.receivePackage(new ControlPacketBuilder(ControlPacketType.SubAck).build());
        });

        it('it should not emit errors.', () => {
            subject.shouldNotEmitErrors();
        });
    });

    context('When subscribing to a topic', () => {
        beforeEach(() => {
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichIsConnectedOn(networkSocket)
                .build();
        });

        context('without specifying the QoS', () => {
            beforeEach(() => {
                subject.subscribe('some/topic');
            });

            it('it should send a Subscribe packet with QoS 0.', () => {
                networkSocket.sentPackages.should.have.lengthOf(1);
                const packet = new SubscribePacketVerifier(networkSocket.sentPackages[0]);
                packet.shouldHaveQoS0();
            });
        });

        context('specifying the QoS 1', () => {
            beforeEach(() => {
                subject.subscribe('some/topic', 1);
            });

            it('it should send a Subscribe packet with QoS 1.', () => {
                networkSocket.sentPackages.should.have.lengthOf(1);
                const packet = new SubscribePacketVerifier(networkSocket.sentPackages[0]);
                packet.shouldHaveQoS1();
            });
        });
    });

    context('When publishing a message', () => {
        beforeEach(() => {
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichIsConnectedOn(networkSocket)
                .build();

            subject.publish('some/topic', 'some-message');
        });

        context('without specifying the QoS', () => {
            beforeEach(() => {
                networkSocket = new MockNetworkSocket();

                subject = new ClientTestSubclassBuilder()
                    .whichIsConnectedOn(networkSocket)
                    .build();

                subject.publish('some/topic', 'some-message');
            });

            it('it should send a Publish packet with QoS 0.', () => {
                networkSocket.sentPackages.should.have.lengthOf(1);
                const packet = new PublishPacketVerifier(networkSocket.sentPackages[0]);
                packet.shouldHaveQoS0();
            });
        });

        context('with QoS 1.', () => {
            beforeEach(() => {
                networkSocket = new MockNetworkSocket();

                subject = new ClientTestSubclassBuilder()
                    .whichIsConnectedOn(networkSocket)
                    .build();

                subject.publish('some/topic', 'some-message', 1);
            });

            it('it should send a Publish packet with QoS 1.', () => {
                networkSocket.sentPackages.should.have.lengthOf(1);
                const packet = new PublishPacketVerifier(networkSocket.sentPackages[0]);
                packet.shouldHaveQoS1();
            });
        });

        context('with QoS 1, retained.', () => {
            beforeEach(() => {
                networkSocket = new MockNetworkSocket();

                subject = new ClientTestSubclassBuilder()
                    .whichIsConnectedOn(networkSocket)
                    .build();

                subject.publish('some/topic', 'some-message', 1, true);
            });

            it('it should send a Publish packet with QoS 1, retained.', () => {
                networkSocket.sentPackages.should.have.lengthOf(1);
                const packet = new PublishPacketVerifier(networkSocket.sentPackages[0]);
                packet.shouldHaveQoS1();
                packet.shouldBeRetained();
            });
        });
    });

    context('When the network connection is lost', () => {
        let clock: Sinon.SinonFakeTimers;
        let network: MockNetwork;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            network = new MockNetwork();
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichIsConnectedOn(networkSocket, network)
                .build();

            networkSocket.end();
        });

        afterEach(() => {
            clock.restore();
        });

        it('it should not send PingReq packets anymore.', () => {
            clock.tick(40 * 1000 * 10);
            networkSocket.sentPackages.should.have.lengthOf(0);
        });
    });

    context('When receiving two Publish packets at once', () => {
        beforeEach(() => {
            networkSocket = new MockNetworkSocket();

            subject = new ClientTestSubclassBuilder()
                .whichIsConnectedOn(networkSocket)
                .build();

            const publishPacket = Protocol.createPublish('some/topic', 'some-message', 0, false);

            networkSocket.receivePackage(publishPacket + publishPacket);
        });

        it('it should emit two \'receive\' events.', () => {
            const events = subject.emittedReceive();
            events.should.have.lengthOf(2);
        });
    });
});