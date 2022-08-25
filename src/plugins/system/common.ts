import fs from "fs";
import log from "./logger";

const _path = process.cwd();



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
    const jsonPath = `${_path}/generate/cache/${app}.json`;
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


/* 
let Format = {
  comma: function (num, fix = 0) {
    num = parseFloat((num * 1).toFixed(fix))
    let [integer, decimal] = String.prototype.split.call(num, '.')
    integer = integer.replace(/\d(?=(\d{3})+$)/g, '$&,') // 正则先行断言
    return `${integer}${decimal ? '.' + decimal : ''}`
  },
  pct: function (num, fix = 1) {
    return (num * 1).toFixed(fix) + '%'
  },
  percent: function (num, fix = 1) {
    return Format.pct(num * 100, fix)
  }
}

export default Format

*/