"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Module = void 0;
require("reflect-metadata");
const constants_1 = require("../constants");
const Notores_1 = require("../Notores");
const symbols_1 = require("../symbols");
function Module(settings) {
    return function (target) {
        var _a;
        const filePath = getFilePath();
        Reflect.defineMetadata(symbols_1.repositoryMetadataKey, [], target);
        if (typeof settings === 'string') {
            settings = {
                prefix: settings,
            };
        }
        let dataKey = target.name.indexOf('Module') > -1 ? target.name.replace('Module', '') : target.name;
        if (!settings || typeof settings === 'string') {
            settings = {
                prefix: settings || '/',
                dataKey,
                table: [],
                responseAsBody: false,
            };
        }
        else {
            settings = {
                prefix: '/',
                dataKey,
                table: [],
                ...settings,
            };
            if (settings.entity) {
                Notores_1.NotoresApplication.entities.push(settings.entity);
                target.prototype.entity = settings.entity;
            }
            if (settings.entities) {
                Notores_1.NotoresApplication.entities.push(...settings.entities);
            }
            if (settings.repository) {
                Notores_1.NotoresApplication.repositories.push(settings.repository);
                target.prototype.repoClazz = settings.repository;
                target.prototype.repository = new settings.repository();
            }
        }
        target[constants_1.ROOT_ROUTE] = ((_a = settings === null || settings === void 0 ? void 0 : settings.prefix) === null || _a === void 0 ? void 0 : _a.startsWith('/')) ? settings.prefix : `/${settings.prefix}`;
        target[constants_1.DATA_KEY] = settings.dataKey;
        target[constants_1.IGNORE_DATA_KEY] = settings.responseAsBody;
        target[constants_1.MODULE_PATH] = filePath;
    };
}
exports.Module = Module;
function getFilePath() {
    const err = new Error();
    const stack = err.stack;
    const stackArr = stack.split('\n');
    stackArr.shift();
    let filePathStringStack = '';
    for (let str of stackArr) {
        if (str.includes('__decorate')) {
            filePathStringStack = str;
        }
    }
    const filePathStr = /\(.*\)/im[Symbol.match](filePathStringStack)[0];
    // @ts-ignore
    const fileStrArr = new RegExp(/(\/[a-z-.]+)/gim)[Symbol.match](filePathStr);
    fileStrArr.pop();
    return fileStrArr.join('');
}
