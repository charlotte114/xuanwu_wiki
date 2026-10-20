// 由 scripts/build-wiki-dungeons-data.py 生成，请勿手改。
window.MAP_DUNGEON_HUALUNJIAN = {
  "placeId": "华山论剑",
  "title": "华山论剑掉落 · 机制详解",
  "note": "红色为唯一掉落（攻略标注）；飘字概率为攻略整理，武功与攻击取自 doc.json。",
  "dungeonKind": "hualunjian",
  "sections": [
    {
      "title": "五绝论剑",
      "bosses": [
        {
          "order": 1,
          "boss": "桃花岛主（东邪）",
          "fighters": [
            {
              "name": "桃花岛主",
              "npcId": 91000,
              "hp": 400000,
              "power": 25000,
              "skill": "碧海潮生曲",
              "skillId": 203204
            }
          ],
          "textDrop": "玉竹箫 5%",
          "mechanic": "奇门遁甲：共 30 层护盾，每层护盾抵御最多 2000 点伤害。",
          "hideChest": true
        },
        {
          "order": 2,
          "boss": "白驼庄主（西毒）",
          "fighters": [
            {
              "name": "白驼庄主",
              "npcId": 91009,
              "hp": 500000,
              "power": 26000,
              "skill": "蛤蟆功",
              "skillId": 3060
            }
          ],
          "textDrop": "寒玉戒指 5%",
          "mechanic": "蟾压百雄：入场后彼方全体吸血效果削弱 30%。",
          "hideChest": true
        },
        {
          "order": 3,
          "boss": "大理皇僧（南帝）",
          "fighters": [
            {
              "name": "大理皇僧",
              "npcId": 91017,
              "hp": 300000,
              "power": 30000,
              "skill": "大梵天指",
              "skillId": 3064
            }
          ],
          "textDrop": "一阳指 5%",
          "mechanic": "梵天无证：每次受到伤害（包括 buff 损失的生命值）最多 2000 点。",
          "hideChest": true
        },
        {
          "order": 4,
          "boss": "九指奇丐（北丐）",
          "fighters": [
            {
              "name": "九指奇丐",
              "npcId": 91025,
              "hp": 400000,
              "power": 30000,
              "skill": "降龙掌法",
              "skillId": 3011
            }
          ],
          "textDrop": "降龙掌法 5%",
          "mechanic": "逍遥游龙：每次出手必定附加一层横练护体功效果，将第 1 次受到的伤害减免为 0，但不减免多段的武学。",
          "hideChest": true
        },
        {
          "order": 5,
          "boss": "铁掌帮 裘铁（铁掌）",
          "fighters": [
            {
              "name": "铁掌帮 裘铁",
              "npcId": 91027,
              "hp": 250000,
              "power": 17500,
              "skill": "铁掌功",
              "skillId": 3013
            }
          ],
          "textDrop": "铁掌功 60%",
          "mechanic": "壁立千仞：免疫负面状态的同时，受到攻击有 10% 概率进行反击。",
          "hideChest": true
        },
        {
          "order": 6,
          "boss": "神通道人（中神通）",
          "fighters": [
            {
              "name": "神通道人",
              "npcId": 91091,
              "hp": 400000,
              "power": 35000,
              "skill": "全真剑法",
              "skillId": 203100
            }
          ],
          "textDrop": "先天功 5%",
          "mechanic": "天罡北斗：出手附带 40 破甲，可减去彼方 40 免伤，溢出则按 0 计算；第 5 波以单体形态进入天罡北斗七星体状态，该状态下以北斗七星进行 7 次入场，血量上限依次递增，且每场回复约 13 万血量。",
          "hideChest": true
        }
      ]
    }
  ]
};
