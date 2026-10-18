/** R7: compress only >50m empty object-row gaps to 48m in 14 encounters;
 * preserve first nine lessons and opening coins. Add two fault-car routes and lesson10.
 * Group dz is relative; OPENING_COINS dz remains absolute run distance. Pure data. */
export const ENCOUNTERS = [
  {
    "id": "open_lane",
    "title": "先挑一条好路",
    "minDistance": 0,
    "weight": 12,
    "objects": [
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 39,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 43.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 48,
        "y": 0.85
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 96
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 135,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 139.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 144,
        "y": 0.85
      }
    ],
    "hint": "A / D 换道，前车旁边有空位。"
  },
  {
    "id": "one_small_hop",
    "title": "这点高度，起飞",
    "minDistance": 180,
    "weight": 10,
    "objects": [
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 66
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 0,
        "y": 4.2
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 4.5,
        "y": 4.55
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 9,
        "y": 4.5
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 13.5,
        "y": 4.25
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 18,
        "y": 3.95
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 114,
        "y": 0.85
      }
    ],
    "hint": "空格跳过矮路障；两侧也能绕行。"
  },
  {
    "id": "three_beat_slalom",
    "title": "左右横跳，有章可循",
    "minDistance": 360,
    "weight": 10,
    "objects": [
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 48
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 96
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 135,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 139.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 144,
        "y": 0.85
      }
    ],
    "hint": "看下一排：中 → 右 → 中，留一步余量。"
  },
  {
    "id": "two_low_one_high",
    "title": "起跳，也要看落点",
    "minDistance": 540,
    "weight": 9,
    "objects": [
      {
        "kind": "barrier",
        "lane": 0,
        "dz": 0
      },
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 43.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 48,
        "y": 0.85
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 96
      },
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 144
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 187.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 192,
        "y": 0.85
      }
    ],
    "hint": "左中两栏可跳；别落进右侧车身。"
  },
  {
    "id": "mind_the_roof",
    "title": "有时贴地更帅",
    "minDistance": 720,
    "weight": 8,
    "objects": [
      {
        "kind": "beam",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 48
      },
      {
        "kind": "barrier",
        "lane": 2,
        "dz": 96
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 135,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 139.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 144,
        "y": 0.85
      }
    ],
    "hint": "中道有横梁，先贴地通过，再决定起跳。"
  },
  {
    "id": "hold_the_glide",
    "title": "续上这一口风",
    "minDistance": 900,
    "weight": 8,
    "objects": [
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 0
      },
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 36
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 36
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 0,
        "y": 4.3
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 4.5,
        "y": 4.55
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 9,
        "y": 4.6
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 84,
        "y": 0.85
      }
    ],
    "hint": "中道连续两栏：按住空格滑翔，越过第二栏。"
  },
  {
    "id": "roll_past_the_drone",
    "title": "在空中翻个身",
    "minDistance": 1150,
    "weight": 7,
    "objects": [
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "drone",
        "lane": 1,
        "dz": 48
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 87,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 91.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 96,
        "y": 0.85
      },
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 144
      }
    ],
    "hint": "越栏后遇无人机，空中按 Q / E；也可换道。"
  },
  {
    "id": "battery_goes_right",
    "title": "右边这个包裹，有点烫",
    "minDistance": 1350,
    "weight": 7,
    "objects": [
      {
        "kind": "batteryVan",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 48
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 96,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 100.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 105,
        "y": 0.85
      }
    ],
    "hint": "电池向右抛！落地后会炸，避开红圈再过。"
  },
  {
    "id": "battery_takeoff_gate",
    "title": "这一段，真的得飞",
    "minDistance": 1600,
    "weight": 5,
    "objects": [
      {
        "kind": "batteryVan",
        "lane": 0,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 0,
        "y": 4.2
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 4.5,
        "y": 4.55
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 9,
        "y": 4.5
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 13.5,
        "y": 4.25
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 18,
        "y": 3.95
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 66,
        "y": 0.85
      }
    ],
    "hint": "两侧有车，中道电池要炸：按住空格飞过去！"
  },
  {
    "id": "rearview_not_optional",
    "title": "后面这位，刹不住了",
    "minDistance": 1900,
    "weight": 5,
    "objects": [
      {
        "kind": "rearCar",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 0
      },
      {
        "kind": "barrier",
        "lane": 2,
        "dz": 48
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 87,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 91.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 96,
        "y": 0.85
      }
    ],
    "hint": "后方红道先鸣笛：先向右让，再跳过路障。"
  },
  {
    "id": "rear_chase_high_road",
    "title": "前有栏，后有车",
    "minDistance": 2200,
    "weight": 4,
    "objects": [
      {
        "kind": "rearCar",
        "lane": 0,
        "dz": 0
      },
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 48
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 48
      },
      {
        "kind": "drone",
        "lane": 0,
        "dz": 96
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 135,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 139.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 144,
        "y": 0.85
      }
    ],
    "hint": "左道追车、右道有车，中道越栏后稳稳落地。"
  },
  {
    "id": "read_the_next_beat",
    "title": "忙，但每一步都有路",
    "minDistance": 2600,
    "weight": 3,
    "objects": [
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "batteryVan",
        "lane": 0,
        "dz": 48
      },
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 96
      },
      {
        "kind": "drone",
        "lane": 2,
        "dz": 144
      },
      {
        "kind": "beam",
        "lane": 0,
        "dz": 192
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 183,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 187.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 192,
        "y": 0.85
      }
    ],
    "hint": "先走右道避电池，再回中道越栏；看好落点。"
  },
  {
    "id": "nitro_traffic_chain",
    "title": "攒能，再冲一次",
    "minDistance": 3000,
    "weight": 4,
    "objects": [
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 24,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 28.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 33,
        "y": 0.85
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 64
      },
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 112
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 144,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 148.5,
        "y": 0.85
      }
    ],
    "hint": "临近普通车按住Shift喷气可撞坏；前方路障仍须跳过或换道。"
  },
  {
    "id": "near_pass_to_boost",
    "title": "擦身攒能，留路再冲",
    "minDistance": 3400,
    "weight": 3,
    "objects": [
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 2,
        "dz": 24,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 2,
        "dz": 28.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 2,
        "dz": 33,
        "y": 0.85
      },
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 64
      },
      {
        "kind": "beam",
        "lane": 2,
        "dz": 112
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 148,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 152.5,
        "y": 0.85
      }
    ],
    "hint": "擦身、金币和翻滚积能；轻擦交通车留伤，深侧撞或喷气可撞坏。低梁贴地过。"
  },
  {
    "id": "fault_car_left_exit",
    "title": "前车故障，留出绕行道",
    "minDistance": 1450,
    "weight": 5,
    "objects": [
      {
        "kind": "faultCar",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 24,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 28.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 33,
        "y": 0.85
      },
      {
        "kind": "barrier",
        "lane": 2,
        "dz": 48
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 81,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 85.5,
        "y": 0.85
      }
    ],
    "hint": "听刹车声，看前车减速停下；左道有空位，沿金币绕过。"
  },
  {
    "id": "fault_car_staggered",
    "title": "让过停驶车，再看下一排",
    "minDistance": 2050,
    "weight": 4,
    "objects": [
      {
        "kind": "faultCar",
        "lane": 0,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 18,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 22.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 27,
        "y": 0.85
      },
      {
        "kind": "barrier",
        "lane": 2,
        "dz": 48
      },
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 96
      },
      {
        "kind": "coin",
        "lane": 2,
        "dz": 127.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 2,
        "dz": 132,
        "y": 0.85
      }
    ],
    "hint": "左道故障车会停下；先走中道，后排普通车前向右让。"
  }
];

export const TUTORIAL = [
  {
    "id": "tutorial_change_lane",
    "title": "第一步：留出车道",
    "minDistance": 0,
    "weight": 0,
    "objects": [
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 39,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 43.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 48,
        "y": 0.85
      }
    ],
    "hint": "A / D 或方向键换道；触屏点左右箭头。"
  },
  {
    "id": "tutorial_jump",
    "title": "第二步：跳过路障",
    "minDistance": 240,
    "weight": 0,
    "objects": [
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 0,
        "y": 4.2
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 4.5,
        "y": 4.55
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 9,
        "y": 4.5
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 13.5,
        "y": 4.25
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 18,
        "y": 3.95
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 48,
        "y": 0.85
      }
    ],
    "hint": "前方中道矮栏，空格 / 起跳键跳过去。"
  },
  {
    "id": "tutorial_glide",
    "title": "第三步：按住滑翔",
    "minDistance": 520,
    "weight": 0,
    "objects": [
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 36
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 0,
        "y": 4.3
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 4.5,
        "y": 4.55
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 9,
        "y": 4.6
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 96,
        "y": 0.85
      }
    ],
    "hint": "起跳后继续按住空格 / 起跳键，越过两栏。"
  },
  {
    "id": "tutorial_air_roll",
    "title": "第四步：空中避险",
    "minDistance": 820,
    "weight": 0,
    "objects": [
      {
        "kind": "barrier",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "drone",
        "lane": 1,
        "dz": 48
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 87,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 91.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 96,
        "y": 0.85
      }
    ],
    "hint": "跳起后 Q / E 空翻；触屏点空翻键，可短暂避险。"
  },
  {
    "id": "tutorial_right_battery",
    "title": "第五步：看清落点",
    "minDistance": 1160,
    "weight": 0,
    "objects": [
      {
        "kind": "batteryVan",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 96
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 135,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 139.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 144,
        "y": 0.85
      }
    ],
    "hint": "看右抛轨迹和红圈：电池落地延时爆炸，先避开。"
  },
  {
    "id": "tutorial_rear_car",
    "title": "第六步：听见后方鸣笛",
    "minDistance": 1520,
    "weight": 0,
    "objects": [
      {
        "kind": "rearCar",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 0,
        "dz": 48
      },
      {
        "kind": "coin",
        "lane": 2,
        "dz": 87,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 2,
        "dz": 91.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 2,
        "dz": 96,
        "y": 0.85
      }
    ],
    "hint": "追车从后方来！离开红色车道，右侧有空位。"
  },
  {
    "id": "tutorial_must_takeoff",
    "title": "第七步：必须飞起",
    "minDistance": 1880,
    "weight": 0,
    "objects": [
      {
        "kind": "batteryVan",
        "lane": 0,
        "dz": 0
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 0,
        "y": 4.2
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 4.5,
        "y": 4.55
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 9,
        "y": 4.5
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 13.5,
        "y": 4.25
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 18,
        "y": 3.95
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 108,
        "y": 0.85
      }
    ],
    "hint": "两侧车身卡住地面，中道红圈将炸；按住起跳！"
  },
  {
    "id": "tutorial_nitro_push",
    "title": "第八步：主动喷气",
    "minDistance": 2240,
    "weight": 0,
    "objects": [
      {
        "kind": "coin",
        "lane": 1,
        "dz": 0,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 4.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 9,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 13.5,
        "y": 0.85
      },
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 64
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 96,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 100.5,
        "y": 0.85
      },
      {
        "kind": "barrier",
        "lane": 0,
        "dz": 144
      }
    ],
    "hint": "先收金币积能，临近普通车再按住Shift／喷气。只有交通车可撞坏；没能量就先松开。"
  },
  {
    "id": "tutorial_contact_control",
    "title": "第九步：擦身与侧撞",
    "minDistance": 2600,
    "weight": 0,
    "objects": [
      {
        "kind": "traffic",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 24,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 28.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 33,
        "y": 0.85
      },
      {
        "kind": "traffic",
        "lane": 2,
        "dz": 64
      },
      {
        "kind": "beam",
        "lane": 0,
        "dz": 128
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 160,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 1,
        "dz": 164.5,
        "y": 0.85
      }
    ],
    "hint": "擦身、翻滚可积能；轻擦交通车会留伤，深侧撞可撞坏。爆区、后车、重障碍仍躲。"
  },
  {
    "id": "tutorial_fault_car",
    "title": "第十步：绕过故障车",
    "minDistance": 2980,
    "weight": 0,
    "objects": [
      {
        "kind": "faultCar",
        "lane": 1,
        "dz": 0
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 18,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 22.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 27,
        "y": 0.85
      },
      {
        "kind": "barrier",
        "lane": 2,
        "dz": 48
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 66,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 70.5,
        "y": 0.85
      },
      {
        "kind": "coin",
        "lane": 0,
        "dz": 75,
        "y": 0.85
      }
    ],
    "hint": "前车刹停了，沿左侧金币绕行；别把故障车当成可撞毁的普通车。"
  }
];

export const OPENING_COINS = [
  {
    "kind": "coin",
    "lane": 1,
    "dz": 28,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 32.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 37,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 41.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 46,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 50.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 55,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 59.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 93,
    "y": 2.35
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 97.5,
    "y": 3.55
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 102,
    "y": 4.3
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 106.5,
    "y": 4.6
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 111,
    "y": 4.35
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 115.5,
    "y": 3.6
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 120,
    "y": 2.45
  },
  {
    "kind": "coin",
    "lane": 2,
    "dz": 225,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 2,
    "dz": 229.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 2,
    "dz": 234,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 2,
    "dz": 238.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 2,
    "dz": 243,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 2,
    "dz": 247.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 275,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 279.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 284,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 288.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 311,
    "y": 4.05
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 315.5,
    "y": 4.45
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 320,
    "y": 4.6
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 324.5,
    "y": 4.45
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 329,
    "y": 4.2
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 365,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 369.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 374,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 378.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 383,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 534,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 538.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 543,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 547.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 552,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 556.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 561,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 655,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 659.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 664,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 668.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 673,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 677.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 0,
    "dz": 735,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 0,
    "dz": 739.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 0,
    "dz": 744,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 0,
    "dz": 748.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 0,
    "dz": 753,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 0,
    "dz": 757.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 797,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 801.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 806,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 810.5,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 815,
    "y": 0.85
  },
  {
    "kind": "coin",
    "lane": 1,
    "dz": 819.5,
    "y": 0.85
  }
];
