/// <reference path="_common.ts" />
import MqttProtocol from "../module/MqttProtocol";

describe("MqttProtocol", () => {
  describe("When calculating the remaining lenght of a package", () => {

    it("it should return 1 byte for the values 0 to 127", () => {
      MqttProtocol.remainingLenght(0).should.deep.equal([0]);
      MqttProtocol.remainingLenght(127).should.deep.equal([127]);
    });

    it("it should return 2 bytes for the values 128 to 16383", () => {
      MqttProtocol.remainingLenght(128).should.deep.equal([128, 1]);
      MqttProtocol.remainingLenght(16383).should.deep.equal([255, 127]);
    });

    it("it should return 3 bytes for the values 16384 to 2097151", () => {
      MqttProtocol.remainingLenght(16384).should.deep.equal([128, 128, 1]);
      MqttProtocol.remainingLenght(2097151).should.deep.equal([255, 255, 127]);
    });

    it("it should return 4 bytes for the values 2097152 to 268435455", () => {
      MqttProtocol.remainingLenght(2097152).should.deep.equal([128, 128, 128, 1]);
      MqttProtocol.remainingLenght(268435455).should.deep.equal([255, 255, 255, 127]);
    });
  });
});
