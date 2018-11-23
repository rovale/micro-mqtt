/**
 * Example usage of the MqttClient.
 */
function start() {
    const wifi = require("Wifi");
    const net = require("net");
    const MqttClient = require("micro-mqtt").Client;
  
    const ssid = "myssid";
    const wifiPassword = "mypassword";
  
    const id = getSerial().replace("-", "").toUpperCase();
  
    const mqttClient = new MqttClient(
      {
        host: "test.mosquitto.org",
        clientId: id,
        username: null,
        password: null,
        will: {
          topic: `rovale/micro-mqtt/${id}/status`,
          message: "offline",
          qos: 1,
          retain: true
        }
      },
      net
    );
  
    const led = D16;
    const ledOn = false;
  
    const connect = () => {
      const connection = wifi.getDetails();
      if (connection.status === "connected" && connection.ssid === ssid) {
        onWifiConnected();
        return;
      }
  
      onWifiConnecting();
      wifi.connect(ssid, { password: wifiPassword });
    };
  
    const onWifiConnecting = () => {
      print("[Wifi] [Info] Connecting...");
      digitalWrite(led, ledOn);
    };
  
    const onWifiConnected = () => {
      print("[Wifi] [Info] Connected:", wifi.getIP());
      mqttClient.connect();
    };
  
    wifi.on("connected", () => {
      onWifiConnected();
    });
  
    wifi.on("disconnected", d => {
      print("[Wifi] [Error] No connection, details:", d);
      mqttClient.disconnect();
      connect();
    });
  
    mqttClient.on("connected", () => {
      digitalWrite(led, !ledOn);
      mqttClient.subscribe(`rovale/micro-mqtt/${id}/command`, 1);
      mqttClient.publish(`rovale/micro-mqtt/${id}/status`, "online", 1, true);
    });
  
    mqttClient.on("disconnected", () => {
      digitalWrite(led, ledOn);
    });
  
    mqttClient.on("receive", message => {
      print("[Mqtt] [Info] Incoming message:", message);
    });
  
    mqttClient.on("debug", debug => {
      print("[Mqtt] [Debug]", debug);
    });
  
    mqttClient.on("info", info => {
      print("[Mqtt] [Info]", info);
    });
  
    mqttClient.on("error", error => {
      print("[Mqtt] [Error]", error);
    });
  
    connect();
  
    global.mqttClient = mqttClient;
  }
  
  start();