// 由 scripts/build-wiki-dungeons-data.py 生成，请勿手改。
window.MAP_DUNGEON_WULONG = {
  "placeId": "五龙塔",
  "title": "五龙塔掉落大全",
  "note": "红色为唯一、蓝色为任务道具（攻略表）；武功、攻击取自 doc.json。总经验约 3,759,800。",
  "footnotes": [
    "凑齐绿心石、蓝月石、赤血石后，在击败赢荒处搜寻三次，镶嵌三石可开启第三层。",
    "A 级紫金装备（名称带 A 后缀）可无限掉落。",
    "获得定秦剑后，前往泰山东南找道士触发任务，完成后可得传国玉玺（+19% 气血、+19% 暴击率）。"
  ],
  "dungeonKind": "wulong",
  "sections": [
    {
      "title": "第一层",
      "bosses": [
        {
          "order": 1,
          "boss": "古天音",
          "fighters": [
            {
              "name": "琴武双绝 古天音",
              "npcId": 13010,
              "hp": 74480,
              "power": 8850,
              "skill": "游龙剑法",
              "skillId": 3136
            }
          ],
          "waves": "4波20人",
          "chestDrop": "无",
          "textDrop": "天音腕S 37%、玉箫剑法 50%",
          "exp": "143000",
          "weaken": "音律 120 及以上"
        },
        {
          "order": 2,
          "boss": "拘魂老祖",
          "fighters": [
            {
              "name": "拘魂老祖",
              "npcId": 13020,
              "hp": 77980,
              "power": 9220,
              "skill": "寒冰神掌",
              "skillId": 3027
            }
          ],
          "waves": "4波20人",
          "chestDrop": "燃木残页 10%",
          "textDrop": "分筋错骨手 15%",
          "exp": "171600",
          "weaken": "主角职业专属技能 300"
        },
        {
          "order": 3,
          "boss": "中原大侠秦漠",
          "fighters": [
            {
              "name": "中原大侠 秦漠",
              "npcId": 13030,
              "hp": 80794,
              "power": 9420,
              "skill": "降魔刀法",
              "skillId": 3215
            }
          ],
          "waves": "4波20人",
          "chestDrop": "紫金戒指A 37%",
          "textDrop": "绿心石 37%、浩然正气诀 15%",
          "exp": "205400",
          "weaken": "浩然之气 300"
        },
        {
          "order": 4,
          "boss": "林豪 / 林东",
          "fighters": [
            {
              "name": "酒仙 叶豪",
              "npcId": 13041,
              "hp": 86100,
              "power": 9620,
              "skill": "醉梦神拳",
              "skillId": 3043
            },
            {
              "name": "酒仙 林东",
              "npcId": 13040,
              "hp": 86093,
              "power": 9630,
              "skill": "醉梦神拳",
              "skillId": 3043
            }
          ],
          "waves": "4波20人",
          "chestDrop": "无",
          "textDrop": "酒葫芦 30%、醉梦神拳S整本 10%",
          "exp": "494000",
          "weaken": "烧刀子、女儿红各 1 瓶放背包（不消耗）"
        },
        {
          "order": 5,
          "boss": "刹帝利",
          "fighters": [
            {
              "name": "佛陀转世 刹帝利",
              "npcId": 13050,
              "hp": 91000,
              "power": 9830,
              "skill": "定珠降魔神功",
              "skillId": 3031
            }
          ],
          "waves": "4波20人",
          "chestDrop": "归元衫A 10%",
          "textDrop": "大智无定指 15%",
          "exp": "296400",
          "weaken": "佛法 300"
        }
      ]
    },
    {
      "title": "第二层",
      "bosses": [
        {
          "order": 6,
          "boss": "徐舒明",
          "fighters": [
            {
              "name": "儒圣 徐舒明",
              "npcId": 13060,
              "hp": 94920,
              "power": 9830,
              "skill": "无极玄功拳",
              "skillId": 3040
            }
          ],
          "waves": "4波20人",
          "chestDrop": "真武残页 10%",
          "textDrop": "蓝月石 37%、齐鲁五轮拳 20%",
          "exp": "354900",
          "weaken": "文房四宝 1 个（会消耗）"
        },
        {
          "order": 7,
          "boss": "葛无道",
          "fighters": [
            {
              "name": "金刚不败 葛无道",
              "npcId": 13070,
              "hp": 99900,
              "power": 7030,
              "skill": "九霄惊雷刀法",
              "skillId": 3223
            }
          ],
          "waves": "4波20人",
          "chestDrop": "玄铁护腕A 37%",
          "textDrop": "绝情 5%",
          "exp": "426920",
          "weaken": "道法 300"
        },
        {
          "order": 8,
          "boss": "苗青霜",
          "fighters": [
            {
              "name": "南疆刀圣 苗青霜",
              "npcId": 13080,
              "hp": 104800,
              "power": 7180,
              "skill": "太虚神悟刀",
              "skillId": 3211
            }
          ],
          "waves": "4波20人",
          "chestDrop": "修罗刀A 37%",
          "textDrop": "神霄 1%、修罗刀图纸 100%",
          "exp": "499920",
          "weaken": "无"
        },
        {
          "order": 9,
          "boss": "赢荒",
          "fighters": [
            {
              "name": "始皇后人 嬴荒",
              "npcId": 13090,
              "hp": 110900,
              "power": 7330,
              "skill": "独孤剑诀",
              "skillId": 3110
            }
          ],
          "waves": "4波20人",
          "chestDrop": "降龙残页 10%",
          "textDrop": "赤血石 37%、定秦剑 100%",
          "exp": "549900",
          "weaken": "无"
        }
      ]
    },
    {
      "title": "第三层",
      "bosses": [
        {
          "order": 10,
          "boss": "神龙教主",
          "fighters": [
            {
              "name": "神龙教主",
              "npcId": 14000,
              "hp": 144180,
              "power": 8150,
              "skill": "伏羲刀法",
              "skillId": 3222
            }
          ],
          "waves": "3波15人",
          "chestDrop": "吹雪剑A 37%",
          "textDrop": "镇龙S 10%、青龙刀碎片 100%",
          "exp": "617760",
          "weaken": "无"
        }
      ]
    }
  ]
};
