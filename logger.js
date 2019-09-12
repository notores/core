"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { createLogger, format, transports } = require('winston');
const path = require('path');
const moment = require('moment');
const { combine, timestamp, label, printf } = format;
const getLabel = function (callingModule) {
    const parts = callingModule.filename.split(path.sep);
    return path.join(parts[parts.length - 2], parts.pop());
};
const myFormat = printf((info) => {
    return `${moment(info.timestamp).format('YYYY-MM-DD HH:mm:sss')} [${info.label}] ${info.level}: ${info.message}`;
});
function newLogger(callingModule) {
    return createLogger({
        format: combine(label({ label: getLabel(callingModule) }), timestamp(), myFormat),
        transports: [
            new transports.Console(),
            new transports.File({ filename: 'logs/error.log', level: 'error' }),
            new transports.File({ filename: 'logs/info.log', level: 'info' }),
            new transports.File({ filename: 'logs/warn.log', level: 'warn' }),
            new transports.File({ filename: 'logs/notores.log' }),
        ]
    });
}
exports.default = newLogger;
