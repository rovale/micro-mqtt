"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * Test subclasses and mocks.
 */
/// <reference path='_common.ts' />
var micro_mqtt_1 = require('../module/micro-mqtt');
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
    MicroMqttClientTestSubclass.prototype.emittedDebugInfo = function () {
        return this.emittedEvents.filter(function (e) { return e.event === 'debug'; });
    };
    MicroMqttClientTestSubclass.prototype.emittedInfo = function () {
        return this.emittedEvents.filter(function (e) { return e.event === 'info'; });
    };
    MicroMqttClientTestSubclass.prototype.emittedError = function () {
        return this.emittedEvents.filter(function (e) { return e.event === 'error'; });
    };
    MicroMqttClientTestSubclass.prototype.emittedConnected = function () {
        return this.emittedEvents.filter(function (e) { return e.event === 'connected'; });
    };
    MicroMqttClientTestSubclass.prototype.clearEmittedEvents = function () {
        this.emittedEvents = [];
    };
    MicroMqttClientTestSubclass.prototype.shouldNotEmitErrors = function () {
        this.emittedError().should.deep.equal([]);
    };
    return MicroMqttClientTestSubclass;
}(micro_mqtt_1.MicroMqttClient));
exports.MicroMqttClientTestSubclass = MicroMqttClientTestSubclass;
var TestNetwork = (function () {
    function TestNetwork() {
        this.connectIsCalled = false;
    }
    TestNetwork.prototype.connect = function (options, callback) {
        this.connectIsCalled = true;
        this.options = options;
        this.callback = callback;
    };
    ;
    return TestNetwork;
}());
exports.TestNetwork = TestNetwork;
var TestNetworkSocket = (function () {
    function TestNetworkSocket() {
        this.sentPackages = [];
        this.eventSubscriptions = [];
    }
    TestNetworkSocket.prototype.write = function (data) {
        this.sentPackages.push(data);
    };
    ;
    TestNetworkSocket.prototype.receivePackage = function (data) {
        var listeners = this.eventSubscriptions.filter(function (s) { return s.event === 'data'; });
        listeners.should.have.length.greaterThan(0);
        listeners.forEach(function (s) { return s.listener(data); });
    };
    ;
    TestNetworkSocket.prototype.on = function (event, listener) {
        this.eventSubscriptions.push({ event: event, listener: listener });
    };
    ;
    TestNetworkSocket.prototype.clear = function () {
        this.sentPackages = [];
    };
    return TestNetworkSocket;
}());
exports.TestNetworkSocket = TestNetworkSocket;
