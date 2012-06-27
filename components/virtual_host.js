const EventEmitter = require('events').EventEmitter,
  pathmod = require('path');

  DEFAULT_CONFIG = {
    domain: 'localhost',
    encoding: 'text/plain'
  };

var VirtualHost = module.exports = function VirtualHost(config, server) {
  var self = this;

  EventEmitter.call(this);

  this.server = server;

  this.config = {};

  Object.keys(DEFAULT_CONFIG).forEach(function(key) {
    self.config[key] = config[key] || DEFAULT_CONFIG[key];
  });

  config = this.config;

  if (config.domain.length > 2
    && config.domain[0] === '/'
    && config.domain[config.domain.length - 1] === '/') {

    this.checkDomain = new Function('input', 'return ' + config.domain + '.test(input);');

  } else {

    this.checkDomain = function(input) {
      return input === config.domain;
    };

  }

  this.on('path', function(path) {

    var paths = [],
      cursor = 0,
      execPath = function() {
        if (cursor >= paths.length) {
          path.close();
          return;
        }

        if (!path.closed) {
          var listeners = self.paths[paths[cursor]];

          if (Array.isArray(listeners) && listeners.length) {
            listeners.forEach(function(listener) {
              listener.call(self, path);
            });
          }

          cursor++;

          if (!path.blocked) {
            execPath();
          } else if (!path.closed) {

            var clean = function() {
                path.removeListener('allow', allowAgain);
                path.removeListener('close', clean);
              },
              allowAgain = function() {
                clean();
                execPath();
              };

            path.on('allow', allowAgain);

            path.on('close', clean);

          }

        }

      };

    Object.keys(self.paths).forEach(function(pathname) {
      var pathReg = new RegExp(pathname);

      if (pathReg.test(path.url.pathname)) {

        paths.push(pathname);

      }

    });

    paths.sort(function(first, second) {
      first = first.split('/');
      second = second.split('/');


      return first < second ? -1 : first > second ? 1 : 0;
    });

    execPath();


  }.bind(this));

};

VirtualHost.prototype.__proto__ = EventEmitter.prototype;

Object.defineProperties(VirtualHost.prototype, {
  path: {
    value: function listenWebPath(pathname, callback) {
      this.paths || (this.paths = {});

      pathname = '^' + pathmod.normalize(pathname).replace(/\*/g, '(.*)') + '$';

      var paths = this.paths[pathname] || (this.paths[pathname] = []);

      paths.push(callback);

      return this;

    }
  }
});