import 'reflect-metadata'
import {DATA_KEY, IGNORE_DATA_KEY, MODULE_PATH, ROOT_ROUTE} from '../constants';
import {NotoresApplication} from "../Notores";
import {repositoryMetadataKey} from "../symbols";
import { ModuleDecoratorOptions } from '../interfaces/ModuleDecoratorOptions';

export function Module(settings?: ModuleDecoratorOptions | string): ClassDecorator {
    return function (target: any) {
        const filePath = getFilePath();
        Reflect.defineMetadata(repositoryMetadataKey, [], target);

        if (typeof settings === 'string') {
            settings = {
                prefix: settings,
            }
        }

        let dataKey: string = target.name.indexOf('Module') > -1 ? target.name.replace('Module', '') : target.name;

        if (!settings || typeof settings === 'string') {
            settings = {
                prefix: settings || '/',
                dataKey,
                table: [],
                responseAsBody: false,
            }
        } else {
            settings = {
                prefix: '/',
                dataKey,
                table: [],
                ...settings,
            };

            if (settings.entity) {
                NotoresApplication.entities.push(settings.entity);
                target.prototype.entity = settings.entity;
            }
            if(settings.entities) {
                NotoresApplication.entities.push(...settings.entities);
            }
            if(settings.repository) {
                NotoresApplication.repositories.push(settings.repository);
                target.prototype.repoClazz = settings.repository;
                target.prototype.repository = new settings.repository();
            }
        }

        target[ROOT_ROUTE] = settings?.prefix?.startsWith('/') ? settings.prefix : `/${settings.prefix}`;
        target[DATA_KEY] = settings.dataKey;
        target[IGNORE_DATA_KEY] = settings.responseAsBody;
        target[MODULE_PATH] = filePath;
    }
}

function getFilePath() {
    const err = new Error();
    const stack = err.stack;
    const stackArr = stack!.split('\n');
    stackArr.shift();
    let filePathStringStack = '';
    for (let str of stackArr) {
        if (str.includes('__decorate')) {
            filePathStringStack = str;
        }
    }
    const filePathStr = /\(.*\)/im[Symbol.match](filePathStringStack)![0];
    // @ts-ignore
    const fileStrArr = new RegExp(/(\/[a-z-.]+)/gim)[Symbol.match](filePathStr);
    fileStrArr!.pop();

    return fileStrArr!.join('');
}
