import fnc from "../../../data/opts.json";
import log from "./logger";


export async function findOpts(optStr: string): Promise<string> {

    const command: {
        [mainKey: string]: {
            [key: string]: {
                reg: string;
                fnc: string;
                describe: string;
            }
        }
    } = fnc.command;

    for (const mainKey in command) {
        for (const key in command[mainKey]) {
            const opt = command[mainKey][key];
            if (RegExp(opt.reg).test(optStr)) {
                return opt.fnc;
            };
        }
    }


    return "err";
}