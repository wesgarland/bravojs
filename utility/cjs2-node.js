/**
 *  @file       cjs2-node.js            Compatibility layer for Node.js which allows
 *                                      us to execute basic CommonJS Modules/2.0-d8
 *                                      modules within the Node environment.
 *  Usage:  require("cjs2-node")
 *          in the main program as early as possible (before any calls to
 *          module.declare or require)
 *
 *  @author     Wes Garland, wgarland@sparc.network
 *  @date       May 2018
 */

/** Module.declare de-sugar for any modules which are CommonJS Modules/2.0 */
module.constructor.prototype.declare = function cjs2_moduleDeclare(deps, cjs1_moduleFun)
{
  if (arguments.length === 1)
  {
    cjs1_moduleFun = deps;
    deps = undefined;
  }

  function newRequire(moduleName)
  {
    if (moduleName[0] != ".")
      return require(moduleName);
    return require(newRequire.path + moduleName);
  }
  newRequire.path = module.parent.filename.replace(/[^\/]*$/,"");

  cjs1_moduleFun(newRequire, this.exports, this);
}
