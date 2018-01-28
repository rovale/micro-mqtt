[![Build Status](https://travis-ci.org/rovale/micro-mqtt.svg?branch=master)](https://travis-ci.org/rovale/micro-mqtt)
[![Coverage Status](https://coveralls.io/repos/github/rovale/micro-mqtt/badge.svg?branch=master)](https://coveralls.io/github/rovale/micro-mqtt?branch=master)
[![dependency Status](https://david-dm.org/rovale/micro-mqtt/status.svg)](https://david-dm.org/rovale/micro-mqtt)
[![devDependency Status](https://david-dm.org/rovale/micro-mqtt/dev-status.svg)](https://david-dm.org/rovale/micro-mqtt#info=devDependencies)
[![Greenkeeper badge](https://badges.greenkeeper.io/rovale/micro-mqtt.svg)](https://greenkeeper.io/)

# micro-mqtt

A lightweight MQTT client. I keep it to stay up to date with TypeScript. Don't use it for anything serious! :-)

## Technial notes
- The [npm-scripts](https://docs.npmjs.com/misc/scripts) are documented with [npm-scripts-info](https://www.npmjs.com/package/npm-scripts-info).

- The code coverage report is created using [Istanbul](https://github.com/gotwarlost/istanbul) and remapped with [remap-istanbul](https://github.com/SitePen/remap-istanbul) to the TypeScript sources. The [Travis CI](https://travis-ci.org/rovale/micro-mqtt) build sends this report to [Coveralls](https://coveralls.io/github/rovale/micro-mqtt).
        
- [TSLint](https://www.npmjs.com/package/tslint) works in [Visual Studio Code](https://code.visualstudio.com/) when the [extension](https://marketplace.visualstudio.com/items?itemName=eg2.tslint) is installed. The tslint.json initially taken from https://github.com/Microsoft/tslint-microsoft-contrib.

-The unit tests can be debugged in [Visual Studio Code](https://code.visualstudio.com/). The .vscode/launch.json is configured for this project, just put a breakpoint in the TypeScript code and press F5.

Based on the [Espruino MQTT.js module](https://github.com/espruino/EspruinoDocs/blob/master/modules/MQTT.md) by Lars Toft Jacobsen (boxed.dk), Gordon Williams. License: MIT.