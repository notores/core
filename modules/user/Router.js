"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../../logger");
const logger = logger_1.initLogger(module);
class UserRouter {
    static getModel() {
        return UserRouter.getModelWrapper().model;
    }
    static getModelWrapper() {
        return require('./models/user');
    }
    static createJwt(req) {
        const config = req.notores;
        const jwtOptions = { ...config.main.jwt };
        delete jwtOptions.secretOrKey;
        return jsonwebtoken_1.default.sign({ id: req.user.id }, config.main.jwt.secretOrKey, jwtOptions);
    }
    static login(req, res, next) {
        const jwtString = UserRouter.createJwt(req);
        req.session.jwt = jwtString;
        req.session.id = req.user.id;
        res.locals.setBody({ user: req.user, jwt: jwtString });
        return next();
    }
    static async verifyEmailExists(req, res, next) {
        const UserModel = UserRouter.getModel();
        const result = await UserModel.countDocuments({ email: req.params.email });
        res.locals.setBody({ user: result });
        return next();
    }
    static async register(req, res, next) {
        const body = req.body;
        if (!body) {
            res.locals.setBody({ error: 'No info supplied' });
            return next();
        }
        if (body.password !== body.repeatPassword) {
            res.locals.setBody({ error: 'Passwords do not match' });
            return next();
        }
        const model = UserRouter.getModel();
        const user = await model.register(req.body);
        if (user.error) {
            res.locals.setBody({ error: user.error });
            return next();
        }
        if (user.id) {
            return req.login(user, () => {
                const jwtString = UserRouter.createJwt(req);
                res.locals.setBody({ user, jwt: jwtString });
                return next();
            });
        }
    }
    static logout(req, res, next) {
        req.logout();
        if (res.locals.type === 'html')
            return res.redirect('/');
        res.locals.setBody({ message: 'Logged out' });
        next();
    }
    static async getProfile(req, res, next) {
        res.locals.setBody({ user: req.user });
        next();
    }
    static async get(req, res, next) {
        const Wrapper = UserRouter.getModelWrapper();
        const model = Wrapper.model;
        const result = await model.find().select(Wrapper.whitelist.get).exec();
        res.locals.setBody({ user: result });
        next();
    }
    static async post(req, res, next) {
        next();
    }
    static async getById(rreq, res, next) {
        next();
    }
    static async patch(req, res, next) {
        const body = req.body;
        const user = await UserRouter.getModel().findById(req.user.id);
        const verifyPassword = await user.verifyPassword(body.password);
        if (verifyPassword.error) {
            res.locals.setBody(verifyPassword);
            return next();
        }
        delete body.password;
        delete body.repeatPassword;
        Object.assign(user, body);
        try {
            await user.save();
            const sessionUser = await UserRouter.getModel().getUserById(req.user.id);
            req.user = sessionUser;
            res.locals.setBody({ user: sessionUser });
        }
        catch (e) {
            logger.error(`Error in updating user "${e.message}"`);
            res.locals.setBody({ error: 'Something went wrong updating info' });
        }
        finally {
            next();
        }
    }
    static async delete(req, res, next) {
        next();
    }
}
module.exports = UserRouter;
