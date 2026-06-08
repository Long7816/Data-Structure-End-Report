/**
 * 幸福通勤導航 - 環境與天氣情境設定
 * 用於模擬各種外部變數對路權權重的影響及 YouBike 站點車位狀態。
 */

const ENVIRONMENTAL_SCENARIOS = {
  // 1. 正常情境 (無額外處罰，車位充足)
  "normal": {
    name: "晴朗舒適 (預設)",
    description: "天氣適宜，YouBike 站點車位皆充足。",
    weather: {
      temperature: 24,
      condition: "sunny", // sunny, rainy, heavy_rain, polluted
      aqi: 45
    },
    // YouBike 站點狀態：{ 站點ID: { bikes: 可借車輛, docks: 可還空位 } }
    youbike: {
      "youbike_mrt": { bikes: 15, docks: 15 },
      "youbike_gate": { bikes: 12, docks: 18 },
      "youbike_dorm": { bikes: 8, docks: 12 },
      "youbike_science": { bikes: 14, docks: 16 },
      "youbike_lib": { bikes: 10, docks: 20 }
    },
    // 邊權重處罰加乘 (0 表示不額外處罰)
    penalties: {
      noShade: 0,      // 無遮蔭處罰
      noRoof: 0,       // 無雨遮處罰
      slippery: 0,     // 打滑路面處罰
      slope: 0,        // 坡度處罰 (乘上 slope 等級)
      pollution: 0     // 空污路段處罰
    }
  },

  // 2. 烈日高溫情境 (☀️)
  "heat": {
    name: "烈日高溫 (38°C)",
    description: "正午太陽毒辣，無遮蔽柏油路面極度爆汗，優先規劃走廊與樹蔭下路線。",
    weather: {
      temperature: 38,
      condition: "heat",
      aqi: 60
    },
    youbike: {
      "youbike_mrt": { bikes: 15, docks: 15 },
      "youbike_gate": { bikes: 12, docks: 18 },
      "youbike_dorm": { bikes: 5, docks: 15 },
      "youbike_science": { bikes: 14, docks: 16 },
      "youbike_lib": { bikes: 10, docks: 20 }
    },
    penalties: {
      noShade: 2.5,    // 沒遮蔭的路權重增加 250% (極度排斥陽光)
      noRoof: 0,
      slippery: 0,
      slope: 1.0,      // 高溫爬坡處罰加重 (每級坡度增加 100% 權重)
      pollution: 0
    }
  },

  // 3. 突然暴雨情境 (🌧️)
  "rain": {
    name: "突然暴雨",
    description: "傾盆大雨，露天路段容易淋濕，且大理石路面、斑馬線等易打滑，優先規劃走廊與室內通道。",
    weather: {
      temperature: 20,
      condition: "heavy_rain",
      aqi: 30
    },
    youbike: {
      "youbike_mrt": { bikes: 8, docks: 22 },
      "youbike_gate": { bikes: 5, docks: 25 },
      "youbike_dorm": { bikes: 6, docks: 14 },
      "youbike_science": { bikes: 11, docks: 19 },
      "youbike_lib": { bikes: 4, docks: 26 }
    },
    penalties: {
      noShade: 0,
      noRoof: 3.0,     // 沒雨遮的露天路段權重增加 300% (極度排斥淋雨)
      slippery: 2.0,   // 大理石路面雨天極易打滑，權重增加 200% 處罰
      slope: 0.5,      // 雨天爬坡稍微不便
      pollution: 0
    }
  },

  // 4. 空氣污染情境 (😷)
  "pollution": {
    name: "空氣污染 (AQI 165)",
    description: "空污橘色/紅色警戒，主要幹道車流量大、廢氣多，導航避開大馬路，改走校內樹蔭深處小路。",
    weather: {
      temperature: 25,
      condition: "polluted",
      aqi: 165
    },
    youbike: {
      "youbike_mrt": { bikes: 15, docks: 15 },
      "youbike_gate": { bikes: 12, docks: 18 },
      "youbike_dorm": { bikes: 8, docks: 12 },
      "youbike_science": { bikes: 14, docks: 16 },
      "youbike_lib": { bikes: 10, docks: 20 }
    },
    // 對鄰近大馬路的邊（如 e1, e3, e5, e7, e28 等）套用空污路段標籤並處罰
    penalties: {
      noShade: 0,
      noRoof: 0,
      slippery: 0,
      slope: 0,
      pollution: 2.0   // 污染幹道權重增加 200% 處罰，導引走內部小徑
    },
    pollutedEdges: ["e1", "e3", "e5", "e7", "e28"] // 受污染影響的主幹道
  },

  // 5. YouBike 車位吃緊情境 (🚲)
  "youbike_clog": {
    name: "YouBike 供需失衡",
    description: "捷運站借不到車，或目的地科研館站滿位無法還車。演算法將強制自動繞道或引導至鄰近替代站點。",
    weather: {
      temperature: 23,
      condition: "sunny",
      aqi: 45
    },
    // YouBike 站點狀態吃緊
    youbike: {
      "youbike_mrt": { bikes: 1, docks: 29 },       // 可借車數 < 3 (黃/紅燈)
      "youbike_gate": { bikes: 15, docks: 15 },
      "youbike_dorm": { bikes: 10, docks: 10 },
      "youbike_science": { bikes: 28, docks: 2 },    // 可還位數 < 3 (黃/紅燈)
      "youbike_lib": { bikes: 12, docks: 18 }
    },
    penalties: {
      noShade: 0,
      noRoof: 0,
      slippery: 0,
      slope: 0,
      pollution: 0
    }
  }
};
