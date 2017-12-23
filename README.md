[![Build Status](https://travis-ci.org/rovale/micro-mqtt.svg?branch=master)](https://travis-ci.org/rovale/micro-mqtt)
[![Coverage Status](https://coveralls.io/repos/github/rovale/micro-mqtt/badge.svg?branch=master)](https://coveralls.io/github/rovale/micro-mqtt?branch=master)
[![dependency Status](https://david-dm.org/rovale/micro-mqtt/status.svg)](https://david-dm.org/rovale/micro-mqtt)
[![devDependency Status](https://david-dm.org/rovale/micro-mqtt/dev-status.svg)](https://david-dm.org/rovale/micro-mqtt#info=devDependencies)
# micro-mqtt

[![Greenkeeper badge](https://badges.greenkeeper.io/rovale/micro-mqtt.svg)](https://greenkeeper.io/)

A lightweight MQTT client which can probably be used for [Espruino](http://www.espruino.com/).

## Technial notes
- The [npm-scripts](https://docs.npmjs.com/misc/scripts) are documented with [npm-scripts-info](https://www.npmjs.com/package/npm-scripts-info).

- Code coverage
    - Currently using [Istanbul](https://github.com/gotwarlost/istanbul) reports remapped with [remap-istanbul](https://github.com/SitePen/remap-istanbul) to the TypeScript sources. The [Travis CI](https://travis-ci.org/rovale/micro-mqtt) build sends this report to [Coverall](https://coveralls.io/github/rovale/micro-mqtt).
        
- [TSLint](https://www.npmjs.com/package/tslint)
    - It works perfectly fine in [Visual Studio Code](https://code.visualstudio.com/) when the [extension](https://marketplace.visualstudio.com/items?itemName=eg2.tslint) is installed.
    - tslint.json initially taken from https://github.com/Microsoft/tslint-microsoft-contrib/blob/2.0.2/tslint.json

- Debugging the unit tests in [Visual Studio Code](https://code.visualstudio.com/)
    - The .vscode/launch.json is configured correctly for this project.
    - Just put a breakpoint in the TypeScript code and press F5.

Based on the [Espruino MQTT.js module](https://github.com/espruino/EspruinoDocs/blob/master/modules/MQTT.md) by Lars Toft Jacobsen (boxed.dk), Gordon Williams. License: MIT.

## TODO list
- [ ] Handle not receiving PingResp packets.
- [ ] Handle receiving long Publish packets.
- [ ] Potentially support MQTT v5.