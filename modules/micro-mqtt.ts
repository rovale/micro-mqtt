declare var require: (module: string) => any;

/* Copyright (c) 2014 Lars Toft Jacobsen (boxed.dk), Gordon Williams. See the file LICENSE for copying permission. */
/*
Simple MQTT protocol wrapper for Espruino sockets.
*/

const FixedPackedId = 1; // Bad...fixed packet id
const DefaultQosLevel = 0;
const DefaultPort = 1883;
const ConnectionTimeout = 5;
const KeepAlive = 60;
const PingInterval = 40;

// http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc353481061
const enum ControlPacketType {
  Connect = 1,
  ConnAck = 2,
  Publish = 3,
  PubAck = 4,
  PubRec = 5,
  PubRel = 6,
  PubComp = 7,
  Subscribe = 8,
  SubAck = 9,
  Unsubscribe = 10,
  UnsubAck = 11,
  PingReq = 12,
  PingResp = 13,
  Disconnect = 14
};

// http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349256
const enum ConnectReturnCode {
  Accepted = 0,
  UnacceptableProtocolVersion = 1,
  IdentifierRejected = 2,
  ServerUnavailable = 3,
  BadUserNameOrPassword = 4,
  NotAuthorized = 5
};

export class MicroMqttClient {
  public version = "0.0.5";
  private port: number;
  private clientId: string;
  private cleanSession: boolean;
  private username: string;
  private password: string;
  private net: any;
  private connected = false;

  private emit: (event: string, ...args: any[]) => boolean;

  constructor(private server: string, options) {
    console.log("MicroMqttClient " + this.version);

    this.server = server;
    var options = options || {};
    this.port = options.port || DefaultPort;
    this.clientId = options.clientId || MicroMqttClient.generateClientId();
    this.cleanSession = options.cleanSession || true;
    this.username = options.username;
    this.password = options.password;
  }

  private static generateClientId = (() => {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return () => {
      return s4() + s4() + s4();
    };
  })();

  private static getConnectionError(returnCode: number) {
    var error = "Connection refused, ";
    switch (returnCode) {
      case ConnectReturnCode.UnacceptableProtocolVersion:
        error += "unacceptable protocol version.";
        break;
      case ConnectReturnCode.IdentifierRejected:
        error += "identifier rejected.";
        break;
      case ConnectReturnCode.ServerUnavailable:
        error += "server unavailable.";
        break;
      case ConnectReturnCode.BadUserNameOrPassword:
        error += "bad user name or password.";
        break;
      case ConnectReturnCode.NotAuthorized:
        error += "not authorized.";
        break;
      default:
        error += "unknown return code: " + returnCode + ".";
    }
    return error;
  }

  /** Establish connection and set up keep alive ping */
  public connect = (net?) => {
    let connectionTimeOutId: number;
    let pingIntervalId: number;

    let onNetConnected = () => {
      console.log('Client connected');
      net.write(MqttProtocol.createConnectPacket(this.clientId, this.username, this.password, this.cleanSession));

      // Disconnect if no CONNACK is received
      connectionTimeOutId = setTimeout(() => {
        this.disconnect();
      }, ConnectionTimeout * 1000);

      // Set up regular keep alive ping
      pingIntervalId = setInterval(() => {
        this.ping();
      }, PingInterval * 1000);

      // Incoming data
      net.on('data', (data) => {
        let type: ControlPacketType = data.charCodeAt(0) >> 4;

        switch (type) {
          case ControlPacketType.Publish:
            let parsedData = MqttProtocol.parsePublish(data);
            this.emit('publish', parsedData);
            this.emit('message', parsedData.topic, parsedData.message);
            break;
          case ControlPacketType.PubAck:
          case ControlPacketType.SubAck:
          case ControlPacketType.UnsubAck:
            console.log(type);
            break;
          case ControlPacketType.PingReq:
            net.write(ControlPacketType.PingResp + "\x00"); // reply to PINGREQ
            break
          case ControlPacketType.PingResp:
            this.emit('ping_reply');
            break;
          case ControlPacketType.ConnAck:
            clearTimeout(connectionTimeOutId);
            var returnCode = data.charCodeAt(3);
            if (returnCode === ConnectReturnCode.Accepted) {
              this.connected = true;
              console.log("MQTT connection accepted");
              this.emit('connected');
            }
            else {
              let connectionError = this.getConnectionError(returnCode);
              console.log(connectionError);
              this.emit('error', connectionError);
            }
            break;
          default:
            console.log("MQTT unsupported packet type: " + type);
            console.log("[MQTT]" + data.split("").map((c) => { return c.charCodeAt(0); }));
            break;
        }
      });

      net.on('end', () => {
        console.log('MQTT client disconnected');
        clearInterval(pingIntervalId);
        this.emit('disconnected');
        this.emit('close');
      });

      this.net = net;
    };

    if (net) { onNetConnected(); }
    else {
      net = require("net")
        .connect({ host: this.server, port: this.port }, onNetConnected);
      // TODO: Reconnect on timeout
    }
  };

  /** Disconnect from server */
  public disconnect = () => {
    this.net.write(String.fromCharCode(ControlPacketType.Disconnect << 4) + "\x00");
    this.net.end();
    this.net = false;
    this.connected = false;
  };

  /** Publish message using specified topic */
  public publish = (topic, message, qos = DefaultQosLevel) => {
    this.net.write(MqttProtocol.createPublishPacket(topic, message, qos));
  };

  /** Subscribe to topic (filter) */
  public subscribe = (topic: string, qos = DefaultQosLevel) => {
    this.net.write(MqttProtocol.createSubscribePacket(topic, qos));
  };

  /** Unsubscribe to topic (filter) */
  public unsubscribe = (topic) => {
    this.net.write(MqttProtocol.createUnsubscribePacket(topic));
  };

  /** Send ping request to server */
  private ping = () => {
    this.net.write(String.fromCharCode(ControlPacketType.PingReq << 4) + "\x00");
  };
}

class MqttProtocol {
  /* Utility functions ***************************/
  /** Create escaped hex value from number */
  private static escapeHex(number) {
    return String.fromCharCode(parseInt(number.toString(16), 16));
  }

  /** MQTT string (length MSB, LSB + data) */
  private static mqttStr(s) {
    return String.fromCharCode(s.length >> 8, s.length & 255) + s;
  };

  /** MQTT packet length formatter - algorithm from reference docs */
  private static mqttPacketLength(length) {
    var encLength = '';
    do {
      var encByte = length & 127;
      length = length >> 7;
      // if there are more data to encode, set the top bit of this byte
      if (length > 0) {
        encByte += 128;
      }
      encLength += String.fromCharCode(encByte);
    } while (length > 0)
    return encLength;
  }

  /** MQTT standard packet formatter */
  private static createPacket(cmd, variable, payload) {
    return String.fromCharCode(cmd) + this.mqttPacketLength(variable.length + payload.length) + variable + payload;
  }

  /** PUBLISH packet parser - returns object with topic and message */
  public static parsePublish(data) {
    if (data.length > 5 && typeof data !== undefined) {
      var cmd = data.charCodeAt(0);
      var rem_len = data.charCodeAt(1);
      var var_len = data.charCodeAt(2) << 8 | data.charCodeAt(3);
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

  private static createConnectionFlags(username: string, password: string, cleanSession: boolean) {
    var flags = 0;
    flags |= (username) ? 0x80 : 0;
    flags |= (username && password) ? 0x40 : 0;
    flags |= (cleanSession) ? 0x02 : 0;
    return this.escapeHex(flags);
  };

  public static createConnectPacket(clientId: string, username: string, password: string, cleanSession: boolean) {
    let cmd = ControlPacketType.Connect << 4;
    let protocolName = this.mqttStr("MQTT");
    let protocolLevel = this.escapeHex(4);

    let flags = this.createConnectionFlags(username, password, cleanSession);

    let keepAlive = String.fromCharCode(KeepAlive >> 8, KeepAlive & 255);

    let payload = this.mqttStr(clientId);
    if (username) {
      payload += this.mqttStr(username);
      if (password) {
        payload += this.mqttStr(password);
      }
    }

    return this.createPacket(
      cmd,
      protocolName + protocolLevel + flags + keepAlive,
      payload
    );
  };

  public static createPublishPacket(topic, message, qos) {
    var cmd = ControlPacketType.Publish << 4 | (qos << 1);
    var pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
    var variable = (qos === 0) ? this.mqttStr(topic) : this.mqttStr(topic) + pid;
    return this.createPacket(cmd, variable, message);
  }

  public static createSubscribePacket(topic, qos) {
    var cmd = ControlPacketType.Subscribe << 4 | 2;
    var pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
    return this.createPacket(cmd,
      pid,
      this.mqttStr(topic) +
      String.fromCharCode(qos));
  }

  public static createUnsubscribePacket(topic) {
    var cmd = ControlPacketType.Unsubscribe << 4 | 2;
    var pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
    return this.createPacket(cmd,
      pid,
      this.mqttStr(topic));
  }
}
