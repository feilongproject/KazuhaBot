
export async function findOpts(optStr: string): Promise<{ path: string; fnc: string; }> {
    const fnc = await import("../../config/opts.json");

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
                return {
                    path: mainKey,
                    fnc: opt.fnc,

                };
            };
        }
    }


    return {
        path: "err",
        fnc: "err",
    };
}