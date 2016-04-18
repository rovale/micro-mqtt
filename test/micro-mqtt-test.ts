/// <reference path="../node_modules/typemoq/typemoq.node.d.ts" />
/// <reference path="../typings/main.d.ts" />
import { MicroMqttClient, ConnectionOptions,
  Network, NetworkConnectOptions, NetworkSocket } from '../modules/micro-mqtt';

import { should } from 'chai';
should();

interface EmittedEvent {
  event: string;
  args: any[];
}

class MicroMqttClientTestSubclass extends MicroMqttClient {
  public emittedEvents: EmittedEvent[] = [];

  constructor(options: ConnectionOptions, network?: Network) {
    super(options, network)
    this.emit = (event: string, ...args: any[]) => {
      this.emittedEvents.push({ event: event, args: args });
      return true
    };
  }

  public emittedInfo() {
    return this.emittedEvents.filter(e => e.event === 'info');
  }
}

class TestNetwork implements Network {
  public connectIsCalled = false;
  public options: NetworkConnectOptions;
  public callback: (socket: NetworkSocket) => void;

  public connect(options: NetworkConnectOptions, callback: (socket: NetworkSocket) => void) {
    this.connectIsCalled = true;
    this.options = options;
    this.callback = callback;
  };
}

interface EventSubscription {
  event: string;
  listener: Function;
}

class TestNetworkSocket implements NetworkSocket {
  public written: string[] = [];
  public eventSubscriptions: EventSubscription[] = [];

  public write(data: string) {
    this.written.push(data);
  };
  public on(event: string, listener: Function) {
    this.eventSubscriptions.push({ event: event, listener: listener });
  };
  public end: () => void;
}

describe('MicroMqttClient', () => {
  let subject: MicroMqttClientTestSubclass;
  let network: TestNetwork;
  let networkSocket: TestNetworkSocket;

  describe('When connecting to a specific host and port', () => {
    beforeEach(function () {
      network = new TestNetwork();
      network.connectIsCalled.should.be.false;
      subject = new MicroMqttClientTestSubclass({ host: "some-host", port: 1234 }, network);
      subject.connect();
    });

    it('it should emit information about this action', () => {
      let emittedInfo = subject.emittedInfo();
      emittedInfo.should.have.length(1);
      emittedInfo[0].args.should.have.length(1);
      emittedInfo[0].args[0].should.equal(`Connecting MicroMqttClient ${subject.version} to some-host:1234`);
    });

    it('it should try to establish a connection to the expected host and port', () => {
      network.connectIsCalled.should.be.true;
      network.options.host.should.equal('some-host');
      network.options.port.should.equal(1234);
    });
  });

  describe('When connecting without specifying the port', () => {
    beforeEach(function () {
      network = new TestNetwork();
      subject = new MicroMqttClientTestSubclass({ host: "some-host" }, network);
      subject.connect();
    });

    it('it should default to port 1883', () => {
      network.options.port.should.equal(1883);
    });
  });

  describe('When the connection is established', () => {
    beforeEach(function () {
      network = new TestNetwork();
      subject = new MicroMqttClientTestSubclass({ host: "some-host", clientId: "some-client" }, network);
      networkSocket = new TestNetworkSocket();
      subject.connect();
      network.callback(networkSocket);
    });

    it('it should send a connect packet', () => {
      networkSocket.written.should.have.length(1);
      networkSocket.written[0].should.equal('\u0010\u0017\u0000\u0004MQTT\u0004\u0002\u0000<\u0000\u000bsome-client');
      networkSocket.written[0].should.contain('MQTT');
      networkSocket.written[0].should.contain('some-client');
    });
  });

  describe('When connecting with a username and password', () => {
    beforeEach(function () {
      network = new TestNetwork();
      subject = new MicroMqttClientTestSubclass({ host: "host", clientId: "some-client", username: "some-username", password: "some-password" }, network);
      networkSocket = new TestNetworkSocket();
      subject.connect();
      network.callback(networkSocket);
    });

    it('it should include that info in the connect packet', () => {
      console.log(networkSocket.written[0]);    
      networkSocket.written.should.have.length(1);
     
      networkSocket.written[0].should.contain("some-username")
      networkSocket.written[0].should.contain("some-password")
    });
  });
});