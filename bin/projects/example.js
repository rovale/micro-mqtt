var MicroMqttClient = require("micro-mqtt").MicroMqttClient;

var mqttClient = new MicroMqttClient({ host: "192.168.2.4", username: "username", password: "password" });

mqttClient.on('connected', function () {
    mqttClient.subscribe("rovale/#");
});

/*
mqttClient.on('publish', function (pub) {
  console.log("on publish");
  console.log(pub);
});
*/

mqttClient.on('debug', function (debug) {
    console.log("[debug] " + debug);
});

mqttClient.on('info', function (info) {
    console.log("[info] " + info);
});

mqttClient.on('error', function (error) {
    console.log("[error] " + error);
});