import fs from "fs";

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
