"use strict";
/**
 * Tests for the MQTT protocol.
 */
/// <reference path='_common.ts' />
var MqttProtocol_1 = require('../module/MqttProtocol');
describe('MqttProtocol', function () {
    describe('When calculating the remaining lenght of a package', function () {
        it('it should return 1 byte for the values 0 to 127', function () {
            MqttProtocol_1["default"].remainingLenght(0).should.deep.equal([0]);
            MqttProtocol_1["default"].remainingLenght(127).should.deep.equal([127]);
        });
        it('it should return 2 bytes for the values 128 to 16383', function () {
            MqttProtocol_1["default"].remainingLenght(128).should.deep.equal([128, 1]);
            MqttProtocol_1["default"].remainingLenght(16383).should.deep.equal([255, 127]);
        });
        it('it should return 3 bytes for the values 16384 to 2097151', function () {
            MqttProtocol_1["default"].remainingLenght(16384).should.deep.equal([128, 128, 1]);
            MqttProtocol_1["default"].remainingLenght(2097151).should.deep.equal([255, 255, 127]);
        });
        it('it should return 4 bytes for the values 2097152 to 268435455', function () {
            MqttProtocol_1["default"].remainingLenght(2097152).should.deep.equal([128, 128, 128, 1]);
            MqttProtocol_1["default"].remainingLenght(268435455).should.deep.equal([255, 255, 255, 127]);
        });
    });
});
