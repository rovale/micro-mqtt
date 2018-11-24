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
        host: "iot.eclipse.org",
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

    let interval1 = -1;
  
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

    const sendTelemery = () => {
      const telemetry = {
        freeMemory: process.memory().free,
        rssi: wifi.getDetails().rssi
      };

      mqttClient.publish(`rovale/micro-mqtt/${id}/telemetry`,
        JSON.stringify(telemetry), 1);
    };
  
    mqttClient.on("connected", () => {
      digitalWrite(led, !ledOn);
      mqttClient.subscribe(`rovale/micro-mqtt/${id}/command`, 1);
      mqttClient.publish(`rovale/micro-mqtt/${id}/status`, "online", 1, true);

      const details = {
        name: "Some thing",
        network: ssid,
        ip: wifi.getIP().ip
      };

      mqttClient.publish(`rovale/micro-mqtt/${id}/details`, JSON.stringify(details), 1, true);

      interval1 = setInterval(() => sendTelemery(), 30 * 1000);
      sendTelemery();
    });
  
    mqttClient.on("disconnected", () => {
      digitalWrite(led, ledOn);

      if (interval1 != -1) {
        clearInterval(interval1);
      }
    });
  
    mqttClient.on("receive", message => {
      print("[Mqtt] [Info] Incoming message:", message);
    });
  
    // mqttClient.on("debug", debug => {
    //   print("[Mqtt] [Debug]", debug);
    // });
  
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