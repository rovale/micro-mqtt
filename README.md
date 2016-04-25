[![Build Status](https://travis-ci.org/rovale/micro-mqtt.svg?branch=master)](https://travis-ci.org/rovale/micro-mqtt)
[![Coverage Status](https://coveralls.io/repos/github/rovale/micro-mqtt/badge.svg?branch=master)](https://coveralls.io/github/rovale/micro-mqtt?branch=master)
[![dependency Status](https://david-dm.org/rovale/micro-mqtt/status.svg)](https://david-dm.org/rovale/micro-mqtt)
[![devDependency Status](https://david-dm.org/rovale/micro-mqtt/dev-status.svg)](https://david-dm.org/rovale/micro-mqtt#info=devDependencies)
# micro-mqtt

An MQTT client for [Espruino](http://www.espruino.com/).
## TODO list
- [x] Convert to TypeScript and restructure.
- [x] Enable unit testing.
- [x] Enable TSLint with suitable settings.
- [x] Create an [Espruino Web IDE](https://github.com/espruino/EspruinoWebIDE) project.
- [x] Improve assertions on packet content.
- [x] Add assertions on packet content of Publish packet.
- [ ] **Code coverage > 95%.**
- [ ] **Remove code about the DUP flag.**
- [ ] Handle receiving multiple control packets at once.
- [ ] Handle not being able to establish connection to host.
- [ ] Implement Last Will and Testament.
- [ ] Support sending retained Publish packets.
- [ ] Remove cleanSession from options &
- [ ] Remove generated client id.
- [ ] Remove unsubscribe & disconnect.
- [ ] Reconnect on lost connection.
- [ ] Optimize memory usage and size.

## Technial notes
- About the [npm-scripts](https://docs.npmjs.com/misc/scripts)
    - They suffice and they work cross-platform.
    - They are documented with [npm-scripts-info](https://www.npmjs.com/package/npm-scripts-info).

- About code coverage
    - Currently using [Istanbul](https://github.com/gotwarlost/istanbul) reports remapped with [remap-istanbul](https://github.com/SitePen/remap-istanbul) to the TypeScript sources. The [Travis CI](https://travis-ci.org/rovale/micro-mqtt) build sends this report to [Coverall](https://coveralls.io/github/rovale/micro-mqtt).
    - TODO
        - [x] Figure out how to get reports of the actual TypeScript sources.
        - [ ] Figure out how to see the same detailed level of coverage shown by the original Istanbul coverage reports. 
        
- About [TSLint](https://www.npmjs.com/package/tslint)
    - It works perfectly fine in VSCode when the [extension](https://marketplace.visualstudio.com/items?itemName=eg2.tslint) is installed.
    - tslint.json initially taken from https://github.com/Microsoft/tslint-microsoft-contrib/blob/2.0.2/tslint.json
    - TODO
        - [x] File an [issue](https://github.com/Microsoft/tslint-microsoft-contrib/issues/109) for no-document-write, it fails when enabled.
        - [x] Figure out cause of misplaced 'else' warning. (Got it, my C# background bit me :-)
            - [x] Add TSLint to test if this is resolved.

- About debugging the unit tests in [Visual Studio Code](https://code.visualstudio.com/)
    - The .vscode/launch.json is configured correctly for this project.
    - Just put a breakpoint in the TypeScript code and press F5.

Based on the [Espruino MQTT.js module](https://github.com/espruino/EspruinoDocs/blob/master/modules/MQTT.md) by Lars Toft Jacobsen (boxed.dk), Gordon Williams. License: MIT.

