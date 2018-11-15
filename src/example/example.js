/**
 * Example usage of the MqttClient.
 */
function onInit() {
    var Client = require('micro-mqtt').Client;

    var client = new Client({
        host: '192.168.2.4',
        clientId: 'espruino',
        username: 'username', password: 'password',
        will: {
            topic: 'rovale/espruino/status',
            message: 'offline',
            qos: 1,
            retain: true
        },
    }, require('net'), require('Wifi'));

    client.on('connected', () => {
        client.subscribe('rovale/#', 1);
        client.publish('rovale/espruino/status', 'online', 1, true);
    });

    client.on('receive', (message) => {
        console.log('on receive');
        console.log(message);
    });

    client.on('debug', (debug) => {
        console.log('[debug] ' + debug);
    });

    client.on('info', (info) => {
        console.log('[info] ' + info);
    });

    client.on('error', (error) => {
        console.log('[error] ' + error);
    });

    client.connect();

    global.client = client;

    eval('delete onInit');
}