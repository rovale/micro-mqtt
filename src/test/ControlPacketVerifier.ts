import ControlPacketType from '../module/ControlPacketType';
import { Constants, Protocol } from '../module/micro-mqtt';

/**
 * Verifies the content of a control packet.
 */
abstract class ControlPacketVerifier {
    protected packet: string;
    protected packetType: ControlPacketType;

    constructor(packet: string, packetType: ControlPacketType) {
        this.packet = packet;
        this.packetType = packetType;
        this.shouldHaveTheCorrectType();
    }

    public verify(): Chai.Assertion {
        return this.shouldHaveTheCorrectType();
    }

    protected hasTextStartingAt(start: number, text: string): Chai.Assertion {
        const length: number = text.length;
        length.should.be.lessThan(255, 'When needed extend the assertions to support longer lengths');
        this.packet.charCodeAt(start).should.equal(0, `String length MSB of '${text}' should be 0`);
        this.packet.charCodeAt(start + 1).should.equal(length, `String length LSB of '${text}'' should be ${length}`);

        return this.packet.substr(start + 2, length).should.equal(text);
    }

    private shouldHaveTheCorrectType() : Chai.Assertion {
        return (this.packet.charCodeAt(0) >> 4).should.equal(this.packetType);
    }

}

export class GenericControlPacketVerifier extends ControlPacketVerifier {
    constructor(packet: string, packetType: ControlPacketType) {
        super(packet, packetType);
    }
}

export class PublishPacketVerifier extends ControlPacketVerifier {
    constructor(packet: string) {
        super(packet, ControlPacketType.Publish);
    }

    public shouldHaveValidRemainingLength(): Chai.Assertion {
        this.packet.should.have.length.lessThan(127, 'When needed extend the assertions to support longer remaining length');

        return this.remainingLength().should.equal(this.packet.length - 2);
    }

    public shouldHaveQoS0(): Chai.Assertion {
        return this.qoS().should.equal(0);
    }

    public shouldHaveQoS1(): Chai.Assertion {
        return this.qoS().should.equal(1);
    }

    public shouldHaveMessage(message: string): Chai.Assertion {
        let variableLength: number = this.packet.charCodeAt(2) << 8 | this.packet.charCodeAt(3);
        if (this.qoS() > 0) {
            variableLength += 2;
        }
        const messageLength: number = this.remainingLength() - variableLength;
        const actualMessage: string = this.packet.substr(2 + 2 + variableLength, messageLength);

        return actualMessage.should.equal(message);
    }

    public shouldBeRetained(): Chai.Assertion {
        return (this.packet.charCodeAt(0) & 0b00000001).should.equal(1);
    }

    public shouldNotBeRetained(): Chai.Assertion {
        return (this.packet.charCodeAt(0) & 0b00000001).should.equal(0);
    }

    public shouldHaveTopic(topic: string): Chai.Assertion {
        return this.hasTextStartingAt(2, topic);
    }

    public shouldHaveAPacketId(): Chai.Assertion {
        const topicLength: number = this.packet.charCodeAt(2) << 8 | this.packet.charCodeAt(3);
        const packetIdPosition: number = 2 + 2 + topicLength;
        const packetId: number = this.packet.charCodeAt(packetIdPosition) << 8 | this.packet.charCodeAt(packetIdPosition + 1);

        return packetId.should.equal(1, 'since it is currently hard coded.');
    }

    private remainingLength(): number {
        return this.packet.charCodeAt(1);
    }

    private qoS(): number {
        return (this.packet.charCodeAt(0) & 0b00000110) >> 1;
    }
}

export class PubAckPacketVerifier extends ControlPacketVerifier {
    constructor(packet: string) {
        super(packet, ControlPacketType.PubAck);
    }

    public shouldHaveValidRemainingLength(): Chai.Assertion {
        return this.packet.charCodeAt(1).should.equal(2, 'the length of a PubAck packet is 4 bytes.');
    }

    public shouldHavePacketId(id: number): Chai.Assertion {
        const packetId: number = this.packet.charCodeAt(2) << 8 | this.packet.charCodeAt(3);

        return packetId.should.equal(1);
    }
}

export class SubscribePacketVerifier extends ControlPacketVerifier {
    constructor(packet: string) {
        super(packet, ControlPacketType.Subscribe);
    }

    /**
     * [MQTT-3.8.1-1] Bits 3,2,1 and 0 of the fixed header of the SUBSCRIBE Control Packet are reserved
     * and MUST be set to 0,0,1 and 0 respectively. The Server MUST treat any other value as malformed and
     * close the Network Connection.
     */
    public shouldSetTheReservedBits(): Chai.Assertion {
        return (this.packet.charCodeAt(0) & 0b00001111).should.equal(0b00000010);
    }

    public shouldHaveQoS0(): Chai.Assertion {
        return this.qoS().should.equal(0);
    }

    public shouldHaveQoS1(): Chai.Assertion {
        return this.qoS().should.equal(1);
    }

    public shouldHaveTopic(topic: string): Chai.Assertion {
        return this.hasTextStartingAt(4, topic);
    }

    public shouldHaveAPacketId(): Chai.Assertion {
        const packetIdPosition: number = 2;
        const packetId: number = this.packet.charCodeAt(packetIdPosition) << 8 | this.packet.charCodeAt(packetIdPosition + 1);

        return packetId.should.equal(Constants.FixedPackedId, 'since it is currently hard coded.');
    }

    private qoS(): number {
        return (this.packet.charCodeAt(this.packet.length - 1));
    }
}

export class ConnectPacketVerifier extends ControlPacketVerifier {
    constructor(packet: string) {
        super(packet, ControlPacketType.Connect);
    }

    public shouldHaveValidRemainingLength(): Chai.Assertion {
        this.packet.should.have.length.lessThan(127, 'When needed extend the assertions to support longer remaining length');

        return this.remainingLength().should.equal(this.packet.length - 2);
    }

    public shouldHaveMqttProtocol(): Chai.Assertion {
        this.packet.charCodeAt(2).should.equal(0, 'String length MSB of the protocol name should be 0');
        this.packet.charCodeAt(3).should.equal(4, 'String length LSB of the protocol name should be 4');

        return String.fromCharCode(
            this.packet.charCodeAt(4),
            this.packet.charCodeAt(5),
            this.packet.charCodeAt(6),
            this.packet.charCodeAt(7)
        ).should.equal('MQTT');
    }

    public shouldHaveProtocolLevel4(): Chai.Assertion {
        return this.packet.charCodeAt(8).should.equal(4);
    }

    public shouldHaveKeepAliveOf60Seconds(): Chai.Assertion {
        this.packet.charCodeAt(10).should.equal(0);

        return this.packet.charCodeAt(11).should.equal(60);
    }

    public shouldHavePayload(...elements: string[]): Chai.Assertion {
        return this.hasPayloadStartingAt(12, ...elements);
    }

    public shouldHaveConnectFlags(flags: number): Chai.Assertion {
        return this.packet.charCodeAt(9).should.equal(flags);
    }

    private remainingLength(): number {
        return this.packet.charCodeAt(1);
    }

    private hasPayloadStartingAt(start: number, ...elements: string[]): Chai.Assertion {
        if (elements.length === 0) {
            return this.packet.length.should.equal(start, 'Expected no more data in the payload');
        }

        const element: string = elements[0];
        this.hasTextStartingAt(start, element);

        return this.hasPayloadStartingAt(start + 1 + element.length + 1, ...elements.splice(1));
    }
}
