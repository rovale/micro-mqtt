[![Build Status](https://travis-ci.org/rovale/micro-mqtt.svg?branch=master)](https://travis-ci.org/rovale/micro-mqtt)
[![Coverage Status](https://coveralls.io/repos/github/rovale/micro-mqtt/badge.svg?branch=master)](https://coveralls.io/github/rovale/micro-mqtt?branch=master)
[![dependency Status](https://david-dm.org/rovale/micro-mqtt/status.svg)](https://david-dm.org/rovale/micro-mqtt)
[![devDependency Status](https://david-dm.org/rovale/micro-mqtt/dev-status.svg)](https://david-dm.org/rovale/micro-mqtt#info=devDependencies)
# micro-mqtt

A MQTT client for Espruino.

## TODO list
- [x] Convert to TypeScript and restructure
- [x] Enable unit testing
- [ ] **Code coverage > 80%**
- [ ] **Improve assertions on packet content**
- [ ] Handle receiving multiple control packets at once
- [ ] Handle not being able to establish connection to host
- [ ] Implement Last Will and Testament
- [ ] Reconnect on lost connection
- [ ] Optimize memory usage and size

Based on the Espruino MQTT.js module by Lars Toft Jacobsen (boxed.dk), Gordon Williams. License: MIT.
