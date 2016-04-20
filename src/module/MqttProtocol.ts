/// <reference path="_common"/>
import ConnectionOptions from "./ConnectionOptions";
import ControlPacketType from "./ControlPacketType";

const FixedPackedId = 1; // Bad...fixed packet id
const KeepAlive = 60;

class MqttProtocol {
  // Remaining Length
  // http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718023
  public static remainingLenght(length) {
    let encBytes: number[] = [];
    do {
      let encByte = length & 0b01111111;
      length = length >> 7;
      // if there are more data to encode, set the top bit of this byte
      if (length > 0) {
        encByte += 0b10000000;
      }
      encBytes.push(encByte);
    } while (length > 0);
    return encBytes;
  }

  /** PUBLISH packet parser - returns object with topic and message */
  public static parsePublish(data) {
    if (data.length > 5 && typeof data !== undefined) {
      let cmd = data.charCodeAt(0);
      let rem_len = data.charCodeAt(1);
      let var_len = data.charCodeAt(2) << 8 | data.charCodeAt(3);
      return {
        topic: data.substr(4, var_len),
        message: data.substr(4 + var_len, rem_len - var_len),
        dup: (cmd & 0b00001000) >> 3,
        qos: (cmd & 0b00000110) >> 1,
        retain: cmd & 0b00000001
      };
    }
    else {
      return undefined;
    }
  }

  private static createConnectionFlags(options: ConnectionOptions) {
    let flags = 0;
    flags |= (options.username) ? 0x80 : 0;
    flags |= (options.username && options.password) ? 0x40 : 0;
    flags |= (options.cleanSession) ? 0x02 : 0;
    return flags;
  };

  // Structure of UTF-8 encoded strings
  // http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Figure_1.1_Structure
  private static createString(s) {
    return String.fromCharCode(s.length >> 8, s.length & 255) + s;
  };

  // Structure of an MQTT Control Packet
  // http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc384800392
  private static createPacket(fixed1: number, variable, payload) {
    let fixed2 = this.remainingLenght(variable.length + payload.length);

    return String.fromCharCode(fixed1) +
      String.fromCharCode(...fixed2) +
      variable +
      payload;
  }

  public static createConnectPacket(options: ConnectionOptions) {
    let cmd = ControlPacketType.Connect << 4;

    let protocolName = this.createString("MQTT");
    let protocolLevel = String.fromCharCode(4);
    let flags = String.fromCharCode(this.createConnectionFlags(options));

    let keepAlive = String.fromCharCode(KeepAlive >> 8, KeepAlive & 255);

    let payload = this.createString(options.clientId);
    if (options.username) {
      payload += this.createString(options.username);
      if (options.password) {
        payload += this.createString(options.password);
      }
    }

    return this.createPacket(
      cmd,
      protocolName + protocolLevel + flags + keepAlive,
      payload
      );
  };

  public static createPublishPacket(topic, message, qos) {
    let cmd = ControlPacketType.Publish << 4 | (qos << 1);
    let pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
    let variable = (qos === 0) ? this.createString(topic) : this.createString(topic) + pid;
    return this.createPacket(cmd, variable, message);
  }

  public static createSubscribePacket(topic, qos) {
    let cmd = ControlPacketType.Subscribe << 4 | 2;
    let pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
    return this.createPacket(cmd,
      pid,
      this.createString(topic) +
      String.fromCharCode(qos));
  }

  public static createUnsubscribePacket(topic) {
    let cmd = ControlPacketType.Unsubscribe << 4 | 2;
    let pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
    return this.createPacket(cmd,
      pid,
      this.createString(topic));
  }
}

export default MqttProtocol;
