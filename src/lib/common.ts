import fs from "fs";
import fetch from "node-fetch";
import { lastestMsgIdAddr } from "../../config/config.json";

export function writeFileSyncEx(filePath: string, data: string | Buffer, options?: fs.WriteFileOptions) {

    const pathPart = filePath.split("/");
    pathPart.pop();

    if (fs.existsSync(pathPart.join("/"))) {
        fs.writeFileSync(filePath, data, options);

    } else {
        var _p = "";
        for (const [iv, _part] of pathPart.entries()) {
            //if (iv + 1 == pathPart.length) break;
            _p += `${_part}/`;
            if (fs.existsSync(_p)) continue;
            else fs.mkdirSync(_p);
        }
        writeFileSyncEx(filePath, data, options);
    }
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cacheJson<T>(opt: "w" | "r", app: string, data?: T): T | boolean | null {
    const jsonPath = `${global._path}/generate/cache/${app}.json`;
    try {
        if (opt == "r") {
            if (!fs.existsSync(jsonPath)) return null;
            const data = fs.readFileSync(jsonPath, { encoding: "utf8" });
            const json: T = JSON.parse(data);
            return json;
        } else {
            writeFileSyncEx(jsonPath, JSON.stringify(data), { encoding: "utf8" });
            return true;
        }
    } catch (error) {
        log.error(error);
        if (opt == "r") return null;
        else return false;
    }
}

export async function redisCache(type: "r" | "w", key: string, field: string, data?: string, expire?: number): Promise<string | null> {
    if (type == "r") {
        return await global.redis.hGet(key, field) || null;
    };
    if (type == "w") {
        global.redis.hSet(key, field, data!).then(() => {
            if (expire)
                global.redis.expire(key, expire);
        });

    }
    return null;
}

export const Format = {
    /**
     * string to number
     * @param d string
     * @returns number
     */
    int: (d: string): number => {
        return parseInt(d);
    },

    comma: (num: number, fix = 0) => {
        num = parseFloat((num * 1).toFixed(fix));
        let [integer, decimal] = num.toString().split('.');
        integer = integer.replace(/\d(?=(\d{3})+$)/g, '$&,');
        return `${integer}${decimal ? '.' + decimal : ''}`;
    },
    pct: (num: number, fix = 1) => {
        return num.toFixed(fix) + '%';
    },
    percent: (num: number, fix = 1) => {
        return Format.pct(num * 100, fix);
    }

}

export async function getLastestMsgId() {
    const msgId = await redis.get("lastestMsgId");
    if (msgId) return msgId;
    return fetch(lastestMsgIdAddr).then(res => {
        return res.buffer();
    }).then(buff => {
        return buff.toString();
    }).catch(err => {
        if (devEnv) log.error(String(err).split("\n")[0]);
        return null;
    })
}

export async function getAuthorConfig(aid: string, keys: string): Promise<string | undefined>;
export async function getAuthorConfig(aid: string, keys: (string | { k: string, r?: string, m?: boolean, d?: string })[]): Promise<{ [key: string]: string }>;
export async function getAuthorConfig(aid: string, keys: string | (string | { k: string, r?: string, m?: boolean, d?: string })[]): Promise<{ [key: string]: string } | string | undefined> {
    if (typeof keys == "string") return redis.hGet(`genshin:config:${aid}`, keys);

    const ret: { [key: string]: string } = {};
    const _keys: string[] = [];
    const _re: string[] = [];
    const _must: boolean[] = [];
    const _def: (null | string)[] = [];
    for (const key of keys) {
        _keys.push(typeof key == "string" ? key : key.k);
        _re.push(typeof key == "string" ? key : (key.r || key.k));
        _must.push(typeof key == "string" ? true : (key.m || true));
        _def.push(typeof key == "string" ? null : (key.d || null));
    }
    return redis.hmGet(`genshin:config:${aid}`, _keys).then(d => {
        for (const [i, v] of d.entries()) {
            if (!v && _must[i] && !_def[i]) throw `not found aid(${aid}) config: ${_keys[i]}`;
            else if (_def[i]) ret[_re[i]] = _def[i]!;
            else ret[_re[i]] = v;
        }
        return ret;
    });
}