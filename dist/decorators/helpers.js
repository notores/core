"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWarningIfNoAuthentication = exports.bindControllers = exports.paths = void 0;
require("reflect-metadata");
const constants_1 = require("../constants");
const path_1 = require("path");
const symbols_1 = require("../symbols");
const Api_1 = require("./Api");
const logger_1 = require("../lib/logger");
const config_1 = require("../lib/config");
const Notores_1 = require("../Notores");
const logger = logger_1.loggerFactory(module);
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
        const modulePath = Clazz[constants_1.MODULE_PATH];
        if (!rootRoute || !rootRoute.startsWith('/')) {
            // TODO test it
            throw new Error('Class-level \'@Root\' decorator must be used with single string argument starting with forward slash (eg. \'/\' or \'/myRoot\')!');
        }
        // @Use // DO THIS
        const middlewareDeclarationMethods = getClassMethodsByDecoratedProperty(Clazz, constants_1.MIDDLEWARE);
        middlewareDeclarationMethods.forEach(middlewareDeclarationMethod => {
            const { PATH_ROUTE, HTTP_METHOD, IS_PRE_MIDDLEWARE, IS_POST_MIDDLEWARE, PRIVATE, AUTH, ROLES } = instance[middlewareDeclarationMethod];
            const wrapperMiddleware = (routingFunction) => {
                return async (req, res, next) => {
                    if (useAuthentication && AUTH && !req.user) {
                        return next();
                    }
                    const result = await routingFunction(req, res, next);
                    if (result) {
                        let body;
                        if (typeof result === 'object') {
                            body = result;
                        }
                        else {
                            body = { [dataKey]: result };
                        }
                        res.locals.setBody(body);
                    }
                    next();
                };
            };
            const app = server[PRIVATE ? 'private' : 'public'];
            const mids = [];
            const midsObj = {
                method: 'use',
                ROUTE: PATH_ROUTE,
                PATH: '',
                WHERE: IS_PRE_MIDDLEWARE ? 'PRE ROUTES' : 'POST ROUTES',
                PRIVATE,
                AUTH,
                ROLES,
                function: middlewareDeclarationMethod,
            };
            if (midsObj.ROUTE && midsObj.ROUTE.toLowerCase() !== 'all') {
                mids.push(midsObj.ROUTE);
            }
            else {
                midsObj.ROUTE = 'ALL';
            }
            mids.push(wrapperMiddleware(instance[middlewareDeclarationMethod].bind(instance)));
            exports.paths.push(midsObj);
            if (IS_PRE_MIDDLEWARE) {
                app.preMiddleware.use(mids);
            }
            else {
                app.postMiddleware.use(mids);
            }
        });
        // @Path
        const pathRouteMethods = getClassMethodsByDecoratedProperty(Clazz, constants_1.HTTP_METHOD);
        pathRouteMethods.forEach(pathRouteMethod => {
            const { PATH_ROUTE, HTTP_METHOD, PRE_MIDDLEWARE, POST_MIDDLEWARE, PRIVATE, AUTH, AUTH_REDIRECT, ROLES, PAGE_GEN } = instance[pathRouteMethod];
            const wrapperMiddleware = (routingFunction) => {
                return async (req, res, next) => {
                    var _a;
                    const params = [];
                    let existingApiDecorators = (_a = Reflect.getOwnMetadata(symbols_1.apiParameterMetadataKey, instance[pathRouteMethod])) !== null && _a !== void 0 ? _a : [];
                    existingApiDecorators.forEach((d) => {
                        let obj;
                        switch (d.type) {
                            case 'request':
                                obj = req;
                                break;
                            case 'response':
                                obj = res;
                                break;
                            case 'next':
                                obj = next;
                                break;
                            case 'config':
                                obj = req.notores;
                                break;
                            case 'body':
                                obj = req.body;
                                break;
                            case 'user':
                                obj = req.user;
                                break;
                            case 'query':
                                obj = req.query;
                                break;
                            case 'params':
                                obj = req.params;
                                break;
                            case 'param':
                                let val = req.params[d.data.key];
                                if (d.data.type) {
                                    switch (d.data.type) {
                                        case Api_1.ParamTypes.int:
                                        case Api_1.ParamTypes.integer:
                                            val = parseInt(val);
                                            break;
                                        case Api_1.ParamTypes.float:
                                            val = parseFloat(val);
                                            break;
                                        case Api_1.ParamTypes.bool:
                                        case Api_1.ParamTypes.boolean:
                                            val = !!val;
                                            break;
                                    }
                                }
                                obj = val;
                        }
                        params[d.index] = obj;
                    });
                    params.push(req);
                    params.push(res);
                    params.push(next);
                    const result = await routingFunction(...params);
                    let body;
                    if (result === null || result === undefined) {
                        return next();
                    }
                    if (typeof result === 'object' && !Array.isArray(result) && result.hasOwnProperty(dataKey)) {
                        body = result;
                    }
                    else if (result instanceof Error) {
                        body = { error: result.message };
                    }
                    else {
                        body = { [dataKey]: result };
                    }
                    if (PAGE_GEN) {
                        res.locals.addPageLocations([
                            path_1.join(modulePath, 'pages')
                        ]);
                        res.locals.addPages(PAGE_GEN);
                    }
                    res.locals.setBody(body);
                    next();
                };
            };
            // const {PATH_ROUTE, HTTP_METHOD, PRE_MIDDLEWARE, POST_MIDDLEWARE, PRIVATE, AUTH, AUTH_REDIRECT, ROLES, PAGE_GEN} = instance[pathRouteMethod];
            const app = server[PRIVATE ? 'private' : 'public'].router;
            const preMiddlewares = [];
            const postMiddlewares = [];
            if (useAuthentication && AUTH) {
                preMiddlewares.push((req, res, next) => {
                    if (!req.isAuthenticated()) {
                        res.locals.error = { status: 403, message: 'Not Authenticated' };
                        if (AUTH_REDIRECT) {
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
                    if (Array.isArray(ROLES) && ROLES.length > 0) {
                        if (req.user.roles.length === 0) {
                            return next('route');
                        }
                        for (let i = 0; i < ROLES.length; i++) {
                            const role = ROLES[i];
                            for (let i = 0; i < req.user.roles.length; i++) {
                                const r = req.user.roles[i];
                                const userRole = typeof r === 'string' ? r : r.role;
                                if (userRole[i].toLowerCase() === role.toLowerCase()) {
                                    return next();
                                }
                            }
                        }
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
            addMiddleware(PRE_MIDDLEWARE, preMiddlewares);
            addMiddleware(POST_MIDDLEWARE, postMiddlewares);
            const route = rootRoute === '/' ? PATH_ROUTE : rootRoute + PATH_ROUTE;
            exports.paths.push({
                method: HTTP_METHOD,
                ROUTE: route,
                PATH: PATH_ROUTE,
                PRE_MIDLE: preMiddlewares.length,
                POST_MIDDLE: postMiddlewares.length,
                PAGE: PAGE_GEN,
                PRIVATE,
                AUTH,
                AUTH_REDIRECT,
                ROLES,
                function: pathRouteMethod,
            });
            // @ts-ignore
            app[HTTP_METHOD](route, preMiddlewares, wrapperMiddleware(instance[pathRouteMethod].bind(instance)), postMiddlewares);
        });
        // app.use(rootRoute, router);
    }
    return ctrls;
}
exports.bindControllers = bindControllers;
/**
 * Recursively (taking into account super classes) find names of the methods, that were decorated with given property, in a class.
 * @param clazz - target class
 * @param decoratedPropertyName - name of the property known to be added by decorator, eg. 'ROOT_ROUTE'
 * @param foundMethodsNames - array of methods names found (useful when concatenating results of recursive search through superclasses)
 */
// @ts-ignore
function getClassMethodsByDecoratedProperty(clazz, decoratedPropertyName, foundMethodsNames = []) {
    const clazzMethods = foundMethodsNames.concat(Object.getOwnPropertyNames(clazz.prototype)
        .filter(functionName => functionName !== 'constructor')
        .filter(functionName => clazz.prototype[functionName][decoratedPropertyName] !== undefined));
    const parentClazz = Object.getPrototypeOf(clazz);
    if (parentClazz.name !== '') {
        return getClassMethodsByDecoratedProperty(parentClazz, decoratedPropertyName, clazzMethods);
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
