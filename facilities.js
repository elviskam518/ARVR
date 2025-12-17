// src/facilities.js

// 统一管理所有设施的配置
export const FACILITY_CONFIG = {
  food: {
    type: 'food',
    color: 0xffc107,
    size: 1.2,        // 占格子宽度
    height: 0.1,      // 超薄地板
    income: 20,
    happinessGain: 3,
    playDuration: 10,  // ⭐ 玩多久（秒）
    capacity: 1  // ⭐ 一次最多几个人
  },

  carousel: {
    type: 'carousel',
    color: 0x2196f3,
    size: 1.5,
    height: 0.1,
    income: 40,
    happinessGain: 5,
    playDuration: 10,
    capacity: 2
  },

  ferris: {
    type: 'ferris',
    color: 0x9c27b0,
    size: 3.5,        // 看起来约 2x2
    height: 0.1,
    income: 60,
    happinessGain: 7,
    playDuration: 10,
    capacity: 3
  },


};

export function getFacilityConfig(type) {
  return FACILITY_CONFIG[type];
}
