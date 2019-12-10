/**
 *  This file implements BravoJS, a CommonJS Modules/2.0 environment.
 *
 *  Copyright (c) 2010-2018, PageMail, Inc.
 *  Wes Garland, wes@page.ca
 *  MIT License
 */
var bravojs;                    /**< Namespace object for this implementation */

if (typeof bravojs === "undefined")
  bravojs = {};

try {

if (!bravojs.hasOwnProperty("errorReporter"))
{
  bravojs.errorReporter = function bravojs_defaultErrorReporter(e)
  {
    if (typeof alert === "function")
      alert(" * BravoJS: " + e.name + " - " + e.message + " at " + e.fileName + "@" + e.lineNumber + "\n\n" + e.stack);
    else if (console && console.error)
      console.error(" * BravoJS: " + e.name + " - " + e.message + " at " + e.fileName + "@" + e.lineNumber + "\n\n" + e.stack);
    throw e;
  }
}

if (typeof window === "undefined")
  bravojs.global = self;
else
  bravojs.global = window;

/** Reset the environment so that a new main module can be loaded */
bravojs.reset = function bravojs_reset(mainModuleDir, paths)
{
  bravojs.requireMemo                   = {};   /**< Module exports, indexed by canonical name */
  bravojs.pendingModuleDeclarations     = {};   /**< Module.declare arguments, indexed by canonical name */
  bravojs.paths                         = paths || [];  /**< Backing array for require.paths */
  bravojs.mainModuleDir                 = mainModuleDir
                                          || bravojs.dirname(bravojs.URL_toId(window.location.href + ".js", true)); /**< Current directory for relative paths from main module */
  delete bravojs.Module.prototype.main;
  delete bravojs.scriptTagMemo;
  delete bravojs.scriptTagMemoIE;

  /* Extra-module environment */
  bravojs.global.require = bravojs.requireFactory(bravojs.mainModuleDir);
  bravojs.global.module  = new bravojs.Module('', []);

  /* Module.declare function which handles main modules inline SCRIPT tags.
   * This function gets deleted as soon as it runs, allowing the module.declare
   * from the prototype take over. Modules created from this function have
   * the empty string as module.id.
   */
  bravojs.global.module.declare = function bravojs_main_module_declare(dependencies, moduleFactory)
  {
    if (typeof dependencies === "function")
    {
      moduleFactory = dependencies;
      dependencies = [];
    }

    bravojs.initializeMainModule(dependencies, moduleFactory, '');
  }
}

/** Print to text to stdout */
bravojs.print = function bravojs_print()
{
  var output="";
  var i;
  var stdout;

  for (i=0; i < arguments.length; i++)
    output += arguments[i] + (i===arguments.length - 1 ? "" : " ");
  output.replace(/\t/, "        ");

  if (typeof document !== "undefined" && (stdout = document.getElementById('stdout')))
  {
    output += "\n";

    if (typeof stdout.value !== "undefined")
    {
      stdout.value += output;
      if (stdout.focus)
        stdout.focus();

      if (stdout.tagName === "TEXTAREA")
        stdout.scrollTop = stdout.scrollHeight;
    }
    else
    {
      if (typeof stdout.innerText !== "undefined")
      {
        stdout.innerText = stdout.innerText.slice(0,-1) + output + " ";         /* IE normalizes trailing newlines away */
      }
      else
        stdout.textContent += output;
    }
  }
  else if (typeof console === "object" && console.print)
  {
    console.print(output);
  }
  else if (typeof console === "object" && console.log)
  {
    console.log(output);
  }
  else
    alert(" * BravoJS stdout: " + output);
}

bravojs.warn = function bravojs_warn()
{
  if (typeof console === "object" && console.warn)
    console.warn.apply(console, arguments);
  else
  {
    arguments[0] = "BravoJS Warning: " + arguments[0];
    bravojs.print.apply(this, arguments);
  }
}

/** Canonicalize path, compacting slashes and dots per basic UNIX rules.
 *  Treats paths with trailing slashes as though they end with INDEX instead.
 *  Not rigorous.
 */
bravojs.realpath = function bravojs_realpath(path)
{
  if (typeof path !== "string")
    path = path.toString();

  var oldPath = path.split('/');
  var newPath = [];
  var i;

  if (oldPath[0] === "")
    newPath[0] = "";
  if (oldPath[oldPath.length - 1] === "")
    oldPath[oldPath.length - 1] = ".";

  for (i = 0; i < oldPath.length; i++)
  {
    if (oldPath[i] == '.' || !oldPath[i].length)
      continue;
    if (oldPath[i] == '..')
    {
      if (!newPath.length)
      {
        bravojs.e = new Error("Invalid module path: " + path);
        throw bravojs.e;
      }
      newPath.pop();
      continue;
    }
    newPath.push(oldPath[i]);
  }

  return newPath.join('/');
}

/** Extract the non-directory portion of a path */
bravojs.basename = function bravojs_basename(path)
{
  if (typeof path !== "string")
    path = path.toString();

  var s = path.split('/').slice(-1).join('/');
  if (!s)
    return path;
  return s;
}

/** Extract the directory portion of a path */
bravojs.dirname = function bravojs_dirname(path)
{
  if (typeof path !== "string")
    path = path.toString();

  if (path.charAt(path.length - 1) === '/')
    return path.slice(0,-1);

  var s = path.split('/').slice(0,-1).join('/');
  if (!s)
    return ".";

  return s;
}

/** Find a global module within the requireMemo or pendingModuleDeclarations
 *  @param   moduleIdentifer   A module identifier
 *  @returns the module id (if global and found on path), otherwise null
 */
bravojs.findModule = function bravojs_findModule(moduleIdentifier)
{
  var dir, i;

  if (moduleIdentifier.charAt(0) === '.')
    return null

  for (i=0; i < bravojs.paths.length; i++)
  {
    if ((bravojs.requireMemo.hasOwnProperty(bravojs.paths[i] + '/' + moduleIdentifier)) ||
        (bravojs.pendingModuleDeclarations.hasOwnProperty(bravojs.paths[i] + '/' + moduleIdentifier)))
      return bravojs.paths[i] + '/' + moduleIdentifier;
  }

  return null
}

/** Turn a module identifier and module directory into a canonical
 *  module.id. Global module identifiers are resolved against
 *  require.paths and discovered by looking at the module memos.
 */
bravojs.makeModuleId = function bravojs_makeModuleId(relativeModuleDir, moduleIdentifier)
{
  var id;

  if (moduleIdentifier === '')  /* Special case for main module */
    return '';

  if (typeof moduleIdentifier !== "string")
  {
    bravojs.e = new Error("Invalid module identifier: " + (typeof moduleIdentifier === "object" ? JSON.stringify(moduleIdentifier) : moduleIdentifier));
    throw bravojs.e;
  }

  if (moduleIdentifier.charAt(0) === '/')
  {
    /* Absolute path. Not required by CommonJS but it makes dependency list optimization easier */
    id = moduleIdentifier;
  }
  else
  if ((moduleIdentifier.indexOf("./") == 0) || (moduleIdentifier.indexOf("../") == 0))
  {
    /* Relative module path -- relative to relativeModuleDir */
    id = relativeModuleDir + "/" + moduleIdentifier;
  }
  else
  {
    id = bravojs.findModule(moduleIdentifier)
    if (id === null && typeof bravojs.globalResolveHook === "function")
      id = bravojs.globalResolveHook(moduleIdentifier)
    if (id === null)
      id = bravojs.mainModuleDir + '/' + moduleIdentifier;
  }

  return bravojs.realpath(id);
}

/** Turn a script URL into a canonical module.id */
bravojs.URL_toId = function bravojs_URL_toId(moduleURL, relaxValidation)
{
  var i, s;

  /* Treat the whole web as our module repository, ignoring protocol.
   * 'http://www.page.ca/a/b/module.js' and 'https://www.page.ca/a/b/module.js'
   * both have id '//www.page.ca/a/b/module'.
   */
  moduleURL = moduleURL.replace(/^https?:\/\//i, "//");
  if (!moduleURL.match(/^\/\//))
  {
    if (moduleURL.match(/^file:\/\//i) && window.location.protocol === "file:")  /* only allow file:// modules when using file:// web page */
      id = moduleURL = '@' + bravojs.realpath(moduleURL.slice(5));
    else
    {
      bravojs.e = new Error("Invalid module URL: " + moduleURL);
      throw bravojs.e;
    }
  }
  else
    id = bravojs.realpath(moduleURL.slice(i + 2));

  if ((i = id.indexOf('?')) != -1)
    id = id.slice(0, i);
  if ((i = id.indexOf('#')) != -1)
    id = id.slice(0, i);

  s = id.slice(-3);
  if (!relaxValidation && (s !== ".js"))
  {
    bravojs.e = new Error("Invalid module URL: " + moduleURL);
    throw bravojs.e;
  }
  if (s === ".js")
    id = id.slice(0,-3);

  return id;
}

/** Normalize a dependency array so that only unique and previously unprovided
 *  dependencies appear in the output list. The output list also canonicalizes
 *  the module names relative to the current require, or the rel parameter.
 *  Labeled dependencies are unboxed.
 *
 *  @param      dependencies            A dependency array
 *  @param      rel                     The canonical module id we are resolving
 *                                      dependencies against; if undefined, we
 *                                      use the current require.id method.
 */
bravojs.normalizeDependencyArray = function bravojs_normalizeDependencyArray(dependencies, rel)
{
  var normalizedDependencies = [];
  var i, label;

  function addNormal(moduleIdentifier)
  {
    var id;

    if (rel)
      id = bravojs.makeModuleId(bravojs.dirname(rel), moduleIdentifier);
    else
      id = require.id(moduleIdentifier);

    if (bravojs.requireMemo[id] || bravojs.pendingModuleDeclarations[id])
      return;

    normalizedDependencies.push(id);
  }

  for (i=0; i < dependencies.length; i++)
  {
    switch(typeof dependencies[i])
    {
      case "object":
        for (label in dependencies[i])
        {
          if (dependencies[i].hasOwnProperty(label))
            addNormal(dependencies[i][label]);
        }
        break;

      case "string":
        addNormal(dependencies[i]);
        break;

      default:
        bravojs.e = new Error("Invalid dependency array value at position " + (i+1));
        throw bravojs.e;
    }
  }

  return normalizedDependencies;
}

/** Provide a module to the environment
 *  @param      dependencies            A dependency array
 *  @param      moduleFactoryFunction   The function which will eventually be invoked
 *                                      to decorate the module's exports. If not specified,
 *                                      we assume the factory has already been memoized in
 *                                      the bravojs.pendingModuleDeclarations object.
 *  @param      id                      The module.id of the module we're providing
 *  @param      callback                Optional function to run after the module has been
 *                                      provided to the environment
 */
bravojs.provideModule = function bravojs_provideModule(dependencies, moduleFactory,
                                                       id, callback)
{
  /* Memoize the the factory, satistfy the dependencies, and invoke the callback */
  if (moduleFactory)
    require.memoize(id, dependencies, moduleFactory);

  if (dependencies && dependencies.length > 0)
    module.provide(bravojs.normalizeDependencyArray(dependencies, id), callback);
  else
  {
    if (callback)
      callback();
  }
}

/** Initialize a module. This makes the exports object available to require(),
 *  runs the module factory function, and removes the factory function from
 *  the pendingModuleDeclarations object.
 */
bravojs.initializeModule = function bravojs_initializeModule(id)
{
  var moduleDir     = id ? bravojs.dirname(id) : bravojs.mainModuleDir;
  var moduleFactory = bravojs.pendingModuleDeclarations[id].moduleFactory;
  var dependencies  = bravojs.pendingModuleDeclarations[id].dependencies;
  var require, exports, module;

  delete bravojs.pendingModuleDeclarations[id];

  require = bravojs.requireFactory(moduleDir, dependencies);
  module  = new bravojs.Module(id, dependencies);

  if (bravojs.securableModules === true)
    exports = bravojs.requireMemo[id] = {};
  else
  {
    /* Add node-style replaceable module.exports, unless we need to
     * maintain compatibility with the Securable Modules specification
     * (CommonJS/1.0 precursor).
     */
    function replaceExports(newExports)
    {
      exports = bravojs.requireMemo[id] = newExports;
    }

    Object.defineProperty(module, "exports",
                          {
                            configurable:       true,
                            enumerable:         true,
                            set:                replaceExports
                          });

    module.exports = {};
  }

  moduleFactory(require, exports, module);
}

/** Search the module memo and return the correct module's exports, or throw.
 *  Searching the module memo will initialize a matching pending module factory.
 */
bravojs.requireModule = function bravojs_requireModule(parentModuleDir, moduleIdentifier)
{
  var id = bravojs.makeModuleId(parentModuleDir, moduleIdentifier);
  var e, i, a;

  if (!bravojs.requireMemo[id] && bravojs.pendingModuleDeclarations[id])
    bravojs.initializeModule(id);

  if (id === null || !bravojs.requireMemo[id])
    throw bravojs.e = new Error("Module '" + moduleIdentifier + "' is not available.");

  return bravojs.requireMemo[id];
}

/** Create a new require function, closing over it's path so that relative
 *  modules work as expected.
 */
bravojs.requireFactory = function bravojs_requireFactory(moduleDir, dependencies)
{
  var deps, i, label;

  function addLabeledDep(moduleIdentifier)
  {
    deps[label] = function bravojs_labeled_dependency()
    {
      return bravojs.requireModule(moduleDir, moduleIdentifier);
    }
  }

  if (dependencies)
  {
    for (i=0; i < dependencies.length; i++)
    {
      if (typeof dependencies[i] !== "object")
        continue;

      for (label in dependencies[i])
      {
        if (dependencies[i].hasOwnProperty(label))
        {
          if (!deps)
            deps = {};
          addLabeledDep(dependencies[i][label]);
        }
      }
    }
  }

  var newRequire = function require(moduleIdentifier)
  {
    if (deps && deps[moduleIdentifier])
      return deps[moduleIdentifier]();
    return bravojs.requireModule(moduleDir, moduleIdentifier);
  }

  newRequire.id = function require_id(moduleIdentifier)
  {
    return bravojs.makeModuleId(moduleDir, moduleIdentifier);
  }

  newRequire.canonicalize = function require_canonicalize(moduleIdentifier)
  {
    var id = bravojs.makeModuleId(moduleDir, moduleIdentifier);

    if (id === '')
    {
      bravojs.e = new Error("Cannot canonically name the resource bearing this main module");
      throw bravojs.e;
    }

    return window.location.protocol + "/" + id + ".js";
  }

  newRequire.memoize = function require_memoize(id, dependencies, moduleFactory)
  {
    bravojs.pendingModuleDeclarations[id] = { moduleFactory: moduleFactory, dependencies: dependencies };
  }

  newRequire.isMemoized = function require_isMemoized(id)
  {
    return (bravojs.pendingModuleDeclarations[id] || bravojs.requireMemo[id]) ? true : false;
  }

  newRequire.paths = bravojs.paths;
  return newRequire;
}

/** Module object constructor
 *
 *  @param      id              The canonical module id
 *  @param      dependencies    The dependency list passed to module.declare
 */
bravojs.Module = function bravojs_Module(id, dependencies)
{
  this.id        = id;
  this.protected = void 0;
  this.dependencies = dependencies;

  var i, label;

  /* Create module.deps array */
  this.deps = {};

  for (i=0; i < dependencies.length; i++)
  {
    if (typeof dependencies[i] === "string")
      continue;

    if (typeof dependencies[i] !== "object")
    {
      bravojs.e = new Error("Invalid " + typeof dependencies[i] + " element in dependency array at position " + i);
      throw bravojs.e;
    }

    /* Labeled dependency object */
    for (label in dependencies[i])
    {
      if (dependencies[i].hasOwnProperty(label))
      {
        this.deps[label] = function bravojs_lambda_module_deps()
        {
          bravojs.requireModule(bravojs.dirname(id), dependencies[i][label]);
        };
      }
    }
  }
}

/** A module.declare suitable for use during DOM SCRIPT-tag insertion.
 *
 *  The general technique described below was invented by Kris Zyp.
 *
 *  In non-old-IE browsers, the script's onload event fires as soon as the
 *  script finishes running, so we just memoize the declaration without
 *  doing anything. After the script is loaded, we do the "real" work
 *  as the onload event also supplies the script's URI, which we use
 *  to generate the canonical module id.
 *
 *  In IE browsers, the event can fire when the tag is being inserted
 *  in the DOM, or sometime thereafter. In the first case, we read a
 *  memo we left behind when we started inserting the tag; in the latter,
 *  we look for interactive scripts.
 *
 *  Note: "IE browsers" describes Internet Explorer versions 6 through 8.
 *        Research has not been done on later versions. Provided the
 *        behaviour either remains the same, or the new behaviour matches
 *        all other browsers, this code will continue to function correctly.
 *
 *  Event                       Action
 *  -------------------------   ------------------------------------------------------------------------------------
 *  Inject Script Tag           onload event populated with URI
 *                              scriptTagMemo populated with URI
 *  IE pulls from cache         cname derived in module.declare from scriptTagMemo, invoke provideModule
 *  IE pulls from http          cname derived in module.declare from script.src, invoke provideModule
 *  Non-old-IE loads script     onload event triggered, most recent incomplete module.declare is completed,
 *                              deriving the cname from the onload event.
 */
bravojs.Module.prototype.declare = function bravojs_Module_declare(dependencies, moduleFactory)
{
  var stm;

  if (typeof dependencies === "function")
  {
    moduleFactory = dependencies;
    dependencies = [];
  }

  stm = bravojs.scriptTagMemo;
  if (stm && stm.id === '')             /* Static HTML module */
  {
    if (bravojs.dependencyDebug)
      bravojs.print("static HTML module depends on:\n" + dependencies.join(",\n"));
    delete bravojs.scriptTagMemo;
    bravojs.provideModule(dependencies, moduleFactory, stm.id, stm.callback);
    return;
  }

  if (stm)
    throw new Error("Bug");

  if (typeof document !== "undefined" && document.addEventListener)     /* non-old-IE, defer work to script's onload event which will happen immediately */
  {
    bravojs.scriptTagMemo = { dependencies: dependencies, moduleFactory: moduleFactory };
    return;
  }

  stm = bravojs.scriptTagMemoIE;
  delete bravojs.scriptTagMemoIE;

  if (stm && stm.id)                    /* old-IE, pulling from cache */
  {
    if (bravojs.dependencyDebug)
      bravojs.print("cached module " + stm.id + " depends on:\n" + depdencies.join(",\n"));
    bravojs.provideModule(dependencies, moduleFactory, stm.id, stm.callback);
    return;
  }

  /* Assume IE fetching from remote */
  var scripts = document.getElementsByTagName("SCRIPT");
  var i;

  for (i = 0; i < scripts.length; i++)
  {
    if (scripts[i].readyState === "interactive")
    {
      if (bravojs.dependencyDebug)
        bravojs.print("remote module " + stm.id + " depends on:\n" + depdencies.join(",\n"));
      bravojs.provideModule(dependencies, moduleFactory, bravojs.URL_toId(scripts[i].src), stm.callback);
      return;
    }
  }

  bravojs.e = new Error("Could not determine module's canonical name from script-tag loader");
  throw bravojs.e;
}

/** A module.provide suitable for a generic web-server back end.  Loads one module at
 *  a time in continuation-passing style, eventually invoking the passed callback.
 *
 *  A more effecient function could be written to take advantage of a web server
 *  which might aggregate and transport more than one module per HTTP request.
 *
 *  @param      dependencies    A dependency array
 *  @param      callback        The callback to invoke once all dependencies have been
 *                              provided to the environment. Optional.
 *  @param      onerror         The callback to invoke in the case there was an error providing
 *                              the module (e.g. 404). May be called more than once.
 */
bravojs.Module.prototype.provide = function bravojs_Module_provide(dependencies, callback, onerror)
{
  var self = arguments.callee;

  if ((typeof dependencies !== "object") || (dependencies.length !== 0 && !dependencies.length))
  {
    bravojs.e = new Error("Invalid dependency array: " + dependencies.toString());
    throw bravojs.e;
  }

  dependencies = bravojs.normalizeDependencyArray(dependencies, this.id ? this.id : undefined);

  if (dependencies.length === 0)
  {
    if (callback)
      callback();
    return;
  }

  module.load(dependencies[0], function bravojs_lambda_provideNextDep() { self(dependencies.slice(1), callback, onerror) }, onerror);
}

/** A module.load suitable for a generic web-server back end. The module is
 *  loaded by injecting a SCRIPT tag into the DOM.
 *
 *  @param      moduleIdentifier        Module to load
 *  @param      callback                Callback to invoke when the module has loaded.
 *  @param      onerror                 The callback to invoke in the case there was an error loading
 *                                      the module (e.g. 404).
 *  @see        bravojs_Module_declare
 */
bravojs.Module.prototype.load = function bravojs_Module_load(moduleIdentifier, callback, onerror)
{
  if (bravojs.global.module.hasOwnProperty("declare"))
    delete bravojs.global.module.declare;

  var script = document.createElement('SCRIPT');
  script.setAttribute("type","text/javascript");
  script.setAttribute("src", require.canonicalize(moduleIdentifier) + "?" + (bravojs.debug === true ? Date.now() : (bravojs.debug ? bravojs.debug : "1")));

  if (document.addEventListener)        /* Non-old-IE; see bravojs_Module_declare */
  {
    script.onload = function bravojs_lambda_script_onload()
    {
      /* stm contains info from recently-run module.declare() */
      var stm = bravojs.scriptTagMemo;
      if (typeof stm === "undefined")
      {
        bravojs.e = new Error("Module '" + moduleIdentifier + "' did not invoke module.declare!");
        throw bravojs.e;
      }

      delete bravojs.scriptTagMemo;
      bravojs.provideModule(stm.dependencies, stm.moduleFactory, require.id(moduleIdentifier), callback);
    }

    script.onerror = function bravojs_lambda_script_onerror(message, url, lineNumber) 
    {
      var id = require.id(moduleIdentifier);
      bravojs.pendingModuleDeclarations[id] = null;     /* Mark null so we don't try to run, but also don't try to reload */
      if (typeof onerror !== "undefined")
        onerror();
      bravojs.e = new Error("Module '" + id + "'" + " not found");
      throw bravojs.e;
    }
  }
  else
  {
    bravojs.scriptTagMemoIE = { moduleIdentifier: moduleIdentifier, callback: callback };

    script.onreadystatechange = function bravojs_lambda_script_onreadystatechange()
    {
      if (this.readyState != "loaded")
        return;

      /* failed load below */
      var id = require.id(moduleIdentifier);

      if (!bravojs.pendingModuleDeclarations[id] && !bravojs.requireMemo[id] && id === bravojs.scriptTagMemoIE.moduleIdentifier)
      {
        bravojs.pendingModuleDeclarations[id] = null;   /* Mark null so we don't try to run, but also don't try to reload */
        if (typeof onerror !== "undefined")
          onerror();
        bravojs.e = new Error("Module '" + id + "'" + " not found");
        throw bravojs.e;
      }
    }
  }

  (document.getElementsByTagName("HEAD")[0] || document.body).appendChild(script);
}

bravojs.Module.prototype.eventually = function(cb) { cb(); };

/** Shim the environment to have CommonJS ES-5 requirements (if needed),
 *  the execute the callback
 */
bravojs.es5_shim_then = function bravojs_es5_shim_then(callback)
{
  if (!Array.prototype.indexOf || !Function.prototype.bind)
  {
    /* Load ES-5 shim into the environment before executing the main module */
    var script = document.createElement('SCRIPT');
    script.setAttribute("type","text/javascript");
    script.setAttribute("src", bravojs.dirname(bravojs.url) + "/global-es5.js" + "?" + (bravojs.debug === true ? Date.now() : (bravojs.debug ? bravojs.debug : "1")));

    if (document.addEventListener)
      script.onload = callback;
    else
    {
      script.onreadystatechange = function()
      {
        if (this.readyState === "loaded")
          callback();
      }
    }

    (document.getElementsByTagName("HEAD")[0] || document.body).appendChild(script);
  }
  else
  {
    callback();
  }
}

/** Reload a module, violating the CommonJS singleton paradigm and
 *  potentially introducing bugs in to the program using this function --
 *  as references to the previous instance of the module may still be
 *  held by the application program.
 */
bravojs.reloadModule = function(id, callback)
{
  delete bravojs.pendingModuleDeclarations[id];
  delete bravojs.requireMemo[id];
  module.provide([id], callback);
}

/** Main module bootstrap */
bravojs.initializeMainModule = function bravojs_initializeMainModule(dependencies, moduleFactory, moduleIdentifier)
{
  if (module.hasOwnProperty("declare"))         /* special extra-module environment bootstrap declare needs to go */
    delete module.declare;

  if (module.constructor.prototype.main)
  {
    bravojs.e = new Error("Main module has already been initialized!");
    throw bravojs.e;
  }

  bravojs.es5_shim_then
  (
    (function()
     {
       bravojs.provideModule(dependencies, moduleFactory, moduleIdentifier,
                             function bravojs_lambda_requireMain()
                             {
                               var main;

                               Object.defineProperty(module.constructor.prototype, "main",
                                                     {
                                                       enumerable:      true,
                                                       configurable:    true,
                                                       get:             function()
                                                       {
                                                         return require(moduleIdentifier);
                                                       }
                                                     });
                               main = require(moduleIdentifier);
                               delete module.constructor.prototype.main;
                               module.constructor.prototype.main = main;
                               if (bravojs.onMainModuleEvaluated)
                                 bravojs.onMainModuleEvaluated();
                             });
     })
  );
}

/** Run a module which is not declared in the HTML document and make it the program module.
 *  @param      dependencies            [optional]      A list of dependencies to sastify before running the module
 *  @param      moduleIdentifier        moduleIdentifier, relative to dirname(window.location.href). This function
 *                                      adjusts the module path such that the program module's directory is the
 *                                      global module directory before the dependencies are resolved.
 *  @param      callback                [optional]      Callback to invoke once the main module has been initialized
 */
bravojs.runExternalMainModule = function bravojs_runExternalMainModule(dependencies, moduleIdentifier, callback)
{
  if (arguments.length === 1 || typeof moduleIdentifier === "function")
  {
    callback = moduleIdentifier;
    moduleIdentifier = dependencies;
    dependencies = [];
  }

  delete module.declare;

  if (moduleIdentifier.charAt(0) === '/')
    bravojs.mainModuleDir = bravojs.dirname(moduleIdentifier);
  else
    bravojs.mainModuleDir = bravojs.dirname(bravojs.URL_toId(window.location.href + ".js"), true) + "/" + bravojs.dirname(moduleIdentifier);

  moduleIdentifier = bravojs.mainModuleDir + '/' + bravojs.basename(moduleIdentifier);

  bravojs.es5_shim_then(
      function() {
        module.provide(dependencies.concat([moduleIdentifier]),
                       function bravojs_runMainModule() {
                         bravojs.initializeMainModule(dependencies, '', moduleIdentifier);
                         if (callback)
                           callback();
                       })
            });
}

bravojs.reset(bravojs.mainModuleDir, bravojs.paths);  /* Use the reset code to initialize state */

/** Set the BravoJS URL, so that BravoJS can load components
 *  relative to its install dir.  The HTML script element that
 *  loads BravoJS must either have the ID BravoJS, or be the
 *  very first script in the document.
 */
(function bravojs_setURL()
{
  var i;
  var scripts;
  var script;

  if (typeof bravojs.url !== "undefined")
    return;

  script = document.getElementById("BravoJS");
  if (!script)
  {
    scripts = document.getElementsByTagName("SCRIPT");
    script = scripts[scripts.length-1];
  }

  bravojs.url = script.src;

  i = bravojs.url.indexOf("?");
  if (i !== -1)
    bravojs.url = bravojs.url.slice(0,i);
  i = bravojs.url.indexOf("#");
  if (i !== -1)
    bravojs.url = bravojs.url.slice(0,i);

  if (bravojs.basename(bravojs.url) !== "bravo.js")
  {
    bravojs.e = new Error("Could not determine BravoJS URL. You can fix this by giving your script tag id='BravoJS'");
    throw bravojs.e;
  }
})();

/** Diagnostic Aids */
if (!bravojs.global.onerror)
{
  bravojs.global.onerror = function bravojs_window_onerror(message, url, line, column, e)
  {
    var s;

    if (bravojs.errorReporter && bravojs.errorReporter.name !== "bravojs_defaultErrorReporter")
    {
      if (typeof e !== "object")
      {
        e =
        {
          name:         "WindowError",
          message:      message,
          lineNumber:   line,
          columnNumber: column,
          fileName:     url
        };
      }

      bravojs.errorReporter(e);
    }
    else if (e && typeof e === "object" && e.stack && typeof print !== "undefined" && print === bravojs.print)
    {
      s = "            ".slice(0,e.name.length);
      console.log("%c" + e.name + ": " + e.message,     "font-weight: bold; color: black;");
      console.log("%c" + s.slice(2) +    "in: " + url,  "color: black;");
      console.log("%c" + s.slice(4) +  "line: " + line, "color: black;");
      if (column)
        console.log("%c" + s.slice(3) +   "col: " + column,"color: black;");
      console.log("%c" + s.slice(5) + "stack: " + e.stack.replace(/\nbravojs_.*/g,"\n").replace(/\n *\n/g,"").split("\n").join("\n  " + s), "color: grey;");
    }
    else
    {
      s =            " * Error: " + message + "\n";
      if (url)  s += "      in: " + url + "\n";
      if (line) s += "    line: " + line + "\n";
      bravojs.print("\n" + s);
    }
  }
}

} catch(e) { bravojs.errorReporter(e); }
