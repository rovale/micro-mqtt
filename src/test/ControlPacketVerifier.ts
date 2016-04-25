import ControlPacketType from '../module/ControlPacketType';

/**
 * Verifies the content of a control packet.
 */
export default class ControlPacketVerifier {
    private packet: string;

    constructor(packet: string) {
        this.packet = packet;
    }

    public shouldBeOfType(packetType: ControlPacketType) {
        return (this.packet.charCodeAt(0) >> 4).should.equal(packetType);
    }

    public shouldHaveQoS0() {
        return (this.packet.charCodeAt(0) & 0b00000110).should.equal(0);
    }

    public shouldHaveValidRemainingLength() {
        this.packet.should.have.length.lessThan(127, 'When needed extend the assertions to support longer remaining length');
        return this.packet.charCodeAt(1).should.equal(this.packet.length - 2);
    }

    public shouldHaveMqttProtocol() {
        this.packet.charCodeAt(2).should.equal(0, 'String length MSB of the protocol name should be 0');
        this.packet.charCodeAt(3).should.equal(4, 'String length LSB of the protocol name should be 4');

        return String.fromCharCode(
            this.packet.charCodeAt(4),
            this.packet.charCodeAt(5),
            this.packet.charCodeAt(6),
            this.packet.charCodeAt(7)
        ).should.equal('MQTT');
    }

    public shouldHaveProtocolLevel4() {
        return this.packet.charCodeAt(8).should.equal(4);
    }

    public shouldHaveConnectFlags(flags: number) {
        return this.packet.charCodeAt(9).should.equal(flags);
    }

    public shouldHaveKeepAliveOf60Seconds() {
        this.packet.charCodeAt(10).should.equal(0);
        return this.packet.charCodeAt(11).should.equal(60);
    }

    private hasPayloadStartingAt(start: number, ...elements: string[]): Chai.Assertion {
        if (elements.length === 0) {
            return this.packet.length.should.equal(start, 'Expected no more data in the payload');
        }

        const element = elements[0];
        const length = element.length;
        length.should.be.lessThan(255, 'When needed extend the assertions to support longer lengths');
        this.packet.charCodeAt(start).should.equal(0, `String length MSB of ${element} should be 0`);
        this.packet.charCodeAt(start + 1).should.equal(length, `String length LSB of ${element} should be ${length}`);
        this.packet.substr(start + 2, length).should.equal(element);

        return this.hasPayloadStartingAt(start + 1 + length + 1, ...elements.splice(1));
    }

    public shouldHavePayload(...elements: string[]) {
        return this.hasPayloadStartingAt(12, ...elements);
    }
}
