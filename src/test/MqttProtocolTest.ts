/**
 * Tests for the MQTT protocol.
 */
/// <reference path='_common.ts' />
import { MqttProtocol, ConnectFlags } from '../module/micro-mqtt';
import { ConnectPacketVerifier, PublishPacketVerifier, SubscribePacketVerifier } from './ControlPacketVerifier';

describe('MqttProtocol', () => {
    context('When calculating the remaining length of a packet', () => {

        it('it should return 1 byte for the values 0 to 127.', () => {
            MqttProtocol.remainingLength(0).should.deep.equal([0]);
            MqttProtocol.remainingLength(127).should.deep.equal([127]);
        });

        it('it should return 2 bytes for the values 128 to 16383.', () => {
            MqttProtocol.remainingLength(128).should.deep.equal([128, 1]);
            MqttProtocol.remainingLength(16383).should.deep.equal([255, 127]);
        });

        it('it should return 3 bytes for the values 16384 to 2097151.', () => {
            MqttProtocol.remainingLength(16384).should.deep.equal([128, 128, 1]);
            MqttProtocol.remainingLength(2097151).should.deep.equal([255, 255, 127]);
        });

        it('it should return 4 bytes for the values 2097152 to 268435455.', () => {
            MqttProtocol.remainingLength(2097152).should.deep.equal([128, 128, 128, 1]);
            MqttProtocol.remainingLength(268435455).should.deep.equal([255, 255, 255, 127]);
        });
    });

    context('When creating a Connect packet', () => {
        let packet: ConnectPacketVerifier;

        context('without username and password', () => {
            beforeEach(() => {
                packet = new ConnectPacketVerifier(MqttProtocol.createConnectPacket({
                    host: 'some-host',
                    clientId: 'some-client'
                }));
            });

            it('it should have a valid remaining length.', () => {
                packet.shouldHaveValidRemainingLength();
            });

            it('it should have the MQTT protocol.', () => {
                packet.shouldHaveMqttProtocol();
            });

            it('it should have protocol level 4.', () => {
                packet.shouldHaveProtocolLevel4();
            });

            it('it should start a clean session.', () => {
                packet.shouldHaveConnectFlags(ConnectFlags.CleanSession);
            });

            it('it should have a keep alive of 60 seconds.', () => {
                packet.shouldHaveKeepAliveOf60Seconds();
            });

            it('it should provide the client id.', () => {
                packet.shouldHavePayload('some-client');
            });
        });

        context('with only a username', () => {
            beforeEach(() => {
                packet = new ConnectPacketVerifier(MqttProtocol.createConnectPacket({
                    host: 'host',
                    clientId: 'some-client',
                    username: 'some-username'
                }));
            });

            it('it should provide the correct connect flags.', () => {
                packet.shouldHaveConnectFlags(ConnectFlags.UserName | ConnectFlags.CleanSession);
            });

            it('it should provide the client id and the username.', () => {
                packet.shouldHavePayload('some-client', 'some-username');
            });
        });

        context('with both username and password', () => {
            beforeEach(() => {
                packet = new ConnectPacketVerifier(MqttProtocol.createConnectPacket({
                    host: 'host',
                    clientId: 'some-client', username: 'some-username',
                    password: 'some-password'
                }));
            });

            it('it should provide the correct connect flags.', () => {
                packet.shouldHaveConnectFlags(ConnectFlags.UserName | ConnectFlags.Password | ConnectFlags.CleanSession);
            });

            it('it should provide the client id, the username, and the password.', () => {
                packet.shouldHavePayload('some-client', 'some-username', 'some-password');
            });
        });
    });

    context('When creating a Publish packet', () => {
        let packet: PublishPacketVerifier;

        context('with QoS 0', () => {
            beforeEach(() => {
                packet = new PublishPacketVerifier(MqttProtocol.createPublishPacket('some/topic', 'some-message', 0, false));
            });

            it('it should have a valid remaining length.', () => {
                packet.shouldHaveValidRemainingLength();
            });

            it('it should have QoS 0.', () => {
                packet.shouldHaveQoS0();
            });

            it('it should not be retained.', () => {
                packet.shouldNotBeRetained();
            });

            it('it should contain the topic.', () => {
                packet.shouldHaveTopic('some/topic');
            });

            it('it should contain the message.', () => {
                packet.shouldHaveMessage('some-message');
            });
        });

        context('with QoS 1', () => {
            beforeEach(() => {
                packet = new PublishPacketVerifier(MqttProtocol.createPublishPacket('some/topic', 'some-message', 1, false));
            });

            it('it should have a valid remaining length.', () => {
                packet.shouldHaveValidRemainingLength();
            });

            it('it should have QoS 1.', () => {
                packet.shouldHaveQoS1();
            });

            it('it should not be retained.', () => {
                packet.shouldNotBeRetained();
            });

            it('it should contain the topic.', () => {
                packet.shouldHaveTopic('some/topic');
            });

            it('it should have a fixed packet id.', () => {
                packet.shouldHaveAPacketId();
            });

            it('it should contain the message.', () => {
                packet.shouldHaveMessage('some-message');
            });
        });

        context('with QoS 0, retained', () => {
            beforeEach(() => {
                packet = new PublishPacketVerifier(MqttProtocol.createPublishPacket('some/topic', 'some-message', 0, true));
            });

            it('it should have a valid remaining length.', () => {
                packet.shouldHaveValidRemainingLength();
            });

            it('it should have QoS 0.', () => {
                packet.shouldHaveQoS0();
            });

            it('it should not retained.', () => {
                packet.shouldBeRetained();
            });

            it('it should contain the topic.', () => {
                packet.shouldHaveTopic('some/topic');
            });

            it('it should contain the message.', () => {
                packet.shouldHaveMessage('some-message');
            });
        });
    });

    context('When parsing a Publish packet', () => {
        let parsedPacket: MqttProtocol.PublishPacket;

        context('with a topic, a message, and QoS 0', () => {
            beforeEach(() => {
                const packet = MqttProtocol.createPublishPacket('some/topic', 'some-message', 0, false);
                parsedPacket = MqttProtocol.parsePublishPacket(packet);
            });

            it('it should return the expected data.', () => {
                parsedPacket.should.deep.equal({
                    'topic': 'some/topic',
                    'message': 'some-message',
                    'qos': 0,
                    'retain': 0
                });
            });
        });

        context('with a topic, a message, and QoS 1', () => {
            beforeEach(() => {
                const packet = MqttProtocol.createPublishPacket('some/topic', 'some-message', 1, false);
                parsedPacket = MqttProtocol.parsePublishPacket(packet);
            });

            it('it should return the expected data.', () => {
                parsedPacket.should.deep.equal({
                    'pid': 1,
                    'topic': 'some/topic',
                    'message': 'some-message',
                    'qos': 1,
                    'retain': 0
                });
            });
        });
    });

    context('When creating a Subscribe packet', () => {
        let packet: SubscribePacketVerifier;

        context('with QoS 0', () => {
            beforeEach(() => {
                packet = new SubscribePacketVerifier(MqttProtocol.createSubscribePacket('some/topic', 0));
            });

            it('it should set the reserved bits.', () => {
                packet.shouldSetTheReservedBits();
            });

            it('it should have a fixed packet id.', () => {
                packet.shouldHaveAPacketId();
            });

            it('it should contain the topic.', () => {
                packet.shouldHaveTopic('some/topic');
            });

            it('it should have QoS 0.', () => {
                packet.shouldHaveQoS0();
            });
        });

        context('with QoS 1', () => {
            beforeEach(() => {
                packet = new SubscribePacketVerifier(MqttProtocol.createSubscribePacket('some/topic', 1));
            });

            it('it should set the reserved bits.', () => {
                packet.shouldSetTheReservedBits();
            });

            it('it should have a fixed packet id.', () => {
                packet.shouldHaveAPacketId();
            });

            it('it should contain the topic.', () => {
                packet.shouldHaveTopic('some/topic');
            });

            it('it should have QoS 1.', () => {
                packet.shouldHaveQoS1();
            });
        });
    });
});
