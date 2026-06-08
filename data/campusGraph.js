/**
 * 幸福通勤導航 - 校園路網地圖資料
 * 包含起點、終點、YouBike站點以及路段邊資訊。
 * 由於不使用模組化打包工具，此檔案宣告全域變數以供 script.js 存取。
 */

// 節點資料 (Nodes)
// x, y 坐標用於 SVG 地圖渲染，範圍為 0 ~ 1000, 0 ~ 800
const CAMPUS_NODES = {
  // 起點/交通節點
  "mrt_xinsheng": { id: "mrt_xinsheng", name: "捷運忠孝新生站", x: 100, y: 350, type: "transit" },
  "gate": { id: "gate", name: "校門口", x: 250, y: 350, type: "transit" },
  "dorm_female": { id: "dorm_female", name: "女宿", x: 100, y: 550, type: "dorm" },
  "dorm_male": { id: "dorm_male", name: "男宿", x: 150, y: 680, type: "dorm" },

  // YouBike 站點
  "youbike_mrt": { id: "youbike_mrt", name: "YouBike 捷運新生站", x: 120, y: 300, type: "youbike", isYouBike: true },
  "youbike_gate": { id: "youbike_gate", name: "YouBike 校門口站", x: 280, y: 320, type: "youbike", isYouBike: true },
  "youbike_dorm": { id: "youbike_dorm", name: "YouBike 宿舍站", x: 120, y: 600, type: "youbike", isYouBike: true },
  "youbike_science": { id: "youbike_science", name: "YouBike 科研館站", x: 700, y: 380, type: "youbike", isYouBike: true },
  "youbike_lib": { id: "youbike_lib", name: "YouBike 圖書館站", x: 500, y: 550, type: "youbike", isYouBike: true },

  // 中繼路口節點
  "intersection_1": { id: "intersection_1", name: "椰林大道起點", x: 350, y: 350, type: "intersection" },
  "intersection_2": { id: "intersection_2", name: "綜合大樓前廣場", x: 500, y: 250, type: "intersection" },
  "intersection_3": { id: "intersection_3", name: "活大路口", x: 450, y: 450, type: "intersection" },
  "intersection_4": { id: "intersection_4", name: "圖書館路口", x: 550, y: 480, type: "intersection" },
  "intersection_5": { id: "intersection_5", name: "科研館旁通道", x: 740, y: 450, type: "intersection" },
  "intersection_6": { id: "intersection_6", name: "宿舍聯外路口", x: 200, y: 500, type: "intersection" },

  // 目的地/大樓
  "building_science": { id: "building_science", name: "科研大樓", x: 820, y: 450, type: "building" },
  "building_comprehensive": { id: "building_comprehensive", name: "綜合大樓", x: 530, y: 200, type: "building" },
  "building_common": { id: "building_common", name: "共同教室", x: 620, y: 620, type: "building" },
  "library": { id: "library", name: "總圖書館", x: 530, y: 580, type: "building" }
};

// 邊資料 (Edges / Paths)
// 包含物理距離與多種環境屬性：
// - distance: 物理距離 (米)
// - hasRoof: 是否有雨遮/騎樓 (可少淋雨)
// - hasShade: 是否有樹蔭/遮蔽 (較涼爽)
// - slope: 坡度等級 (1:平坦, 2:微坡, 3:陡坡或樓梯)
// - surface: 路面材質 (asphalt:柏油, marble:大理石[雨天易滑], brick:紅磚)
const CAMPUS_EDGES = [
  // 捷運與校門口連接
  { id: "e1", source: "mrt_xinsheng", target: "gate", distance: 150, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },
  { id: "e2", source: "mrt_xinsheng", target: "youbike_mrt", distance: 30, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e3", source: "youbike_mrt", target: "gate", distance: 130, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },

  // 校門口與椰林大道、YouBike 門口站
  { id: "e4", source: "gate", target: "youbike_gate", distance: 40, hasRoof: false, hasShade: false, slope: 1, surface: "brick" },
  { id: "e5", source: "gate", target: "intersection_1", distance: 100, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },
  { id: "e6", source: "youbike_gate", target: "intersection_1", distance: 80, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },

  // 椰林大道向內延伸
  { id: "e7", source: "intersection_1", target: "intersection_2", distance: 180, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" }, // 到綜合大樓前
  { id: "e8", source: "intersection_1", target: "intersection_3", distance: 140, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" }, // 到活大路口
  { id: "e9", source: "intersection_3", target: "intersection_6", distance: 260, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" }, // 往宿舍方向

  // 宿舍區域
  { id: "e10", source: "dorm_female", target: "youbike_dorm", distance: 50, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e11", source: "dorm_male", target: "youbike_dorm", distance: 80, hasRoof: false, hasShade: true, slope: 2, surface: "asphalt" },
  { id: "e12", source: "dorm_female", target: "intersection_6", distance: 110, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },
  { id: "e13", source: "dorm_male", target: "intersection_6", distance: 180, hasRoof: false, hasShade: true, slope: 2, surface: "asphalt" },
  { id: "e14", source: "youbike_dorm", target: "intersection_6", distance: 100, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },

  // 綜合大樓與周邊
  { id: "e15", source: "intersection_2", target: "building_comprehensive", distance: 50, hasRoof: true, hasShade: false, slope: 1, surface: "brick" },
  { id: "e16", source: "building_comprehensive", target: "intersection_5", distance: 240, hasRoof: true, hasShade: true, slope: 1, surface: "brick" }, // 科研館連通道，少淋雨/有蔭
  { id: "e17", source: "intersection_2", target: "intersection_4", distance: 230, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" }, // 露天大路，無雨遮/無遮蔭

  // 活大路口、圖書館路口與總圖
  { id: "e18", source: "intersection_3", target: "intersection_4", distance: 110, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },
  { id: "e19", source: "intersection_4", target: "youbike_lib", distance: 80, hasRoof: false, hasShade: true, slope: 1, surface: "asphalt" },
  { id: "e20", source: "intersection_4", target: "library", distance: 120, hasRoof: false, hasShade: true, slope: 1, surface: "marble" }, // 總圖前，大理石路面 (雨天易滑)
  { id: "e21", source: "youbike_lib", target: "library", distance: 40, hasRoof: false, hasShade: true, slope: 1, surface: "brick" },

  // 圖書館往科研館、共同教室
  { id: "e22", source: "library", target: "building_common", distance: 100, hasRoof: true, hasShade: true, slope: 1, surface: "brick" },
  { id: "e23", source: "library", target: "intersection_5", distance: 220, hasRoof: false, hasShade: true, slope: 2, surface: "asphalt" },
  { id: "e24", source: "building_common", target: "intersection_5", distance: 170, hasRoof: false, hasShade: true, slope: 3, surface: "brick" }, // 陡坡與樓梯 (無障礙處罰重)

  // 科研館與周邊
  { id: "e25", source: "intersection_5", target: "youbike_science", distance: 70, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },
  { id: "e26", source: "intersection_5", target: "building_science", distance: 80, hasRoof: true, hasShade: true, slope: 1, surface: "brick" },
  { id: "e27", source: "youbike_science", target: "building_science", distance: 120, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" },

  // 跨區捷徑（純戶外，下雨曝曬皆最嚴重，但距離最短）
  { id: "e28", source: "intersection_1", target: "intersection_5", distance: 380, hasRoof: false, hasShade: false, slope: 1, surface: "asphalt" }
];
