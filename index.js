const R_FILE_TO_CLASS = /_(\w)/gi,
  DIR_PATH = './components',
  fs = require('fs'),
  paths = require('path');

var dir = fs.readdirSync(paths.normalize(__dirname + '/' + DIR_PATH));

if (Array.isArray(dir) && dir.length) {
  dir.forEach(function(name) {
    var className = paths.basename(name, '.js').replace(R_FILE_TO_CLASS, function(str, w) {
      return (w + '').toUpperCase();
    });
    exports[className[0].toUpperCase() + className.slice(1)] = require(paths.normalize(__dirname + '/' + DIR_PATH + '/' + name));
  });
}
