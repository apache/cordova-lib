/**
 * Base module for platform-related plugin managing logic.
 */
function BasePluginHandler () {
    // Since existing plugin handlers is not constructable and hence doesn't requires
    // any instance properties, we don't need for any functionality in constructor.
    // However this could be extended in future to share some functionality between
    // platforms (like assets/js-modules handling).
}

// Mapping for getPackageName method to legacy package_name method for old platforms
BasePluginHandler.prototype.getPackageName = function(projectDir) {
    if (this.package_name) {
        return this.package_name(projectDir);
    }
};

module.exports = BasePluginHandler;
