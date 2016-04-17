/// <reference path="../typings/main.d.ts" />

import { MicroMqttClient, ConnectionOptions, Network } from '../modules/micro-mqtt';

class MicroMqttClientTestSubclass extends MicroMqttClient {
  constructor(options: ConnectionOptions, network?: Network) {
    super(options, network)
    this.emit = (event: string, ...args: any[]) => { return true };
  }
}

describe('MicroMqttClient', () => {
  var subject: MicroMqttClientTestSubclass;

  beforeEach(function () {
    subject = new MicroMqttClientTestSubclass({ host: "host" });
  });

  describe('connect', () => {
    it('should not throw any exception', () => {
      subject.connect();
    });
  });
});