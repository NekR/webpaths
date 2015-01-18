var fs = require('fs'),
  pathmod = require('path'),
  vm = require('vm'),
  doStat = fs.stat,
  hasOwn = Function.call.bind({}.hasOwnProperty),
  mimeTypes = require('../config/mime_types.json'),
  charsetGroups = {},
  charsets = {},
  ext2mime = {};

var DEFAULT_CHARSET = '',
  DIR_PATH_HANDLER = '_path.js';

Object.keys(mimeTypes.charsets).forEach(function(charset) {
  var parts = charset.split('/');

  if (parts[1] === '*') {
    if (parts[0] === '*') {
      DEFAULT_CHARSET = this[charset];
    } else {
      charsetGroups[parts[0]] = this[charset];
    }
  } else if (charset !== '*/*') {
    charsets[charset] = this[charset];
  }
}, mimeTypes.charsets);

Object.keys(mimeTypes.exts).forEach(function(ext) {
  var mime = this[ext];

  if (typeof mime === 'object') {
    if (!mime.contentType) return;

    ext2mime[ext] = mime.contentType;
    if (mime.charset) {
      charsets[mime.contentType] = mime.charset;
    }

  } else if (typeof mime === 'string') {
    ext2mime[ext] = mime;
  }
}, mimeTypes.exts);


var notFound = function(path) {
  path.close(404);
  return 404;
},
lookupDirHandlers = function(dirname, root, callback) {
  var handlers = [],
    out = [];

  dirname = dirname.replace(root/* + pathmod.sep*/, '');
  dirname = dirname.split(pathmod.sep);

  var read = function() {
    handlers.reduceRight(function(next, handler) {
      return function() {
        fs.readFile(handler, function(e, data) {
          if (!e) {
            out.push(data);
          }

          next();
        });
      };
    }, function() {
      callback(out);
    })();
  };

  dirname.reduceRight(function(next, dir) {
    return function(prefix) {
      prefix = prefix + pathmod.sep + dir;

      var handler = prefix + pathmod.sep + DIR_PATH_HANDLER;

      doStat(handler, function(e, stat) {
        if (!e && stat.isFile()) {
          handlers.push(handler);
        }

        next(prefix);
      });
    };
  }, read)(root);
};

var FsLoader = module.exports = function FsLoader(root, host) {
  this.root = root;
  this.host = host;
};


FsLoader.prototype.handle = function(path) {
  var pathname = path.name,
    dirname,
    root = this.root;

  if (pathname === '/') {
    pathname = '/index.html';
  }

  pathname = pathmod.normalize(pathmod.join('/', pathname));
  pathname = pathname.replace(/\\+$/g, '');
  pathname = pathmod.normalize(pathmod.join(root, pathname));

  dirname = pathmod.dirname(pathname);

  doStat(pathname, function(e, stat) {
    if (e || !stat.isFile()) {
      return notFound(path);
    }

    var ext = pathmod.extname(pathname).slice(1),
      encoding = DEFAULT_CHARSET;

    if (ext && hasOwn(ext2mime, ext)) {
      ext = path.contentType = ext2mime[ext];

      if (hasOwn(charsets, ext)) {
        encoding = charsets[ext];
      } else {
        ext = ext.split('/');
        if (hasOwn(charsetGroups, ext[0])) {
          encoding = charsetGroups[ext[0]];
        }
      }
    }

    path.encoding = encoding;
    path.statusCode = 200;

    var flush = function() {
      path.sendHeaders();

      fs.createReadStream(pathname).on('data', function(chunk) {
        path.write(chunk);
      }).on('close', function() {
        path.close();
      }).on('error', function() {
        path.close(500);
      });
    };

    lookupDirHandlers(dirname, root, function(handlers) {
      if (!handlers.length) {
        flush();
        return;
      }

      fs.readFile(pathname, function(e, content) {
        if (e) {
          return notFound(path);
        }

        var getContext = function(obj) {
          return {
            get root() {
              return root;
            },
            get path() {
              return path;
            },
            get content() {
              return content;
            },
            get console() {
              return console;
            },
            get dir() {
              return dirname;
            },
            get file() {
              return pathmod.basename(pathname);
            },
            get require() {
              return require;
            },
            save: function(data) {
              content = data;
            },
            wait: obj && obj.wait,
            flush: obj && obj.flush
          };
        };

        handlers.reduceRight(function(next, handler) {
          return function() {
            var needWait;

            vm.runInNewContext(handler, getContext({
              wait: function() {
                needWait = true;
              },
              flush: function() {
                next();
              }
            }));

            if (!needWait) {
              next();
            }
          };
        }, function() {
          path.sendHeaders();
          path.write(content);
          path.close();
        })();
      });
    });
  });
};