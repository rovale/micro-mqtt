"use strict";
/**
 * Verifies the content of a control packet.
 */
var ControlPacketVerifier = (function () {
    function ControlPacketVerifier(packet) {
        this.packet = packet;
    }
    ControlPacketVerifier.prototype.shouldBeOfType = function (packetType) {
        return (this.packet.charCodeAt(0) >> 4).should.equal(packetType);
    };
    ControlPacketVerifier.prototype.shouldHaveValidRemainingLength = function () {
        this.packet.should.have.length.lessThan(127, 'When needed extend the assertions to support longer remaining length');
        return this.packet.charCodeAt(1).should.equal(this.packet.length - 2);
    };
    ControlPacketVerifier.prototype.shouldHaveMqttProtocol = function () {
        this.packet.charCodeAt(2).should.equal(0, 'String length MSB of the protocol name should be 0');
        this.packet.charCodeAt(3).should.equal(4, 'String length LSB of the protocol name should be 4');
        return String.fromCharCode(this.packet.charCodeAt(4), this.packet.charCodeAt(5), this.packet.charCodeAt(6), this.packet.charCodeAt(7)).should.equal('MQTT');
    };
    ControlPacketVerifier.prototype.shouldHaveProtocolLevel4 = function () {
        return this.packet.charCodeAt(8).should.equal(4);
    };
    ControlPacketVerifier.prototype.shouldHaveConnectFlags = function (flags) {
        return this.packet.charCodeAt(9).should.equal(flags);
    };
    ControlPacketVerifier.prototype.shouldHaveKeepAliveOf60Seconds = function () {
        this.packet.charCodeAt(10).should.equal(0);
        return this.packet.charCodeAt(11).should.equal(60);
    };
    ControlPacketVerifier.prototype.hasPayloadStartingAt = function (start) {
        var elements = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            elements[_i - 1] = arguments[_i];
        }
        if (elements.length === 0) {
            return this.packet.length.should.equal(start, 'Expected no more data in the payload');
        }
        var element = elements[0];
        var length = element.length;
        length.should.be.lessThan(255, 'When needed extend the assertions to support longer lengths');
        this.packet.charCodeAt(start).should.equal(0, "String length MSB of " + element + " should be 0");
        this.packet.charCodeAt(start + 1).should.equal(length, "String length LSB of " + element + " should be " + length);
        this.packet.substr(start + 2, length).should.equal(element);
        return this.hasPayloadStartingAt.apply(this, [start + 1 + length + 1].concat(elements.splice(1)));
    };
    ControlPacketVerifier.prototype.shouldHavePayload = function () {
        var elements = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            elements[_i - 0] = arguments[_i];
        }
        return this.hasPayloadStartingAt.apply(this, [12].concat(elements));
    };
    return ControlPacketVerifier;
}());
exports.__esModule = true;
exports["default"] = ControlPacketVerifier;
