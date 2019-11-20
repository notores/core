import {Request, Response, NextFunction, Application} from 'express';
import {IRouter} from "express-serve-static-core";

declare global {
    namespace Notores {
        interface INotoresConfig {
            error: string;
            main: {
                useCookie: boolean,
                authentication: {
                    usernameField: string;
                    saltRounds: number;
                };
                jwt: {
                    secretOrKey: string;
                    issuer: string;
                    audience: string;
                };
            };
        }

        interface ISessionObject {
        }

        interface IAuthenticatedUser {
            roles: string[];
        }

        interface IAuthenticatedRequest extends Request {
            user: Notores.IAuthenticatedUser;
        }
    }
}

export interface IErrorObject {
    error: string;
}

export interface IDefaultConfigObject {
    key: string;
    value: object;
}

export interface IServer {
    main: Application;
    preMiddleware: Application;
    public: {
        main: Application;
        preMiddleware: Application;
        router: IRouter;
        postMiddleware: Application;
    };
    private: {
        main: Application;
        preMiddleware: Application;
        router: IRouter;
        postMiddleware: Application;
    };
}

export interface ICheckInputObject {
    key: string;
    type: Object;
}

declare global {
    namespace Express {
        interface Request {
            user?: Notores.IAuthenticatedUser;
            isAuthenticated: IsAuthenticatedFunction;
            notores: Notores.INotoresConfig;
            session: ISessionObject;
            login: Function;
        }
    }
}

export interface ISessionObject {
    id: string;
}

export declare const enum ParamsOrBodyEnum {
    params = "params",
    body = "body"
}

export declare const enum MiddlewareForRouterLevelEnum {
    public = "public",
    private = "private",
    main = "main"
}

export interface IRouteWithHandleSettings {
    method?: string;
    accepts?: string[];
    authenticated?: Boolean;
    admin?: Boolean;
    roles?: string[];
}

export interface IMiddlewareForRouterSettings {
    when?: string;
    accepts?: string[];
    path?: string;
    level?: MiddlewareForRouterLevelEnum;
}

export interface IRouteRegistryObject {
    handle: string;
    path: string;
    method: string;
    active: Boolean;
}

export declare type IsAuthenticatedFunction = () => Boolean;
export declare type AuthenticatedMiddlewareFunction = (req: Notores.IAuthenticatedRequest , res: Response, next: NextFunction) => Promise<any> | void;
export declare type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => Promise<any> | void;