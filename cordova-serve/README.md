This module can be used to serve up a Cordova application in the browser. It has no command-line, but rather is intended
to be called using the following API:

``` js
var serve = require('cordova-serve');
serve.launchServer(opts);
serve.servePlatform(platform, opts);
serve.launchBrowser(ops);
serve.sendStream(filePath, request, response[, readStream][, noCache]);
```

## launchServer()

``` js
launchServer(opts);
```

Launches a server with the specified options. Parameters:

* **opts**: Options, as described below.

## servePlatform()

``` js
servePlatform(platform, opts);
```

Launches a server that serves up any Cordova platform (e.g. `browser`, `android` etc) from the current project.
Parameters:

* **opts**: Options, as described below. Note that for `servePlatform()`, the `root` value should be a Cordova project's
  root folder, or any folder within it - `servePlatform()` will replace it with the platform's `www_dir` folder. If this
  value is not specified, the *cwd* will be used.

## launchBrowser()

``` js
launchBrowser(opts);
```

Launches a browser window pointing to the specified URL. The single parameter is an options object that supports the
following values (both optional):

* **url**: The URL to open in the browser.
* **target**: The name of the browser to launch. Can be any of the following: `chrome`, `chromium`, `firefox`, `ie`,
  `opera`, `safari`. If no browser is specified, 

## sendStream()

``` js
sendStream(filePath, request, response[, readStream][, noCache]);
```

The server uses this method to stream files, and it is provided as a convenience method you can use if you are
customizing the stream by specifying `opts.streamHandler`. Parameters:

* **filePath**: The absolute path to the file to be served (which will have been passed to your `streamHandler`).
* **request**: The request object (which will have been passed to your `streamHandler`).
* **response**: The response object (which will have been passed to your `streamHandler`).
* **readStream**: (optional) A custom read stream, if required.
* **noCache**: (optional) If true, browser caching will be disabled for this file (by setting response header
  Cache-Control will be set to 'no-cache')

## The *opts* Options Object
The opts object passed to `launchServer()` and `servePlatform()` supports the following values (all optional):

* **root**: The file path on the local file system that is used as the root for the server, for default mapping of URL
  path to local file system path.   
* **port**: The port for the server. Note that if this port is already in use, it will be incremented until a free port
  is found.
* **urlPathProcessor**: An optional method to handle special case URLs - `cordova-serve` will by default
  treat the URL as relative to the platform's `www_dir`, but will first call this method, if provided, to support
  custom handling.
* **streamHandler**: An optional custom stream handler - `cordova-serve` will by default stream files using
  `sendStream()`, described above, which just streams files, but will first call this method, if provided, to
  support custom streaming. This method is described in more detail below.
* **serverExtender**: This method is called as soon as the server is created, so that the caller can do
  additional things with the server (like attach to certain events, for example). This method is described in more
  detail below.

## urlPathProcessor()
Provide this method if you need to do custom processing of URL paths. That is, custom mapping of URL path to local file path. 
The signature of this method is as follows:

``` js
urlPathProcessor(urlPath, request, response, do302, do404)
```

Parameters:

* **urlPath**: The URL path to process. It is the value of `url.parse(request.url).pathname`.
* **request**: The server request object.
* **response**: The server response object.
* **do302**: A helper method to do a 302 HTTP response (redirection). It takes a single parameter - the URL to redirect to.
* **do404**: A helper method to do a 404 HTTP response (not found).

Return value:

Broadly, there are three possible actions you can take in your `urlPathProcessor` handler:

1. You completely handle the request (presumably by doing some sort of response and ultimately calling `response.end()`.
   In this scenario, you should return `null`. 
2. You have mapped the URL path to a custom local file path. In this scenario, you should return `{filePath: <value>}`,
   where `<value>` is the local file path.
3. You have determined you don't need to do any custom processing and will let cordova-serve to its default mapping. In
   this scenario, you should return `{filePath: null}`.

## streamHandler()
Provide this method if you wish to perform custom stream handling. The signature of this method is as follows:

``` js
streamHandler(filePath, request, response)
```

Parameters:

* **filePath**: This is the path to the local file that will be streamed. It might be the value you returned from
  urlPathProcessor(), in which case it doesn't necessarily have to reference an actual file: it might just be an
  identifier string that your custom stream handler will recognize. If you are going to end up calling `sendStream()`,
  it is useful if even a fake file name has a file extension, as that is used for mime type lookup.
* **request**: The server request object.
* **response**: The serve response object.

Return value:

Return `true` if you have handled the stream request, otherwise `false`.

## serverExtender()

If you provide this method, it will be called as soon as the server is created. It allows you to attach additional
functionality to the server, such has event handlers, web sockets etc.  The signature of this method is as follows:

``` js
serverExtender(server, root)
```

Parameters:

* **server**: A reference to the server (the result of calling `http.createServer()`).
* **root**: The file path on the local file system that is used as the root for the server (if it was provided), for
  default mapping of URL path to local file system path.

