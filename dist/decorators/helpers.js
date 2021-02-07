"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logErrorApiMetaDataDoesNotExist = exports.logWarningIfNoAuthentication = exports.bindControllers = exports.paths = void 0;
require("reflect-metadata");
const path_1 = require("path");
const symbols_1 = require("../symbols");
const Api_1 = require("./Api");
const config_1 = require("../lib/config");
const Notores_1 = require("../Notores");
const ApiMetaData_1 = require("../lib/ApiMetaData");
const constants_1 = require("../constants");
exports.paths = [];
/**
 * Attaches the router controllers to the main express application instance.
 * @param server - express application instance (result of call to `express()`)
 * @param controllers - controller classes (rest parameter) decorated with @Root and @Path/@Use
 */
function bindControllers(server, controllers) {
    const useAuthentication = config_1.getConfig().main.authentication.enabled;
    const ctrls = [];
    for (const Clazz of controllers) {
        const instance = new Clazz();
        ctrls.push(instance);
        // @ts-ignore
        const rootRoute = Clazz[constants_1.ROOT_ROUTE];
        // @ts-ignore
        const dataKey = Clazz[constants_1.DATA_KEY];
        // @ts-ignore
        const ignoreDataKey = Clazz[constants_1.IGNORE_DATA_KEY];
        // @ts-ignore
        const modulePath = Clazz[constants_1.MODULE_PATH];
        if (!rootRoute || !rootRoute.startsWith('/')) {
            // TODO test it
            throw new Error('Class-level \'@Root\' decorator must be used with single string argument starting with forward slash (eg. \'/\' or \'/myRoot\')!');
        }
        // @Use // DO THIS
        const middlewareDeclarationMethods = getClassMethodsByDecoratedProperty(Clazz, symbols_1.middlewareMetadataKey);
        middlewareDeclarationMethods.forEach(middlewareDeclarationMethod => {
            const middlewareMetaData = Reflect.getOwnMetadata(symbols_1.middlewareMetadataKey, instance[middlewareDeclarationMethod]);
            const wrapperMiddleware = (routingFunction) => {
                return async (req, res, next) => {
                    if (useAuthentication && middlewareMetaData.authenticated && !req.user) {
                        return next();
                    }
                    const params = Api_1.generateRoutingParameters(instance, middlewareDeclarationMethod, req, res, next);
                    const result = await routingFunction(...params);
                    if (result) {
                        let body;
                        if (ignoreDataKey) {
                            body = result;
                        }
                        else if (typeof result === 'object' && !Array.isArray(result) && result.hasOwnProperty(dataKey)) {
                            body = result;
                        }
                        else if (result instanceof Error) {
                            body = { error: result.message };
                        }
                        else {
                            body = { [dataKey]: result };
                        }
                        res.locals.setBody(body);
                    }
                    next();
                };
            };
            const app = server[middlewareMetaData.restricted ? 'restricted' : 'public'];
            const mids = [];
            const midsObj = {
                method: 'use',
                ROUTE: middlewareMetaData.paths,
                PATH: '',
                RESTRICTED: middlewareMetaData.restricted,
                AUTH: middlewareMetaData.authenticated,
                AUTH_REDIRECT: middlewareMetaData.unAuthRedirect,
                ROLES: middlewareMetaData.roles,
                function: middlewareDeclarationMethod,
            };
            if (middlewareMetaData.paths.length > 0) {
                mids.push(middlewareMetaData.paths);
            }
            else {
                midsObj.ROUTE = ['ALL'];
            }
            mids.push(wrapperMiddleware(instance[middlewareDeclarationMethod].bind(instance)));
            exports.paths.push(midsObj);
            if (middlewareMetaData.isPreMiddleware) {
                // @ts-ignore
                app.preMiddleware.use(...mids);
            }
            if (middlewareMetaData.isPostMiddleware) {
                // @ts-ignore
                app.postMiddleware.use(...mids);
            }
        });
        // @Path
        const pathRouteMethods = getClassMethodsByDecoratedProperty(Clazz, symbols_1.apiMetadataKey);
        pathRouteMethods.forEach(pathRouteMethod => {
            const apiMetaData = Reflect.getOwnMetadata(symbols_1.apiMetadataKey, instance[pathRouteMethod]);
            const wrapperMiddleware = (routingFunction) => {
                return async (req, res, next) => {
                    const params = Api_1.generateRoutingParameters(instance, pathRouteMethod, req, res, next);
                    const result = await routingFunction(...params);
                    let body;
                    if (result === null || result === undefined) {
                        return next();
                    }
                    if (ignoreDataKey) {
                        body = result;
                    }
                    else if (typeof result === 'object' && !Array.isArray(result) && result.hasOwnProperty(dataKey)) {
                        body = result;
                    }
                    else if (result instanceof Error) {
                        body = { error: result.message };
                    }
                    else {
                        body = { [dataKey]: result };
                    }
                    if (apiMetaData.pages) {
                        res.locals.addPageLocations([
                            path_1.join(modulePath, 'pages')
                        ]);
                        res.locals.addPages(apiMetaData.pages);
                    }
                    res.locals.setBody(body);
                    next();
                };
            };
            // const {PATH_ROUTE, HTTP_METHOD, PRE_MIDDLEWARE, POST_MIDDLEWARE, PRIVATE, AUTH, AUTH_REDIRECT, ROLES, PAGE_GEN} = instance[pathRouteMethod];
            const app = server[apiMetaData.restricted ? 'restricted' : 'public'].router;
            const preMiddlewares = [];
            const postMiddlewares = [];
            if (useAuthentication && apiMetaData.authenticated) {
                preMiddlewares.push((req, res, next) => {
                    if (!req.isAuthenticated()) {
                        res.locals.error = { status: 403, message: 'Not Authenticated' };
                        if (apiMetaData.unAuthRedirect) {
                            res.status(res.locals.error.status);
                            if (res.locals.type === 'html') {
                                res.redirect('/login');
                            }
                            else {
                                res.json(res.locals.error);
                            }
                        }
                        return next('route');
                    }
                    if (apiMetaData.roles.length > 0) {
                        if (req.user.roles.length === 0) {
                            return next('route');
                        }
                        return next(apiMetaData.isAuthorized(req.user.roles) ? '' : 'route');
                    }
                    else {
                        return next();
                    }
                });
            }
            function addMiddleware(value, middlewareArray) {
                if (!value)
                    return;
                if (Array.isArray(value)) {
                    value.forEach((val) => {
                        middlewareArray.push((typeof val === 'string') ?
                            instance[val].bind(instance) :
                            val);
                    });
                }
                else {
                    middlewareArray.push((typeof value === 'string') ?
                        instance[value].bind(instance) :
                        value);
                }
            }
            addMiddleware(apiMetaData.preMiddlewares, preMiddlewares);
            addMiddleware(apiMetaData.postMiddlewares, postMiddlewares);
            const routes = rootRoute === '/' ? apiMetaData.paths : apiMetaData.paths.map((path) => `${rootRoute}${path}`);
            exports.paths.push({
                method: apiMetaData.method,
                ROUTE: apiMetaData.restricted ? routes.map((r) => `/n-admin${r}`) : routes,
                PATH: apiMetaData.paths,
                PRE_MIDDLE: preMiddlewares.length,
                POST_MIDDLE: postMiddlewares.length,
                PAGES: apiMetaData.pages,
                RESTRICTED: apiMetaData.restricted,
                AUTH: apiMetaData.authenticated,
                AUTH_REDIRECT: apiMetaData.unAuthRedirect,
                ROLES: apiMetaData.roles,
                function: pathRouteMethod,
            });
            // @ts-ignore
            app[apiMetaData.method](routes, preMiddlewares, wrapperMiddleware(instance[pathRouteMethod].bind(instance)), postMiddlewares);
        });
        // app.use(rootRoute, router);
    }
    return ctrls;
}
exports.bindControllers = bindControllers;
/**
 * Recursively (taking into account super classes) find names of the methods, that were decorated with given property, in a class.
 * @param clazz - target class
 * @param symbolKey - Symbol('string') which is used to define routes
 * @param foundMethodsNames - array of methods names found (useful when concatenating results of recursive search through superclasses)
 */
// @ts-ignore
function getClassMethodsByDecoratedProperty(clazz, symbolKey, foundMethodsNames = []) {
    const clazzMethods = foundMethodsNames.concat(Object.getOwnPropertyNames(clazz.prototype)
        .filter(functionName => functionName !== 'constructor')
        .filter(functionName => Reflect.getOwnMetadata(symbolKey, clazz.prototype[functionName]) !== undefined));
    const parentClazz = Object.getPrototypeOf(clazz);
    if (parentClazz.name !== '') {
        return getClassMethodsByDecoratedProperty(parentClazz, symbolKey, clazzMethods);
    }
    // returns an array of *unique* method names
    return clazzMethods.filter((methodName, index, array) => array.indexOf(methodName) === index);
}
/**
 * Send a warning to console and logs if authentication is not enabled
 * @param decorator - the name of the decorator
 * @param controller - controller that contains the function that was decorated
 * @param func - the function name that was decorated by an authentication related decorator
 */
function logWarningIfNoAuthentication(decorator, controller, func) {
    var _a;
    if (!config_1.getConfig().main.authentication.enabled) {
        Notores_1.SystemLogger.warn(`WARNING: Route Insecure. Use of @${decorator} in ${((_a = controller === null || controller === void 0 ? void 0 : controller.constructor) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown'}.${func} while authentication is disabled in notores.json`);
    }
}
exports.logWarningIfNoAuthentication = logWarningIfNoAuthentication;
/**
 * Send a warning to console and logs if authentication is not enabled
 * @param decorator - the name of the decorator
 * @param controller - controller that contains the function that was decorated
 * @param func - the function name that was decorated by an authentication related decorator
 */
function logErrorApiMetaDataDoesNotExist(decorator, controller, func) {
    var _a;
    if (!config_1.getConfig().main.authentication.enabled) {
        Notores_1.SystemLogger.error(`ERROR: Route does not have an HTTP handle. Use of @${decorator} in ${((_a = controller === null || controller === void 0 ? void 0 : controller.constructor) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown'}.${func}. Try using one of ${Object.keys(ApiMetaData_1.HttpMethod).map((method) => `@${method}`)}`);
    }
}
exports.logErrorApiMetaDataDoesNotExist = logErrorApiMetaDataDoesNotExist;
