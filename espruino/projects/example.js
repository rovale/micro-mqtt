/**
 * Example usage of the MqttClient.
 */
function start() {
  const wifi = require('Wifi');
  const net = require('net');
  const MqttClient = require('micro-mqtt').Client;

  const settings = require('common').settings;

  const id = getSerial().replace('-', '').toUpperCase();

  const getTopic = subject => `${settings.topic}${id}/${subject}`;

  const mqttClient = new MqttClient(
    {
      host: settings.mqttHost,
      clientId: id,
      username: settings.mqttUsername,
      password: settings.mqttPassword,
      will: {
        topic: getTopic('status'),
        message: 'offline',
        qos: 1,
        retain: true
      }
    },
    net
  );

  const led = D16;
  const ledOnValue = false;

  let telemetryInterval = -1;
  let blinkInterval = -1;

  const onWifiConnecting = () => {
    print('[Wifi] [Info] Connecting...');
    digitalWrite(led, ledOnValue);
  };

  const onWifiConnected = () => {
    print('[Wifi] [Info] Connected:', wifi.getIP());
    mqttClient.connect();
  };

  const connect = () => {
    const connection = wifi.getDetails();
    if (connection.status === 'connected' && connection.ssid === settings.ssid) {
      onWifiConnected();
      return;
    }

    onWifiConnecting();
    wifi.connect(settings.ssid, { password: settings.wifiPassword });
  };

  wifi.on('connected', () => {
    onWifiConnected();
  });

  wifi.on('disconnected', (d) => {
    print('[Wifi] [Error] No connection, details:', d);
    mqttClient.disconnect();
    connect();
  });

  const sendTelemery = () => {
    const telemetry = {
      freeMemory: process.memory().free,
      rssi: wifi.getDetails().rssi
    };

    mqttClient.publish(getTopic('telemetry'), JSON.stringify(telemetry), 1);
  };

  const blinkOn = () => {
    if (blinkInterval === -1) {
      blinkInterval = setInterval(() => digitalWrite(led, !digitalRead(led)), 500);
    }
  };

  const blinkOff = () => {
    if (blinkInterval !== -1) {
      clearInterval(blinkInterval);
      digitalWrite(led, !ledOnValue);
      blinkInterval = -1;
    }
  };

  mqttClient.on('connected', () => {
    digitalWrite(led, !ledOnValue);
    mqttClient.subscribe(getTopic('command'), 1);
    mqttClient.publish(getTopic('status'), 'online', 1, true);

    const details = {
      name: 'Some thing',
      network: settings.ssid,
      ip: wifi.getIP().ip
    };

    mqttClient.publish(
      getTopic('details'),
      JSON.stringify(details),
      1,
      true
    );

    telemetryInterval = setInterval(() => sendTelemery(), 30 * 1000);
    sendTelemery();
  });

  mqttClient.on('disconnected', () => {
    digitalWrite(led, ledOnValue);

    if (telemetryInterval !== -1) {
      clearInterval(telemetryInterval);
    }
  });

  mqttClient.on('receive', (message) => {
    print('[Mqtt] [Info] Incoming message:', message);
    const command = JSON.parse(message.content);

    if (command.name === 'blinkOn') blinkOn();
    if (command.name === 'blinkOff') blinkOff();
  });

  // mqttClient.on("debug", debug => {
  //   print("[Mqtt] [Debug]", debug);
  // });

  mqttClient.on('info', (info) => {
    print('[Mqtt] [Info]', info);
  });

  mqttClient.on('error', (error) => {
    print('[Mqtt] [Error]', error);
  });

  connect();

  global.wifi = wifi;
  global.mqttClient = mqttClient;
}

start();
