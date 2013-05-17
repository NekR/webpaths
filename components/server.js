"use strict";

var http = require('http'),
  paths = require('path'),
  EventEmitter = require('events').EventEmitter,
  web = require('../'),
  count = 0;

var DEFAULT_CONFIG = {
    port: 80,
    host: 'localhost'
  },
  R_SPLIT_HEADER = /;(\s+)?/;

var requestHandler = function(req, res) {
  var path = new web.Path(req, res, {}),
    self = this._webServer,
    fsLoader = self.fsLoader,
    data = [],
    reqHost = (req.headers.host || '').split(':'),
    virtualHost,
    contentType = req.headers['content-type'],
    port = self.config.port + '';

  contentType = contentType ? contentType.split(R_SPLIT_HEADER) : [];

  if (!self.hosts.some(function(host) {
    if (host.checkDomain(reqHost[0]) && port === reqHost[1]) {
      virtualHost = host;
      return true;
    }
    return false;
  })) {
    path.close();
    return;
  }

  path.hostname = reqHost[0];
  path.port = reqHost[1];

  req.on('data', function(chunk) {
    data.push(chunk);
  });

  req.on('end', function() {
    var mime = WebServer.mimeTypes[contentType[0]];

    if (mime && mime.decode) {
      path.body = mime.decode(data.join(''));
    } else {
      path.body = data.join('');
    }

    virtualHost.emit('path', path);
  });
};

var WebServer = module.exports = function WebServer(config) {
  var self = this,
    httpServer = this.httpServer = new http.Server;

  httpServer.allowHalfOpen = !(config.allowHalfOpen === false);

  EventEmitter.call(this);

  this.config = {};
  // should be removed and used only internally to providing hacks
  this._server = httpServer;

  Object.keys(DEFAULT_CONFIG).forEach(function(key) {
    this.config[key] = config[key] || DEFAULT_CONFIG[key];
  }, this);

  config = this.config;
  this.hosts = [];

  this.on('error', function(err) {
    console.error('server error ', err);
  });

  httpServer._webServer = this;
  httpServer.on('request', requestHandler);

  process.nextTick(function() {
    self.start();
  });

};

WebServer.mimeTypes = {
  'application/json': {
    encode: function(text) {
      try {
        return JSON.stringify(text);
      } catch (e) {
        return '';
      }
    },
    decode: function(text) {
      try {
        return JSON.parse(text)
      } catch(e) {
        return null;
      }
    }
  },
  'application/x-urlencoded': {
    encode: function() {

    },
    decode: function() {

    }
  }
};

WebServer.prototype = {
  start: function() {
    this.httpServer.listen(this.config.port, this.config.host);
  },
  addHost: function addVirtualHost(config, callback) {
    var host = new web.VirtualHost(config, this);

    this.hosts.push(host);

    if (callback) {
      host.path('*', callback);
    }

    return host;

  }
};

Object.defineProperties(WebServer.prototype, {
  'connections': {
    get: function() {
      return this._server.connections;
    }
  }
});

WebServer.prototype.__proto__ = EventEmitter.prototype;