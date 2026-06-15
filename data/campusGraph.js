/**
 * 幸福通勤導航 - 校園路網地圖資料
 * 依照 Google 試算表（北科大校園與周邊景點真實經緯度投影）更新。
 */

// 節點資料 (Nodes)
// x, y 坐標由真實經緯度經 SVG 投影轉換 (對應 1000x800 畫布，留有邊距)
const CAMPUS_NODES = {
  // 教學大樓與主要目的地 (building)
  "building_science": { id: "building_science", name: "科研大樓", x: 388.0, y: 338.4, type: "building" },
  "building_4th": { id: "building_4th", name: "第四教學大樓", x: 377.5, y: 496.7, type: "building" },
  "building_3rd": { id: "building_3rd", name: "第三教學大樓", x: 447.0, y: 496.7, type: "building" },
  "building_2nd": { id: "building_2nd", name: "第二教學大樓", x: 456.7, y: 426.1, type: "building" },
  "building_1st": { id: "building_1st", name: "第一教學大樓", x: 386.1, y: 424.6, type: "building" },
  "building_comprehensive": { id: "building_comprehensive", name: "綜合大樓", x: 608.2, y: 472.9, type: "building" },
  "building_common": { id: "building_common", name: "共同科館", x: 457.9, y: 544.9, type: "building" },
  "building_yiguang": { id: "building_yiguang", name: "億光大樓", x: 920.0, y: 601.3, type: "building" },
  "building_pioneer": { id: "building_pioneer", name: "先鋒大樓", x: 513.6, y: 654.2, type: "building" },
  "building_zhongzheng": { id: "building_zhongzheng", name: "中正館", x: 636.8, y: 404.4, type: "building" },
  "building_red": { id: "building_red", name: "紅樓", x: 474.8, y: 452.1, type: "building" },
  "building_admin": { id: "building_admin", name: "行政大樓", x: 531.7, y: 528.8, type: "building" },
  "library": { id: "library", name: "圖書館", x: 514.4, y: 467.5, type: "building" },

  // 宿舍 (dorm)
  "dorm_ntut": { id: "dorm_ntut", name: "北科宿舍", x: 853.7, y: 415.0, type: "dorm" },

  // 周邊地標 (transit / landmark)
  "guanghua_market": { id: "guanghua_market", name: "光華商場", x: 167.4, y: 177.1, type: "transit" },
  "syntrend": { id: "syntrend", name: "三創生活園區", x: 80.0, y: 145.8, type: "transit" },
  "green_garden": { id: "green_garden", name: "綠光庭園", x: 322.7, y: 339.2, type: "transit" },

  // YouBike 站點 (youbike)
  "youbike_guanghua": { id: "youbike_guanghua", name: "youbike光華商場站", x: 252.8, y: 246.1, type: "youbike", isYouBike: true },
  "youbike_ee": { id: "youbike_ee", name: "youbike北科大(電機工程系)", x: 707.6, y: 621.9, type: "youbike", isYouBike: true },
  "youbike_xinsheng_4": { id: "youbike_xinsheng_4", name: "youbike忠孝新生站(4號出口)", x: 311.9, y: 560.7, type: "youbike", isYouBike: true },
  "youbike_xinsheng_3": { id: "youbike_xinsheng_3", name: "youbike忠孝新生站(3號出口)", x: 374.4, y: 630.0, type: "youbike", isYouBike: true },
  "youbike_xinsheng_1": { id: "youbike_xinsheng_1", name: "youbike忠孝新生站(1號出口)", x: 170.0, y: 520.7, type: "youbike", isYouBike: true },
  "youbike_bade": { id: "youbike_bade", name: "youbike八德市場", x: 722.6, y: 265.1, type: "youbike", isYouBike: true }
};

// 邊資料 (Edges / Paths)
// 包含物理距離 (由坐標比例尺換算米) 與多種環境屬性：
// - distance: 物理距離 (米)
// - hasRoof: 是否有雨遮/連通道
// - hasShade: 是否有樹蔭/遮蔽
// - slope: 坡度等級 (1:平坦, 2:微坡, 3:陡坡或樓梯)
// - surface: 路面材質 (asphalt:柏油, marble:大理石[雨天易滑], brick:紅磚)
const CAMPUS_EDGES = [
  // 新生南路、三創、光華商場周邊 (外部道路，空污主幹道)
  { id: "e1", source: "youbike_xinsheng_1", target: "syntrend", distance: 220, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },
  { id: "e2", source: "syntrend", target: "youbike_guanghua", distance: 130, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },
  { id: "e3", source: "youbike_guanghua", target: "guanghua_market", distance: 70, hasRoof: false, hasShade: false, slope: 1, surface: "brick" },
  { id: "e4", source: "youbike_guanghua", target: "youbike_bade", distance: 320, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },
  { id: "e23", source: "youbike_xinsheng_4", target: "youbike_xinsheng_1", distance: 310, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },

  // 八德路與科研大樓、教學大樓連接口
  { id: "e5", source: "youbike_bade", target: "building_science", distance: 180, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },
  { id: "e33", source: "youbike_bade", target: "building_1st", distance: 250, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },
  { id: "e9", source: "building_red", target: "building_science", distance: 80, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },

  // 忠孝新生站與圖書館、綠光庭園 (南部入口)
  { id: "e20", source: "library", target: "youbike_xinsheng_4", distance: 80, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },
  { id: "e21", source: "library", target: "youbike_xinsheng_3", distance: 40, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },
  { id: "e22", source: "youbike_xinsheng_4", target: "youbike_xinsheng_3", distance: 90, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },
  
  // 圖書館、綠光庭園與教學區
  { id: "e18", source: "building_zhongzheng", target: "library", distance: 160, hasRoof: false, hasShade: true, slope: 1, surface: "marble" }, // 大理石路面 (雨天易滑)
  { id: "e19", source: "library", target: "green_garden", distance: 80, hasRoof: false, hasShade: true, slope: 1, surface: "marble" },  // 大理石路面
  { id: "e16", source: "building_3rd", target: "green_garden", distance: 80, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },
  { id: "e32", source: "building_red", target: "green_garden", distance: 190, hasRoof: true, hasShade: true, slope: 1, surface: "brick" }, // 綠意長廊

  // 教學區內部通道
  { id: "e6", source: "building_science", target: "building_1st", distance: 140, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },
  { id: "e7", source: "building_red", target: "building_admin", distance: 20, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e8", source: "building_red", target: "building_1st", distance: 70, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },
  { id: "e10", source: "building_1st", target: "building_2nd", distance: 60, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e11", source: "building_1st", target: "building_common", distance: 150, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },
  { id: "e12", source: "building_2nd", target: "building_3rd", distance: 90, hasRoof: false, hasShade: false, slope: 2, surface: "brick" }, // 微陡坡路面
  { id: "e13", source: "building_2nd", target: "building_comprehensive", distance: 110, hasRoof: true, hasShade: true, slope: 1, surface: "brick" },
  { id: "e14", source: "building_2nd", target: "building_4th", distance: 100, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e15", source: "building_3rd", target: "building_zhongzheng", distance: 70, hasRoof: false, hasShade: false, slope: 1, surface: "brick" },
  { id: "e17", source: "building_zhongzheng", target: "building_comprehensive", distance: 90, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },

  // 綜合、共同、先鋒大樓 (東側教學區)
  { id: "e24", source: "building_comprehensive", target: "building_4th", distance: 120, hasRoof: true, hasShade: true, slope: 1, surface: "brick" },
  { id: "e25", source: "building_comprehensive", target: "building_pioneer", distance: 120, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e26", source: "building_4th", target: "building_common", distance: 70, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e27", source: "building_common", target: "building_pioneer", distance: 50, hasRoof: false, hasShade: false, slope: 3, surface: "brick" }, // 陡坡與戶外台階

  // 先鋒、宿舍、億光大樓 (東南側宿舍與聯外區)
  { id: "e28", source: "building_pioneer", target: "youbike_ee", distance: 290, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },
  { id: "e29", source: "youbike_ee", target: "dorm_ntut", distance: 50, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e30", source: "youbike_ee", target: "building_yiguang", distance: 200, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },
  { id: "e31", source: "dorm_ntut", target: "building_yiguang", distance: 170, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" }
];
