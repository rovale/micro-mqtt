/**
 * Tests for the MQTT client.
 */
/// <reference path='_common.ts' />
import { ConnectFlags, ConnectReturnCode } from '../module/micro-mqtt';
import { MqttProtocol }  from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { MicroMqttClientTestSubclass, TestNetwork, TestNetworkSocket} from './TestClasses';
import { ConnectPacketVerifier, SubscribePacketVerifier, PublishPacketVerifier,
    PubAckPacketVerifier, GenericControlPacketVerifier } from './ControlPacketVerifier';
import { ControlPacketBuilder, MicroMqttClientTestSubclassBuilder } from './Builders';
import * as sinon from 'sinon';

describe('MicroMqttClient', () => {
    let subject: MicroMqttClientTestSubclass;
    let networkSocket: TestNetworkSocket;

    context('When establishing a network connection', () => {
        let network: TestNetwork;

        context('to a specific host and port', () => {
            beforeEach(() => {
                network = new TestNetwork();
                network.connectIsCalled.should.be.equal(false, 'did not expect the client to connect to the network yet');
                subject = new MicroMqttClientTestSubclass({ host: 'some-host', port: 1234 }, network);
                subject.connect();
            });

            it('it should emit information about this action.', () => {
                subject.shouldHaveEmittedInfo(`Connecting MicroMqttClient ${subject.version} to some-host:1234`);
            });

            it('it should try to establish a connection to the expected host and port.', () => {
                network.connectIsCalled.should.be.equal(true, 'expected the client to connect to the network');
                network.options.host.should.equal('some-host');
                network.options.port.should.equal(1234);
            });
        });

        context('without specifying the port', () => {
            beforeEach(() => {
                network = new TestNetwork();
                subject = new MicroMqttClientTestSubclass({ host: 'some-host' }, network);
                subject.connect();
            });

            it('it should default to port 1883.', () => {
                network.options.port.should.equal(1883);
            });
        });
    });

    context('When the network connection is established', () => {
        let network: TestNetwork;

        beforeEach(() => {
            network = new TestNetwork();
            subject = new MicroMqttClientTestSubclass({
                host: 'host',
                clientId: 'some-client',
                username: 'some-username',
                password: 'some-password'
            }, network);

            networkSocket = new TestNetworkSocket();
            subject.connect();
            network.callback(networkSocket);
        });

        it('it should send a Connect packet.', () => {
            networkSocket.sentPackages.should.have.lengthOf(1);
            const packet = new ConnectPacketVerifier(networkSocket.sentPackages[0]);
            packet.shouldHaveConnectFlags(ConnectFlags.UserName | ConnectFlags.Password | ConnectFlags.CleanSession);
            packet.shouldHavePayload('some-client', 'some-username', 'some-password');
        });
    });

    context('When receiving an unexpected packet', () => {
        beforeEach(() => {
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
                .whichJustSentAConnectPacketOn(networkSocket)
                .build();

            networkSocket.receivePackage(MqttProtocol.createSubscribePacket('Some unexpected packet', 0));
        });

        it('it should emit some debug information.', () => {
            subject.shouldHaveEmittedEvent(subject.emittedDebugInfo(),
                i => { return i.should.contain('Rcvd:').and.contain('Some unexpected packet'); });
        });

        it('it should emit an error.', () => {
            subject.shouldHaveEmittedError('MQTT unexpected packet type: 8');
        });
    });

    context('When receiving a ConnAck packet', () => {
        beforeEach(() => {
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
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
                subject.shouldHaveEmittedInfo('MQTT connection accepted');
            });

            it('it should emit the \'connected\' event.', () => {
                const emittedConnect = subject.emittedConnected();
                emittedConnect.should.have.lengthOf(1);
            });

            it('it should send the first PingReq packet after 40 seconds.', () => {
                subject.clearEmittedEvents();
                networkSocket.clear();

                clock.tick(40 * 1000);

                subject.shouldHaveEmittedDebugInfo('Sent: Ping request');

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
                networkSocket = new TestNetworkSocket();

                subject = new MicroMqttClientTestSubclassBuilder()
                    .whichIsConnectedOn(networkSocket)
                    .build();

                const publishPacket = MqttProtocol.createPublishPacket('some/topic', 'some-message', 0, false);

                networkSocket.receivePackage(publishPacket);
            });

            it('it should emit a \'publish\' event.', () => {
                const events = subject.emittedPublish();
                events.should.have.lengthOf(1);
                events[0].args.should.have.lengthOf(1);
                <MqttProtocol.PublishPacket>(events[0].args[0]).topic.should.equal('some/topic');
            });
        });

        context('With QoS 1', () => {
            beforeEach(() => {
                networkSocket = new TestNetworkSocket();

                subject = new MicroMqttClientTestSubclassBuilder()
                    .whichIsConnectedOn(networkSocket)
                    .build();

                const publishPacket = MqttProtocol.createPublishPacket('some/topic', 'some-message', 1, false);

                networkSocket.receivePackage(publishPacket);
            });

            it('it should emit a \'publish\' event.', () => {
                const events = subject.emittedPublish();
                events.should.have.lengthOf(1);
                events[0].args.should.have.lengthOf(1);
                <MqttProtocol.PublishPacket>(events[0].args[0]).topic.should.equal('some/topic');
            });


            it('it should send a PubAck packet.', () => {
                networkSocket.sentPackages.should.have.lengthOf(1);
                const packet = new PubAckPacketVerifier(networkSocket.sentPackages[0]);
                packet.shouldHaveValidRemainingLength();
                packet.shouldHavePacketId(MqttProtocol.fixedPackedId);
            });
        });
    });

    context('When receiving a PingResp packet', () => {
        beforeEach(() => {
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
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
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
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
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
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
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
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
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
                .whichIsConnectedOn(networkSocket)
                .build();

            subject.publish('some/topic', 'some-message');
        });

        context('without specifying the QoS', () => {
            beforeEach(() => {
                networkSocket = new TestNetworkSocket();

                subject = new MicroMqttClientTestSubclassBuilder()
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
                networkSocket = new TestNetworkSocket();

                subject = new MicroMqttClientTestSubclassBuilder()
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
                networkSocket = new TestNetworkSocket();

                subject = new MicroMqttClientTestSubclassBuilder()
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

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
                .whichIsConnectedOn(networkSocket)
                .build();

            networkSocket.end();
        });

        afterEach(() => {
            clock.restore();
        });

        it('it should emit information about this event.', () => {
            subject.shouldHaveEmittedInfo('MQTT client disconnected');
        });

        it('it should emit the \'disconnected\' event.', () => {
            const emittedDisconnect = subject.emittedDisconnected();
            emittedDisconnect.should.have.lengthOf(1);
        });

        it('it should not send PingReq packets anymore.', () => {
            clock.tick(40 * 1000 * 10);
            networkSocket.sentPackages.should.have.lengthOf(0);
        });
    });

    context('When receiving two Publish packets at once', () => {
        beforeEach(() => {
            networkSocket = new TestNetworkSocket();

            subject = new MicroMqttClientTestSubclassBuilder()
                .whichIsConnectedOn(networkSocket)
                .build();

            const publishPacket = MqttProtocol.createPublishPacket('some/topic', 'some-message', 0, false);

            networkSocket.receivePackage(publishPacket + publishPacket);
        });

        it('it should emit two \'publish\' events.', () => {
            const events = subject.emittedPublish();
            events.should.have.lengthOf(2);
        });
    });
});