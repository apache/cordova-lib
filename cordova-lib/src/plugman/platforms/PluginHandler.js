/**
 * Base module for platform-related plugin managing logic.
 */
function PlatformHandler () {
    // Since existing plugin handlers is not constructable and hence doesn't requires
    // any instance properties, we don't need for any functionality in constructor.
    // However this coud extended in future to share some functionality between
    // platforms (like assets/js-modules handling).
}

module.exports = PlatformHandler;
