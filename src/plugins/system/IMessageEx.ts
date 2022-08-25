import fs from "fs";
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Ark, Embed, IMember, IMessage, IUser, MessageAttachment } from "qq-guild-bot";
import config from '../../../data/config.json';
import log from './logger';




export class IMessageEx implements IMessage {
    id: string;
    channel_id: string;
    guild_id: string;
    content: string;
    timestamp: string;
    edited_timestamp: string;
    mention_everyone: boolean;
    author: IUser;
    member: IMember;
    attachments: MessageAttachment[];
    embeds: Embed[];
    mentions: IUser[];
    ark: Ark;
    seq?: number;
    seq_in_channel?: string;

    guild_name?: string;
    channel_name?: string;
    messageType: "DIRECT" | "GUILD";

    constructor(msg: IMessage, messageType: "DIRECT" | "GUILD") {
        this.id = msg.id;
        this.channel_id = msg.channel_id;
        this.guild_id = msg.guild_id;
        this.content = msg.content;
        this.timestamp = msg.timestamp;
        this.edited_timestamp = msg.edited_timestamp;
        this.mention_everyone = msg.mention_everyone;
        this.author = msg.author;
        this.member = msg.member;
        this.attachments = msg.attachments;
        this.embeds = msg.embeds;
        this.mentions = msg.mentions;
        this.ark = msg.ark;
        this.seq = msg.seq;
        this.seq_in_channel = msg.seq_in_channel;

        this.messageType = messageType;
    }

    async sendMsgEx(option: SendMsgOption) {
        const { ref, imagePath, content } = option;
        const { id, guild_id, channel_id } = this;
        if (imagePath) {
            var pushUrl =
                this.messageType == "DIRECT" ?
                    `https://api.sgroup.qq.com/dms/${guild_id}/messages` :
                    `https://api.sgroup.qq.com/channels/${channel_id}/messages`;
            const formdata = new FormData();
            formdata.append("msg_id", id);
            if (content) formdata.append("content", content);
            formdata.append("file_image", fs.createReadStream(imagePath));
            return fetch(pushUrl, {
                method: "POST",
                headers: {
                    "Content-Type": formdata.getHeaders()["content-type"],
                    "Authorization": `Bot ${config.initConfig.appID}.${config.initConfig.token}`,
                }, body: formdata
            }).then(res => { return res.json(); }).then(body => {
                if (body.code) log.error(body);
                return body;
            }).catch(error => {
                log.error(error);
            });
        } else {
            if (this.messageType == "GUILD") {
                return global.client.messageApi.postMessage(channel_id, {
                    content: content,
                    msg_id: id,
                    message_reference: ref ? { message_id: id, } : undefined
                });
            } else {
                return global.client.directMessageApi.postDirectMessage(guild_id, {
                    msg_id: id,
                    content: content,
                });
            }
        }
    }
}


interface SendMsgOption {
    ref?: boolean,
    imagePath?: string,
    content?: string,
}