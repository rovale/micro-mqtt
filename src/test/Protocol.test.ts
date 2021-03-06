/**
 * Tests for the MQTT protocol.
 */
// tslint:disable-next-line:no-import-side-effect no-submodule-imports
import 'chai/register-should';
import ConnectFlags from '../module/ConnectFlags';
import IMessage from '../module/IMessage';
import { Protocol } from '../module/micro-mqtt';
import { ConnectPacketVerifier, PublishPacketVerifier, SubscribePacketVerifier } from './ControlPacketVerifier';

describe('The MQTT protocol', () => {
    describe('When calculating the remaining length of a packet', () => {

        it('it should return 1 byte for the values 0 to 127.', () => {
            Protocol.encodeRemainingLength(0).should.deep.equal([0]);
            Protocol.encodeRemainingLength(127).should.deep.equal([127]);
        });

        it('it should return 2 bytes for the values 128 to 16383.', () => {
            Protocol.encodeRemainingLength(128).should.deep.equal([128, 1]);
            Protocol.encodeRemainingLength(16383).should.deep.equal([255, 127]);
        });

        it('it should return 3 bytes for the values 16384 to 2097151.', () => {
            Protocol.encodeRemainingLength(16384).should.deep.equal([128, 128, 1]);
            Protocol.encodeRemainingLength(2097151).should.deep.equal([255, 255, 127]);
        });

        it('it should return 4 bytes for the values 2097152 to 268435455.', () => {
            Protocol.encodeRemainingLength(2097152).should.deep.equal([128, 128, 128, 1]);
            Protocol.encodeRemainingLength(268435455).should.deep.equal([255, 255, 255, 127]);
        });
    });

    describe('When creating a Connect packet', () => {
        let packet: ConnectPacketVerifier;

        describe('without username and password', () => {
            beforeEach(() => {
                packet = new ConnectPacketVerifier(Protocol.createConnect({
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

        describe('with only a username', () => {
            beforeEach(() => {
                packet = new ConnectPacketVerifier(Protocol.createConnect({
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

        describe('with both username and password', () => {
            beforeEach(() => {
                packet = new ConnectPacketVerifier(Protocol.createConnect({
                    host: 'host',
                    clientId: 'some-client',
                    username: 'some-username',
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

        describe('specifying the Last Will Testament', () => {
            describe('with QoS 0, not retained', () => {
                beforeEach(() => {
                    packet = new ConnectPacketVerifier(Protocol.createConnect({
                        host: 'host',
                        clientId: 'some-client',
                        username: 'some-username',
                        will: {
                            topic: 'some/willTopic',
                            message: 'offline',
                            qos: 0,
                            retain: false
                        }
                    }));
                });

                it('it should provide the correct connect flags.', () => {
                    packet.shouldHaveConnectFlags(ConnectFlags.CleanSession | ConnectFlags.UserName | ConnectFlags.Will);
                });

                it('it should provide the will topic, and the will message.', () => {
                    packet.shouldHavePayload('some-client', 'some/willTopic', 'offline', 'some-username');
                });
            });

            describe('with QoS 1, not retained', () => {
                beforeEach(() => {
                    packet = new ConnectPacketVerifier(Protocol.createConnect({
                        host: 'host',
                        clientId: 'some-client',
                        will: {
                            topic: 'some/willTopic',
                            message: 'offline',
                            qos: 1,
                            retain: false
                        }
                    }));
                });

                it('it should provide the correct connect flags.', () => {
                    packet.shouldHaveConnectFlags(ConnectFlags.CleanSession | ConnectFlags.Will | ConnectFlags.WillQoS1);
                });

                it('it should provide the will topic, and will message.', () => {
                    packet.shouldHavePayload('some-client', 'some/willTopic', 'offline');
                });
            });

            describe('with QoS 2, not retained', () => {
                beforeEach(() => {
                    packet = new ConnectPacketVerifier(Protocol.createConnect({
                        host: 'host',
                        clientId: 'some-client',
                        will: {
                            topic: 'some/willTopic',
                            message: 'offline',
                            qos: 2,
                            retain: false
                        }
                    }));
                });

                it('it should provide the correct connect flags.', () => {
                    packet.shouldHaveConnectFlags(ConnectFlags.CleanSession | ConnectFlags.Will | ConnectFlags.WillQoS2);
                });

                it('it should provide the will topic, and will message.', () => {
                    packet.shouldHavePayload('some-client', 'some/willTopic', 'offline');
                });
            });

            describe('with QoS 0, retained', () => {
                beforeEach(() => {
                    packet = new ConnectPacketVerifier(Protocol.createConnect({
                        host: 'host',
                        clientId: 'some-client',
                        will: {
                            topic: 'some/willTopic',
                            message: 'offline',
                            qos: 0,
                            retain: true
                        }
                    }));
                });

                it('it should provide the correct connect flags.', () => {
                    packet.shouldHaveConnectFlags(ConnectFlags.CleanSession | ConnectFlags.Will | ConnectFlags.WillRetain);
                });

                it('it should provide the will topic, and will message.', () => {
                    packet.shouldHavePayload('some-client', 'some/willTopic', 'offline');
                });
            });
        });
    });

    describe('When creating a Publish packet', () => {
        let packet: PublishPacketVerifier;

        describe('with QoS 0', () => {
            beforeEach(() => {
                packet = new PublishPacketVerifier(Protocol.createPublish('some/topic', 'some-message', 0, false));
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

        describe('with QoS 1', () => {
            beforeEach(() => {
                packet = new PublishPacketVerifier(Protocol.createPublish('some/topic', 'some-message', 1, false));
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

        describe('with QoS 0, retained', () => {
            beforeEach(() => {
                packet = new PublishPacketVerifier(Protocol.createPublish('some/topic', 'some-message', 0, true));
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

    describe('When parsing a Publish packet', () => {
        let actual: IMessage;
        let expected: IMessage;

        describe('with a topic, a message, and QoS 0', () => {
            beforeEach(() => {
                const packet: string = Protocol.createPublish('some/topic', 'some-message', 0, false);
                actual = Protocol.parsePublish(packet);
            });

            it('it should return the expected message.', () => {
                expected = {
                    topic: 'some/topic',
                    content: 'some-message',
                    qos: 0,
                    retain: 0
                };

                actual.should.deep.equal(expected);
            });
        });

        describe('with a topic, a large message, and QoS 0', () => {
            const message: string =
                'some very very very very very very very ' +
                'some very very very very very very very ' +
                'some very very very very very very very ' +
                'some very very very very very very very ' +
                'some very very very very very very very ' +
                'some very very very very very very very ' +
                'some very very very very very very very ' +
                'some very very very very very very very ' +
                'large message';

            beforeEach(() => {
                const packet: string = Protocol.createPublish('some/topic',
                                                              message,
                                                              0, false);
                actual = Protocol.parsePublish(packet);
            });

            it('it should return the expected message.', () => {
                actual.topic.should.equal('some/topic');
                actual.content.should.equal(message);
            });
        });

        describe('with a topic, a message, and QoS 1', () => {
            beforeEach(() => {
                const packet: string = Protocol.createPublish('some/topic', 'some-message', 1, false);
                actual = Protocol.parsePublish(packet);
            });

            it('it should return the expected message.', () => {
                expected = {
                    pid: 1,
                    topic: 'some/topic',
                    content: 'some-message',
                    qos: 1,
                    retain: 0
                };

                actual.should.deep.equal(expected);
            });
        });
    });

    describe('When creating a Subscribe packet', () => {
        let packet: SubscribePacketVerifier;

        describe('with QoS 0', () => {
            beforeEach(() => {
                packet = new SubscribePacketVerifier(Protocol.createSubscribe('some/topic', 0));
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

        describe('with QoS 1', () => {
            beforeEach(() => {
                packet = new SubscribePacketVerifier(Protocol.createSubscribe('some/topic', 1));
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
