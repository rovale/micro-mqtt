"use strict";
var ControlPacketBuilder = (function () {
    function ControlPacketBuilder(controlPacketType) {
        this.controlPacketType = controlPacketType;
    }
    ControlPacketBuilder.prototype.withConnectReturnCode = function (connectReturnCode) {
        this.connectReturnCode = connectReturnCode;
        return this;
    };
    ControlPacketBuilder.prototype.build = function () {
        var result = String.fromCharCode(this.controlPacketType << 4);
        result += String.fromCharCode(0);
        result += String.fromCharCode(0);
        result += String.fromCharCode(this.connectReturnCode);
        return result;
    };
    return ControlPacketBuilder;
}());
exports.__esModule = true;
exports["default"] = ControlPacketBuilder;
