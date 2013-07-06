#!/usr/bin/env node

var wpaths = require('.'),
  args = process.argv.slice(1),
  argsMap = {};

var hasOwn = {}.hasOwnProperty,
  short2full = {
    c: 'config',
    h: 'host',
    p: 'port',
    r: 'root',
    d: 'domain'
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

