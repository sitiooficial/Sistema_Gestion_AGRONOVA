// utils/asyncHandler.js

/**
 * Wrapper para manejar errores en funciones async sin usar try/catch repetidamente.
 * 
 * Permite:
 * router.get('/', asyncHandler(async (req, res) => {...}));
 */
module.exports = function asyncHandler(fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
