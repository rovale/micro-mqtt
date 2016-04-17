declare let require: (module: string) => any;

/*
A MQTT client for Espruino.

Based on the Espruino MQTT.js module by Lars Toft Jacobsen (boxed.dk), Gordon Williams.
See the file LICENSE for copying permission.
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

interface ConnectionOptions {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  clientId?: string;
  cleanSession?: boolean;
}

interface NetworkConnectOptions {
  host: string;
  port: number;  
}

interface NetworkSocket {
  write : (data: string) => void;
  on: (event: string, listener: Function) => void;
  end: () => void;
}

interface Network {
  connect: (options : NetworkConnectOptions, callback : (socket : NetworkSocket) => void ) => void;
}

export class MicroMqttClient {
  public version = '0.0.6';

  private networkSocket: NetworkSocket;
  private connected = false;

  private emit: (event: string, ...args: any[]) => boolean;

  private connectionTimeOutId: number;
  private pingIntervalId: number;

  constructor(private options: ConnectionOptions, private network : Network = require('net')) {
    options.port = options.port || DefaultPort;
    options.clientId = options.clientId || MicroMqttClient.generateClientId();
    options.cleanSession = options.cleanSession || true;    
  }

  private static generateClientId = () => {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + s4();
  }

  private static getConnectionError(returnCode: number) {
    let error = 'Connection refused, ';
    switch (returnCode) {
      case ConnectReturnCode.UnacceptableProtocolVersion:
        error += 'unacceptable protocol version.';
        break;
      case ConnectReturnCode.IdentifierRejected:
        error += 'identifier rejected.';
        break;
      case ConnectReturnCode.ServerUnavailable:
        error += 'server unavailable.';
        break;
      case ConnectReturnCode.BadUserNameOrPassword:
        error += 'bad user name or password.';
        break;
      case ConnectReturnCode.NotAuthorized:
        error += 'not authorized.';
        break;
      default:
        error += 'unknown return code: ' + returnCode + '.';
    }
    return error;
  }

  public connect = () => {
    this.emit('info', `Connecting MicroMqttClient ${this.version} to ${this.options.host}:${this.options.port}`);    
    this.network.connect({ host: this.options.host, port: this.options.port }, (socket) => this.onNetworkConnected(socket))
    // TODO: Reconnect on timeout
  };

  private onNetworkConnected = (socket : NetworkSocket) => {
    this.emit('info', 'Network connection established');
    this.networkSocket = socket;

    this.networkSocket.write(MqttProtocol.createConnectPacket(this.options));
    // Disconnect if no CONNACK is received
    this.connectionTimeOutId = setTimeout(() => {
      this.disconnect();
    }, ConnectionTimeout * 1000);

    this.networkSocket.on('data', (data) => this.onNetworkData(data));
    this.networkSocket.on('end', this.onNetworkEnd);
  };

  // Incoming data
  private onNetworkData = (data) => {
    let type: ControlPacketType = data.charCodeAt(0) >> 4;

    this.emit('debug', `Rcvd: ${type}: "${data}"`);

    switch (type) {
      case ControlPacketType.Publish:
        let parsedData = MqttProtocol.parsePublish(data);
        this.emit('publish', parsedData);
        break;
      case ControlPacketType.PubAck:
      case ControlPacketType.SubAck:
      case ControlPacketType.UnsubAck:
      case ControlPacketType.PingResp:
        break;
      case ControlPacketType.PingReq:
        this.networkSocket.write(ControlPacketType.PingResp + '\x00'); // reply to PINGREQ
        break
      case ControlPacketType.ConnAck:
        clearTimeout(this.connectionTimeOutId);
        let returnCode = data.charCodeAt(3);
        if (returnCode === ConnectReturnCode.Accepted) {
          this.connected = true;
          this.emit('info', 'MQTT connection accepted');
          this.emit('connected');

          // Set up regular keep alive ping
          this.pingIntervalId = setInterval(() => {
            this.ping();
          }, PingInterval * 1000);
        }
        else {
          let connectionError = MicroMqttClient.getConnectionError(returnCode);
          this.emit('error', connectionError);
        }
        break;
      default:
        this.emit('error', 'MQTT unsupported packet type: ' + type);
        this.emit('error', '[MQTT]' + data.split('').map((c) => { return c.charCodeAt(0); }));
        break;
    }
  }

  private onNetworkEnd = () => {
    this.emit('info', 'MQTT client disconnected');
    clearInterval(this.pingIntervalId);
    this.networkSocket = undefined;
    this.emit('disconnected');
    this.emit('close');
  }

  /** Disconnect from server */
  public disconnect = () => {
    this.networkSocket.write(String.fromCharCode(ControlPacketType.Disconnect << 4) + '\x00');
    this.networkSocket.end();
    this.connected = false;
  };

  /** Publish message using specified topic */
  public publish = (topic, message, qos = DefaultQosLevel) => {
    this.networkSocket.write(MqttProtocol.createPublishPacket(topic, message, qos));
  };

  /** Subscribe to topic (filter) */
  public subscribe = (topic: string, qos = DefaultQosLevel) => {
    this.networkSocket.write(MqttProtocol.createSubscribePacket(topic, qos));
  };

  /** Unsubscribe to topic (filter) */
  public unsubscribe = (topic) => {
    this.networkSocket.write(MqttProtocol.createUnsubscribePacket(topic));
  };

  /** Send ping request to server */
  private ping = () => {
    this.networkSocket.write(String.fromCharCode(ControlPacketType.PingReq << 4) + '\x00');
    this.emit('debug', 'Sent: Ping request')
  };
}

class MqttProtocol {
  private static escapeHex(number) {
    return String.fromCharCode(parseInt(number.toString(16), 16));
  }

  /** MQTT string (length MSB, LSB + data) */
  private static mqttStr(s) {
    return String.fromCharCode(s.length >> 8, s.length & 255) + s;
  };

  /** MQTT packet length formatter - algorithm from reference docs */
  private static mqttPacketLength(length) {
    let encLength = '';
    do {
      let encByte = length & 127;
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
    return this.escapeHex(flags);
  };

  public static createConnectPacket(options: ConnectionOptions) {
    let cmd = ControlPacketType.Connect << 4;
    let protocolName = this.mqttStr('MQTT');
    let protocolLevel = this.escapeHex(4);

    let flags = this.createConnectionFlags(options);

    let keepAlive = String.fromCharCode(KeepAlive >> 8, KeepAlive & 255);

    let payload = this.mqttStr(options.clientId);
    if (options.username) {
      payload += this.mqttStr(options.username);
      if (options.password) {
        payload += this.mqttStr(options.password);
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
    let variable = (qos === 0) ? this.mqttStr(topic) : this.mqttStr(topic) + pid;
    return this.createPacket(cmd, variable, message);
  }

  public static createSubscribePacket(topic, qos) {
    let cmd = ControlPacketType.Subscribe << 4 | 2;
    let pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
    return this.createPacket(cmd,
      pid,
      this.mqttStr(topic) +
      String.fromCharCode(qos));
  }

  public static createUnsubscribePacket(topic) {
    let cmd = ControlPacketType.Unsubscribe << 4 | 2;
    let pid = String.fromCharCode(FixedPackedId << 8, FixedPackedId & 255);
    return this.createPacket(cmd,
      pid,
      this.mqttStr(topic));
  }
}