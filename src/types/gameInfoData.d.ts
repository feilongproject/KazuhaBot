interface ShowAvatarInfoList {
    avatarId: number;
    level: number;
}

interface EquipList {
    itemId: number;
    reliquary?: {
        level: number;
        mainPropId: number;
        appendPropIdList: number[];
    };
    weapon?: {
        level: number;
        promoteLevel: number;
        affixMap: {
            [key: string]: number;
        };
    };
    flat: {
        nameTextMapHash: string;
        setNameTextMapHash?: string;
        rankLevel: number;
        reliquaryMainstat?: {
            mainPropId: string;
            statValue: number;
        };
        reliquarySubstats?: {
            appendPropId: string;
            statValue: number;
        }[];
        weaponStats?: {
            appendPropId: string;
            statValue: number;
        }[];
        itemType: string;
        icon: string;
        equipType?: string;
    };
}

interface AvatarMetaInfo {
    dataSource: "enka" | "input";
    proudSkillExtraLevelMap: {};
    avatarId: number;
    propMap: {
        [id: number]: {
            type: number;
            ival?: string;
            val: string;
        }
    };
    talentIdList?: number[];
    fightPropMap: {
        [key: string]: number;
    };
    skillDepotId: number;
    inherentProudSkillList: number[];
    skillLevelMap: {
        [key: number]: number;
    };
    equipList: EquipList[];
    fetterInfo: {
        expLevel: number;
    };
}

export interface GameInfoData {
    ttl: number;
    playerInfo: {
        nickname: string;
        level: number;
        signature: string;
        worldLevel: number;
        nameCardId: number;
        finishAchievementNum: number;
        towerFloorIndex: number;
        towerLevelIndex: number;
        showAvatarInfoList: ShowAvatarInfoList[];
        showNameCardIdList: number[];
        profilePicture: {
            avatarId: number;
        };
    };
    avatarInfoList: AvatarMetaInfo[];
}