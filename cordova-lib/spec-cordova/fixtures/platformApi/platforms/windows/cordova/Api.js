function MockPlatformApi () {
    if (this.constructor.super_){
        this.constructor.super_.apply(this, arguments);
    }
}
function MockPluginHandler () { }
module.exports = MockPlatformApi;
module.exports.PluginHandler = MockPluginHandler;
