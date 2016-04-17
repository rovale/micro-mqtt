/// <reference path="../typings/main.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var micro_mqtt_1 = require('../modules/micro-mqtt');
var MicroMqttClientTestSubclass = (function (_super) {
    __extends(MicroMqttClientTestSubclass, _super);
    function MicroMqttClientTestSubclass(options, network) {
        _super.call(this, options, network);
        this.emit = function (event) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return true;
        };
    }
    return MicroMqttClientTestSubclass;
}(micro_mqtt_1.MicroMqttClient));
describe('MicroMqttClient', function () {
    var subject;
    beforeEach(function () {
        subject = new MicroMqttClientTestSubclass({ host: "host" });
    });
    describe('connect', function () {
        it('should not throw any exception', function () {
            subject.connect();
        });
    });
});
//# sourceMappingURL=micro-mqtt-test.js.map