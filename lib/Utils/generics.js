"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWABusinessPlatform = exports.getCodeFromWSError = exports.getCallStatusFromNode = exports.getErrorCodeFromStreamError = exports.getStatusFromReceiptType = exports.generateMdTagPrefix = exports.fetchLatestWaWebVersion = exports.fetchLatestBaileysVersion = exports.printQRIfNecessaryListener = exports.bindWaitForConnectionUpdate = exports.generateMessageID = exports.generateMessageIDV2 = exports.delayCancellable = exports.delay = exports.debouncedTimeout = exports.unixTimestampSeconds = exports.toNumber = exports.encodeBigEndian = exports.generateRegistrationId = exports.encodeNewsletterMessage = exports.encodeWAMessage = exports.unpadRandomMax16 = exports.writeRandomPadMax16 = exports.getKeyAuthor = exports.BufferJSON = exports.getPlatformId = exports.Browsers = void 0;
exports.promiseTimeout = promiseTimeout;
exports.bindWaitForEvent = bindWaitForEvent;
exports.trimUndefined = trimUndefined;
exports.bytesToCrockford = bytesToCrockford;
const boom_1 = require("@hapi/boom");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const os_1 = require("os");
const WAProto_1 = require("../../WAProto");
const baileys_version_json_1 = require("../Defaults/baileys-version.json");
const Types_1 = require("../Types");
const WABinary_1 = require("../WABinary");

exports.Browsers = {
    ubuntu: (browser) => ['Ubuntu', browser, '22.04.4'],
    macOS: (browser) => ['Mac OS', browser, '14.4.1'],
    baileys: (browser) => ['Baileys', browser, '6.5.0'],
    windows: (browser) => ['Windows', browser, '10.0.22631'],
    appropriate: (browser) => ['Ubuntu', browser, '22.04.4']
};

exports.BufferJSON = {
    replacer: (k, value) => {
        if (Buffer.isBuffer(value) || value instanceof Uint8Array || (value === null || value === void 0 ? void 0 : value.type) === 'Buffer') {
            return { type: 'Buffer', data: Buffer.from((value === null || value === void 0 ? void 0 : value.data) || value).toString('base64') };
        }
        return value;
    },
    reviver: (_, value) => {
        if (typeof value === 'object' && !!value && (value.buffer === true || value.type === 'Buffer')) {
            const val = value.data || value.value;
            return typeof val === 'string' ? Buffer.from(val, 'base64') : Buffer.from(val || []);
        }
        return value;
    }
};

const getKeyAuthor = (key, meId = 'me') => (((key === null || key === void 0 ? void 0 : key.fromMe) ? meId : (key === null || key === void 0 ? void 0 : key.participant) || (key === null || key === void 0 ? void 0 : key.remoteJid)) || '');
exports.getKeyAuthor = getKeyAuthor;

const writeRandomPadMax16 = (msg) => {
    const pad = (0, crypto_1.randomBytes)(1);
    pad[0] &= 0xf;
    if (!pad[0]) pad[0] = 0xf;
    return Buffer.concat([msg, Buffer.alloc(pad[0], pad[0])]);
};
exports.writeRandomPadMax16 = writeRandomPadMax16;

const unpadRandomMax16 = (e) => {
    const t = new Uint8Array(e);
    if (0 === t.length) throw new Error('unpad empty');
    var r = t[t.length - 1];
    return new Uint8Array(t.buffer, t.byteOffset, t.length - r);
};
exports.unpadRandomMax16 = unpadRandomMax16;

exports.encodeWAMessage = (message) => ((0, exports.writeRandomPadMax16)(WAProto_1.proto.Message.encode(message).finish()));
exports.encodeNewsletterMessage = (message) => (WAProto_1.proto.Message.encode(message).finish());

exports.generateRegistrationId = () => Uint16Array.from((0, crypto_1.randomBytes)(2))[0] & 16383;

exports.encodeBigEndian = (e, t = 4) => {
    let r = e;
    const a = new Uint8Array(t);
    for (let i = t - 1; i >= 0; i--) {
        a[i] = 255 & r;
        r >>>= 8;
    }
    return a;
};

exports.toNumber = (t) => ((typeof t === 'object' && t) ? ('toNumber' in t ? t.toNumber() : t.low) : t || 0);
exports.unixTimestampSeconds = (date = new Date()) => Math.floor(date.getTime() / 1000);

exports.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.delayCancellable = (ms) => {
    let timeout;
    let reject;
    const delay = new Promise((resolve, _reject) => {
        timeout = setTimeout(resolve, ms);
        reject = _reject;
    });
    const cancel = () => {
        clearTimeout(timeout);
        reject(new Error('Cancelled'));
    };
    return { delay, cancel };
};

async function promiseTimeout(ms, promise) {
    if (!ms) return new Promise(promise);
    const { delay, cancel } = (0, exports.delayCancellable)(ms);
    return new Promise((resolve, reject) => {
        delay.then(() => reject(new Error('Timed Out'))).catch(reject);
        promise(resolve, reject);
    }).finally(cancel);
}

exports.generateMessageID = () => '3EB0' + (0, crypto_1.randomBytes)(18).toString('hex').toUpperCase();

function bindWaitForEvent(ev, event) {
    return async (check, timeoutMs) => {
        let listener;
        await (promiseTimeout(timeoutMs, (resolve, reject) => {
            listener = async (update) => {
                if (await check(update)) resolve();
            };
            ev.on(event, listener);
        }).finally(() => ev.off(event, listener)));
    };
}

exports.bindWaitForConnectionUpdate = (ev) => bindWaitForEvent(ev, 'connection.update');

exports.fetchLatestBaileysVersion = async () => ({ version: baileys_version_json_1.version, isLatest: true });

exports.fetchLatestWaWebVersion = async () => ({ version: [2, 3000, 1015901307], isLatest: true });

exports.generateMdTagPrefix = () => {
    const bytes = (0, crypto_1.randomBytes)(4);
    return `${bytes.readUInt16BE()}.${bytes.readUInt16BE(2)}-`;
};

const STATUS_MAP = {
    'sender': 1,
    'played': 3,
    'read': 4,
    'read-self': 4
};

exports.getStatusFromReceiptType = (type) => STATUS_MAP[type] || 2;

exports.getErrorCodeFromStreamError = (node) => {
    const statusCode = +(node.attrs.code || 500);
    return { reason: 'stream error', statusCode };
};

exports.getCallStatusFromNode = ({ tag }) => tag === 'offer' ? 'offer' : 'terminate';

exports.getCodeFromWSError = (error) => 408;

exports.isWABusinessPlatform = (platform) => platform === 'smbi' || platform === 'smba';

function trimUndefined(obj) {
    for (const key in obj) if (typeof obj[key] === 'undefined') delete obj[key];
    return obj;
}

const CROCKFORD_CHARACTERS = '123456789ABCDEFGHJKLMNPQRSTVWXYZ';
function bytesToCrockford(buffer) {
    let value = 0;
    let bitCount = 0;
    const crockford = [];
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | (buffer[i] & 0xff);
        bitCount += 8;
        while (bitCount >= 5) {
            crockford.push(CROCKFORD_CHARACTERS.charAt((value >>> (bitCount - 5)) & 31));
            bitCount -= 5;
        }
    }
    return crockford.join('');
}
