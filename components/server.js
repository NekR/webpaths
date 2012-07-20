const http = require('http'),
  EventEmitter = require('events').EventEmitter,
  web = require('../'),

  DEFAULT_CONFIG = {
    port: 80,
    host: 'localhost'
  };

var WebServer = module.exports = function WebServer(config) {
  const self = this,
    httpServer = this.httpServer =  new http.Server;

  httpServer.httpAllowHalfOpen = true;

  EventEmitter.call(this);

  this.config = {};
  // should be removed and used only internally to providing hacks
  this._server = httpServer;

  Object.keys(DEFAULT_CONFIG).forEach(function(key) {
    self.config[key] = config[key] || DEFAULT_CONFIG[key];
  });

  config = this.config;

  this.hosts = [];

  this.on('error', function(err) {
    console.error('server error ', err);
  });

  httpServer.on('request', function(req, res) {
    var path = new web.Path(req, res, {}),
      data = [],
      reqHost = (req.headers.host || '').split(':'),
      virtualHost,
      contentType = req.headers['content-type'];

    contentType = contentType ? contentType.split(/;(\s+)?/) : [];

    if(!self.hosts.some(function(host) {

      if (host.checkDomain(reqHost[0]) && (self.config.port + '') === reqHost[1]) {
        virtualHost = host;
        return true;
      }

      return false;

    })) {
      path.close(404);
      return;
    }

    path.hostname = reqHost[0];
    path.port = reqHost[1];


    req.on('data', function(chunk) {
      data.push(chunk);
    });

    req.on('end', function() {
      var mime;

      if ((mime = WebServer.mimeTypes[contentType[0]]) && mime.decode) {
        path.body = mime.decode(data.join(''));
      } else {
        path.body = data.join('');
      };

      virtualHost.emit('path', path);

    });

  });

  process.nextTick(function() {
    self.start();
  });

};

WebServer.mimeTypes = {
  'application/json': {
    encode: function(data) {
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