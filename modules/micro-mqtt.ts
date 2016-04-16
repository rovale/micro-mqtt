declare var require: (module: string) => any;

/* Copyright (c) 2014 Lars Toft Jacobsen (boxed.dk), Gordon Williams. See the file LICENSE for copying permission. */
/*
Simple MQTT protocol wrapper for Espruino sockets.
*/

/** 'private' constants */
var C = {
  PACKET_ID: 1 // Bad...fixed packet id
};

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
  public version = "0.0.4";
  private port: number;
  private clientId: string;
  private keepAlive: number;
  private cleanSession: Boolean;
  private username: string;
  private password: string;
  private net: any;
  private connected = false;
  private pingInterval: number;
  private protocolName: string;
  private protocolLevel: string;

  private emit: (event: string, ...args: any[]) => boolean;

  private C = {
    DEF_QOS: 0,    // Default QOS level
    DEF_PORT: 1883, // MQTT default server port
    DEF_KEEP_ALIVE: 60,   // Default keep_alive (s)
    CONNECT_TIMEOUT: 5000, // Time (s) to wait for CONNACK 
    PING_INTERVAL: 40,    // Server ping interval (s)
    PROTOCOL_LEVEL: 4  // MQTT protocol level    
  };

  constructor(private server: string, options) {
    console.log("MicroMqttClient " + this.version);

    this.server = server;
    var options = options || {};
    this.port = options.port || this.C.DEF_PORT;
    this.clientId = options.clientId || mqttUid();
    this.keepAlive = options.keepAlive || this.C.DEF_KEEP_ALIVE;
    this.cleanSession = options.cleanSession || true;
    this.username = options.username;
    this.password = options.password;
    this.pingInterval =
      this.keepAlive < this.C.PING_INTERVAL ? (this.keepAlive - 5) : this.C.PING_INTERVAL;
    this.protocolName = options.protocolName || "MQTT";
    this.protocolLevel = createEscapedHex(options.protocolLevel || this.C.PROTOCOL_LEVEL);
  }

  /** Establish connection and set up keep alive ping */
  public connect = (net?) => {
    let connectionTimeOutId: number;
    let pingIntervalId: number;

    let onNetConnected = () => {
      console.log('Client connected');
      net.write(this.mqttConnect(this.clientId));

      // Disconnect if no CONNACK is received
      connectionTimeOutId = setTimeout(() => {
        this.disconnect();
      }, this.C.CONNECT_TIMEOUT);

      // Set up regular keep_alive ping
      pingIntervalId = setInterval(() => {
        // console.log("Pinging MQTT server");
        this.ping();
      }, this.pingInterval * 1000);

      // Incoming data
      net.on('data', (data) => {
        let type: ControlPacketType = data.charCodeAt(0) >> 4;
        
        if (type === ControlPacketType.Publish) {
          var parsedData = parsePublish(data);
          this.emit('publish', parsedData);
          this.emit('message', parsedData.topic, parsedData.message);
        }
        else if (type === ControlPacketType.PubAck) {
          // implement puback
        }
        else if (type === ControlPacketType.SubAck) {
          // implement suback
        }
        else if (type === ControlPacketType.UnsubAck) {
          // implement unsuback
        }
        else if (type === ControlPacketType.PingReq) {
          // silently reply to pings
          net.write(ControlPacketType.PingResp + "\x00"); // reply to PINGREQ
        }
        else if (type === ControlPacketType.PingResp) {
          this.emit('ping_reply');
        }
        else if (type === ControlPacketType.ConnAck) {
          clearTimeout(connectionTimeOutId);
          var returnCode = data.charCodeAt(3);
          if (returnCode === ConnectReturnCode.Accepted) {
            this.connected = true;
            console.log("MQTT connection accepted");
            this.emit('connected');
          }
          else {
            var mqttError = "Connection refused, ";
            switch (returnCode) {
              case ConnectReturnCode.UnacceptableProtocolVersion:
                mqttError += "unacceptable protocol version.";
                break;
              case ConnectReturnCode.IdentifierRejected:
                mqttError += "identifier rejected.";
                break;
              case ConnectReturnCode.ServerUnavailable:
                mqttError += "server unavailable.";
                break;
              case ConnectReturnCode.BadUserNameOrPassword:
                mqttError += "bad user name or password.";
                break;
              case ConnectReturnCode.NotAuthorized:
                mqttError += "not authorized.";
                break;
              default:
                mqttError += "unknown return code: " + returnCode + ".";
            }
            console.log(mqttError);
            this.emit('error', mqttError);
          }
        }
        else {
          console.log("MQTT unsupported packet type: " + type);
          console.log("[MQTT]" + data.split("").map((c) => { return c.charCodeAt(0); }));
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
    this.net.write(fromCharCode(ControlPacketType.Disconnect << 4) + "\x00");
    this.net.end();
    this.net = false;
    this.connected = false;
  };

  /** Publish message using specified topic */
  public publish = (topic, message, qos = this.C.DEF_QOS) => {
    this.net.write(mqttPublish(topic, message, qos));
  };

  /** Subscribe to topic (filter) */
  public subscribe = (topic: string, qos = this.C.DEF_QOS) => {
    this.net.write(mqttSubscribe(topic, qos));
  };

  /** Unsubscribe to topic (filter) */
  public unsubscribe = (topic) => {
    this.net.write(mqttUnsubscribe(topic));
  };

  /** Send ping request to server */
  private ping = () => {
    this.net.write(fromCharCode(ControlPacketType.PingReq << 4) + "\x00");
  };

  /* Packet specific functions *******************/

  /** Create connection flags 
  
  */
  private createFlagsForConnection = (options) => {
    var flags = 0;
    flags |= (this.username) ? 0x80 : 0;
    flags |= (this.username && this.password) ? 0x40 : 0;
    flags |= (options.clean_session) ? 0x02 : 0;
    return createEscapedHex(flags);
  };

  /** CONNECT control packet 
      Clean Session and Userid/Password are currently only supported
      connect flag. Wills are not
      currently supported.
  */
  private mqttConnect = (clean) => {
    var cmd = ControlPacketType.Connect << 4;
    var flags = this.createFlagsForConnection({
      clean_session: clean
    });

    var keep_alive = fromCharCode(this.keepAlive >> 8, this.keepAlive & 255);

    /* payload */
    var payload = mqttStr(this.clientId);
    if (this.username) {
      payload += mqttStr(this.username);
      if (this.password) {
        payload += mqttStr(this.password);
      }
    }

    return mqttPacket(cmd,
      mqttStr(this.protocolName)/*protocol name*/ +
      this.protocolLevel /*protocol level*/ +
      flags +
      keep_alive,
      payload);
  };
}

/* Utility functions ***************************/

var fromCharCode = String.fromCharCode;

/** MQTT string (length MSB, LSB + data) */
function mqttStr(s) {
  return fromCharCode(s.length >> 8, s.length & 255) + s;
};

/** MQTT packet length formatter - algorithm from reference docs */
function mqttPacketLength(length) {
  var encLength = '';
  do {
    var encByte = length & 127;
    length = length >> 7;
    // if there are more data to encode, set the top bit of this byte
    if (length > 0) {
      encByte += 128;
    }
    encLength += fromCharCode(encByte);
  } while (length > 0)
  return encLength;
}

/** MQTT standard packet formatter */
function mqttPacket(cmd, variable, payload) {
  return fromCharCode(cmd) + mqttPacketLength(variable.length + payload.length) + variable + payload;
}

/** PUBLISH packet parser - returns object with topic and message */
function parsePublish(data) {
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

/** Generate random UID */
var mqttUid = (() => {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return () => {
    return s4() + s4() + s4();
  };
})();

/** PUBLISH control packet */
function mqttPublish(topic, message, qos) {
  var cmd = ControlPacketType.Publish << 4 | (qos << 1);
  var pid = fromCharCode(C.PACKET_ID << 8, C.PACKET_ID & 255);
  // Packet id must be included for QOS > 0
  var variable = (qos === 0) ? mqttStr(topic) : mqttStr(topic) + pid;
  return mqttPacket(cmd, variable, message);
}

/** SUBSCRIBE control packet */
function mqttSubscribe(topic, qos) {
  var cmd = ControlPacketType.Subscribe << 4 | 2;
  var pid = fromCharCode(C.PACKET_ID << 8, C.PACKET_ID & 255);
  return mqttPacket(cmd,
    pid/*Packet id*/,
    mqttStr(topic) +
    fromCharCode(qos)/*QOS*/);
}

/** UNSUBSCRIBE control packet */
function mqttUnsubscribe(topic) {
  var cmd = ControlPacketType.Unsubscribe << 4 | 2;
  var pid = fromCharCode(C.PACKET_ID << 8, C.PACKET_ID & 255);
  return mqttPacket(cmd,
    pid/*Packet id*/,
    mqttStr(topic));
}

/** Create escaped hex value from number */
function createEscapedHex(number) {
  return fromCharCode(parseInt(number.toString(16), 16));
}
