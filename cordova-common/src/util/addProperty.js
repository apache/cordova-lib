module.exports = function addProperty(module, property, modulePath, obj) {
    
    obj = obj || module.exports;
    // Add properties as getter to delay load the modules on first invocation
    Object.defineProperty(obj, property, {
        configurable: true,
        get: function () {
            var delayLoadedModule = module.require(modulePath);
            obj[property] = delayLoadedModule;
            return delayLoadedModule;
        }
    });
};
