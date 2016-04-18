"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/// <reference path="../typings/main.d.ts" />
var chai_1 = require('chai');
var micro_mqtt_1 = require('../modules/micro-mqtt');
chai_1.should();
var MicroMqttClientTestSubclass = (function (_super) {
    __extends(MicroMqttClientTestSubclass, _super);
    function MicroMqttClientTestSubclass(options, network) {
        var _this = this;
        _super.call(this, options, network);
        this.emittedEvents = [];
        this.emit = function (event) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            _this.emittedEvents.push({ event: event, args: args });
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
    describe('When connecting', function () {
        it('it should emit some information', function () {
            subject.connect();
            subject.emittedEvents.should.have.length(1);
            subject.emittedEvents[0].event.should.equal('info');
            subject.emittedEvents[0].args.should.have.length(1);
            subject.emittedEvents[0].args[0].should.equal("Connecting MicroMqttClient " + subject.version + " to host:1883");
        });
    });
});
//# sourceMappingURL=micro-mqtt-test.js.map