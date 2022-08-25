import lodash from "lodash";
import md5 from "md5";

export function getHeaders(query = '', body = '', sign = false) {
    if (sign) return {
        'x-rpc-app_version': '2.3.0',
        'x-rpc-client_type': "5",
        'x-rpc-device_id': getGuid(),
        'User-Agent': ' miHoYoBBS/2.3.0',
        "DS": getDsSign(),
    }
    else return {
        'x-rpc-app_version': '2.26.1',
        'x-rpc-client_type': 5,
        "DS": getDs(query, body),
    }
}
/* 
function getHeaders(q = "", b = "") {
  let headers = {
    "x-rpc-app_version": "2.26.1",
    "x-rpc-client_type": 5,
    DS: getDs(q, b),
  };

  return headers;
}

function getHeaders_sign() {
  let headers = {
    "x-rpc-app_version": "2.3.0",
    "x-rpc-client_type": 5,
    "x-rpc-device_id": guid(),
    "User-Agent": " miHoYoBBS/2.3.0",
    DS: getDS_sign(),
  };

  return headers;
} */
function getGuid() {
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return (S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4());
}

function getDsSign() {
    const n = 'h8w582wxwgqvahcdkpvdhbh2w9casgfl';
    const t = Math.round(new Date().getTime() / 1000);
    const r = lodash.sampleSize('abcdefghijklmnopqrstuvwxyz0123456789', 6).join('');
    const DS = md5(`salt=${n}&t=${t}&r=${r}`);
    return `${t},${r},${DS}`;
}

function getDs(q = '', b = '') {
    let n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    let t = Math.round(new Date().getTime() / 1000);
    let r = Math.floor(Math.random() * 900000 + 100000);
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`);
    return `${t},${r},${DS}`;
}