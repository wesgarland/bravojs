# Welcome to BravoJS

* Copyright (c) 2010-2018 PageMail, Inc.
* Portions Copyright (c) 2019 Kings Distributed Systems

Released under the terms of the MIT License.

BravoJS began life as a reference implementation of an unratified proposed draft for CommonJS Modules/2.0. Note that the CommonJS working group itself is now defacto defunct, meaning that Modules/2.0 will never become a standard.  Other implementations referencing this draft include NobleJS (Domenic Denicola) and PINF (Christoph Dorn). The current draft specification  this code is based on has been included in the references directory.

BravoJS is an extensible CommonJS module loader for the web browser and other environments; similar in principle to CommonJS Transport/C  (e.g. RequireJS and AMD), but maintaining complete backwards compatibility with CommonJS Modules/1.1.1 modules, including lazy initialization and correct support for dependency graphs with cycles.

The extensibility of this module system makes it possible to write plug-ins to add features like
* a module loader which resolves dependencies server-side, feeding the module system a cacheable bundle of modules over a single HTTP request
* a module loader which can operate over a postMessage interface, allowing CommonJS modules to run in Web Workers
* the only limit is yourself!

We intend to release both Web Worker and NodeJS plugins for BravoJS in the summer of 2019; they will appear in future versions of this package.

As the CommonJS Modules/2.0 specification is no longer being developed we have taken some liberties with BravoJS and are now targeting NodeJS modules and NPM packages in our development efforts.  So far, we have 
* added support for replaceable `module.exports` (although we recommend not using it for new code - *there be dragons*)
* included a shim in the utility folder which provides some compatibility between CommonJS Modules/2.0 for and NodeJS  (de-sugars the boilerplate `module.declare`)

Wes Garland, wes@kingsds.network

## Compatibility
It is anticipated that core BravoJS continues to work with all browsers, going back as far as Internet Explorer 6, however, we are not testing on obsolete platforms at this time. 

## Sample Module
```javascript
module.declare(["list", "of", "dependencies"], function (require, exports, modules) {
  exports.clickyClick = function(element) {
    console.log('You clicked', element.id)
  }
})
```
## Sample Web Application
```html
<html>
<head>
  <script id="bravojs" src="/path/to/bravo.js"></script>
   <style type="text/css">
    BODY[uiState="loading"] * {
      pointer-events: none;
    }
    BODY[uiState="loading"], BODY[uiState="loading"] * {
      opacity: 0.5;
      cursor: wait !important;
    }
  </style>
</head>
<body uiState="loading">
  <form onsubmit="return module.main.validate(this)">
    Click This: 
    <input type="checkbox" id="veryNiceCheckbox" 
           onclick="require('./sampleModule').clickyClick(this)"><br>
    Type Here: 
    <input type="text" name="typing"> 
    <input type="submit" value="OK">
  </form>
  <script>
/** Main module */
module.declare(["./sampleModule"], function(require, exports, module) {
  document.body.setAttribute('uiState', 'ready')

  exports.validate = function(form) {
    console.log("You typed", form.elements['typing'].value)
    return false; /* prevent form from submitting */
  }
})
  </script>
</body>
</html>
```
## Manifest
|Resource |Description  |
|--|--|
|bravo.js|                The CommonJS Modules/2.0 environment with default loader|
|reference/CommonJS Modules-2.0-draft-8.pdf| The CommonJS Modules/2.0-draft 8 specification|
|plugins/wonkoll|         A module loader plug-in implemented with LazyLoad.js|
|plugins/fastload|        A module loader plug-in which implements a multi-module transport. Includes server-side component for GPSEE.|
|plugins/jquery-loader|   A module loader plug-in which loads modules over JQuery's version of XHR|
|demos/area|              A web app which calculates the area of a rectangle|
|demos/iojs_tests|        An environment to exercise the Modules/1.0 test suite|
|demos/readme|		  A sample module and web app (see above)
|utility/cjs2-node.js|	  A shim to run CommonJS Modules/2.0 modules in NodeJS|
|utility/test-cjs2-node.sh|A test runner to run the iojs test suite against cjs2-node.js|
