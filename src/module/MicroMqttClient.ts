/// <reference path="_common"/>
import ConnectionOptions from "./ConnectionOptions";
import ControlPacketType from "./ControlPacketType";
import MqttProtocol from "./MqttProtocol";

const PingInterval = 40;
const ConnectionTimeout = 5;
const DefaultPort = 1883;
const DefaultQosLevel = 0;

// Connect Return code
// http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc385349256
const enum ConnectReturnCode {
  Accepted = 0,
  UnacceptableProtocolVersion = 1,
  IdentifierRejected = 2,
  ServerUnavailable = 3,
  BadUserNameOrPassword = 4,
  NotAuthorized = 5
}

export interface NetworkConnectOptions {
  host: string;
  port: number;
}

export interface NetworkSocket {
  write: (data: string) => void;
  on: (event: string, listener: Function) => void;
  end: () => void;
}

export interface Network {
  connect: (options: NetworkConnectOptions, callback: (socket: NetworkSocket) => void) => void;
}

export class MicroMqttClient {
  public version = "0.0.6";

  private networkSocket: NetworkSocket;
  private connected = false;

  protected emit: (event: string, ...args: any[]) => boolean;

  private connectionTimeOutId: number;
  private pingIntervalId: number;

  constructor(private options: ConnectionOptions, private network: Network = require("net")) {
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
  };

  private static getConnectionError(returnCode: number) {
    let error = "Connection refused, ";
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

  public connect = () => {
    this.emit("info", `Connecting MicroMqttClient ${this.version} to ${this.options.host}:${this.options.port}`);
    this.network.connect({ host: this.options.host, port: this.options.port }, (socket) => this.onNetworkConnected(socket));
    // TODO: Reconnect on timeout
  };

  private onNetworkConnected = (socket: NetworkSocket) => {
    this.emit("info", "Network connection established");
    this.networkSocket = socket;

    this.networkSocket.write(MqttProtocol.createConnectPacket(this.options));
    // Disconnect if no CONNACK is received
    this.connectionTimeOutId = setTimeout(() => {
      this.disconnect();
    }, ConnectionTimeout * 1000);

    this.networkSocket.on("data", (data) => this.onNetworkData(data));
    this.networkSocket.on("end", this.onNetworkEnd);
  };

  // Incoming data
  private onNetworkData = (data) => {
    let type: ControlPacketType = data.charCodeAt(0) >> 4;

    this.emit("debug", `Rcvd: ${type}: "${data}"`);

    switch (type) {
      case ControlPacketType.Publish:
        let parsedData = MqttProtocol.parsePublish(data);
        this.emit("publish", parsedData);
        break;
      case ControlPacketType.PubAck:
      case ControlPacketType.SubAck:
      case ControlPacketType.UnsubAck:
      case ControlPacketType.PingResp:
        break;
      case ControlPacketType.PingReq:
        this.networkSocket.write(ControlPacketType.PingResp + "\x00"); // reply to PINGREQ
        break;
      case ControlPacketType.ConnAck:
        clearTimeout(this.connectionTimeOutId);
        let returnCode = data.charCodeAt(3);
        if (returnCode === ConnectReturnCode.Accepted) {
          this.connected = true;
          this.emit("info", "MQTT connection accepted");
          this.emit("connected");

          // Set up regular keep alive ping
          this.pingIntervalId = setInterval(() => {
            this.ping();
          }, PingInterval * 1000);
        }
        else {
          let connectionError = MicroMqttClient.getConnectionError(returnCode);
          this.emit("error", connectionError);
        }
        break;
      default:
        this.emit("error", "MQTT unsupported packet type: " + type);
        this.emit("error", "[MQTT]" + data.split("").map((c) => { return c.charCodeAt(0); }));
        break;
    }
  };

  private onNetworkEnd = () => {
    this.emit("info", "MQTT client disconnected");
    clearInterval(this.pingIntervalId);
    this.networkSocket = undefined;
    this.emit("disconnected");
    this.emit("close");
  };

  /** Disconnect from server */
  public disconnect = () => {
    this.networkSocket.write(String.fromCharCode(ControlPacketType.Disconnect << 4) + "\x00");
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
    this.networkSocket.write(String.fromCharCode(ControlPacketType.PingReq << 4) + "\x00");
    this.emit("debug", "Sent: Ping request");
  };
}
