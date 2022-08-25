import fnc from "../../../data/opts.json";
import log from "./logger";


export async function findOpts(optStr: string): Promise<string> {


    for (let i = 0; i < fnc.length; i++) {
        const opt = fnc[i];
        //log.debug(optStr, RegExp(opt.reg), optStr.match(RegExp(opt.reg)));
        if (RegExp(opt.reg).test(optStr)) {
            return opt.fnc;
        };
    }

    return "err";
}