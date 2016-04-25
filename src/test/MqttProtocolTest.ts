/**
 * Tests for the MQTT protocol.
 */
/// <reference path='_common.ts' />
import { MqttProtocol } from '../module/micro-mqtt';
import ControlPacketVerifier from './ControlPacketVerifier';
import ControlPacketType from '../module/ControlPacketType';

describe('MqttProtocol', () => {
    describe('When calculating the remaining length of a packet', () => {

        it('it should return 1 byte for the values 0 to 127', () => {
            MqttProtocol.remainingLength(0).should.deep.equal([0]);
            MqttProtocol.remainingLength(127).should.deep.equal([127]);
        });

        it('it should return 2 bytes for the values 128 to 16383', () => {
            MqttProtocol.remainingLength(128).should.deep.equal([128, 1]);
            MqttProtocol.remainingLength(16383).should.deep.equal([255, 127]);
        });

        it('it should return 3 bytes for the values 16384 to 2097151', () => {
            MqttProtocol.remainingLength(16384).should.deep.equal([128, 128, 1]);
            MqttProtocol.remainingLength(2097151).should.deep.equal([255, 255, 127]);
        });

        it('it should return 4 bytes for the values 2097152 to 268435455', () => {
            MqttProtocol.remainingLength(2097152).should.deep.equal([128, 128, 128, 1]);
            MqttProtocol.remainingLength(268435455).should.deep.equal([255, 255, 255, 127]);
        });
    });

    describe('When creating a Publish packet', () => {
        let packet : ControlPacketVerifier;

        describe('with a topic a message and a QoS of 0', () => {
            beforeEach(() => {
                packet = new ControlPacketVerifier(MqttProtocol.createPublishPacket('some/topic', 'some-message', 0));
            });

            it('it should return the expected packet.', () => {
                packet.shouldBeOfType(ControlPacketType.Publish);
                packet.shouldHaveValidRemainingLength();
                packet.shouldHaveQoS0();
            });
        });
    });
});
