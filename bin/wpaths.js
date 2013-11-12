#!/usr/bin/env node

var paths = require('path'),
  modDir = __dirname + paths.sep + '..';

var wpaths = require(modDir),
  args = process.argv.slice(1);

var hasOwn = {}.hasOwnProperty,
  short2full = {
    c: 'config',
    h: 'host',
    p: 'port',
    r: 'root',
    d: 'domain'
  },
  handleArgs = {
    root: function(arg, next, i) {
      var root = arg.val,
        domain;

      if (next && next.key === 'domain') {
        domain = next.val;
        i++;
      }

      config.domains.push({
        root: root,
        domain: domain
      });

      return i;
    },
    host: function(arg, next, i) {
      config.host = arg.val;

      return i;
    },
    port: function(arg, next, i) {
      config.port = arg.val;

      return i;
    }
  },
  config = {
    domains: [],
    host: 'localhost',
    port: 8080
  };

// -c config
// -h host
// -p port 
// -r root [next domain, repeat this]
// -d domain 

args = (function(args) {
  var arg,
    argVal,
    i = 0,
    len = args.length,
    result = [];

  for (; i < len; i++) {
    arg = args[i];

    if (arg && arg.slice(0, 2) === '--') {
      arg = arg.slice(2).split('=');
      result.push(arg);
      continue;
    } else if (arg && arg[0] === '-') {
      arg = arg.slice(1);
      argVal = args[i + 1];

      if (argVal[0] === '-') {
        argVal = '';
        continue;
      } else {
        i++;
      }

      if (hasOwn.call(short2full, arg)) {
        arg = short2full[arg];
        result.push([arg, argVal]);
        continue;
      }
    }
  }

  return result;
}(args));

(function() {
  var i = 0,
    len = args.length,
    current,
    next,
    key,
    val;

  for (; i < len; i++) {
    current = next || args[i];
    next = args[i + 1];

    key = current[0];
    val = current[1];

    if (hasOwn.call(handleArgs, key)) {
      i = handleArgs[key]({
        key: key,
        val: val
      }, next ? {
        key: next[0],
        val: next[1]
      } : null, i);
    }
  }
}());

if (config.domains.length) {
  var server = new wpaths.Server({
    port: config.port,
    host: config.host
  });

  config.domains.forEach(function(domain) {
    server.addHost(domain);
  });
}