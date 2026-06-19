 /**
 * 智行北科 (OmniNTUT) - 校園路網地圖資料
 * 依照 Google 試算表（北科大校園與周邊景點真實經緯度投影）更新。
 */

// 節點資料 (Nodes)
// x, y 坐標由真實經緯度經 SVG 投影轉換 (對應 1000x800 畫布，留有邊距)
const CAMPUS_NODES = {
  // 教學大樓與主要目的地 (building)
  "building_science": { 
    id: "building_science", 
    name: "科研大樓", 
    x: 388.0, 
    y: 338.4, 
    type: "building",
    photo: "photos/台北科技大學/科研大樓.jpg",
    desc: "國立臺北科技大學科研大樓，為校園內最新穎的地標建築之一。大樓內部設有尖端研學實驗室、產學合作中心以及多功能階梯教室，是北科大科技研發與學術交流的核心樞紐。"
  },
  "building_4th": { 
    id: "building_4th", 
    name: "第四教學大樓", 
    x: 377.5, 
    y: 496.7, 
    type: "building",
    photo: "photos/台北科技大學/第四教學大樓.jpg",
    desc: "第四教學大樓主要為一般教學教室與工程學系所辦公室，提供化學工程與生物科技等學科之教學與實驗場所，教學設施完善。"
  },
  "building_3rd": { 
    id: "building_3rd", 
    name: "第三教學大樓", 
    x: 447.0, 
    y: 496.7, 
    type: "building",
    photo: "photos/台北科技大學/第三教學大樓.jpg",
    desc: "第三教學大樓為校園內歷史悠久的教學大樓，主要供工程學院及相關學系課堂教學、辦公使用，見證校園蓬步發展。"
  },
  "building_2nd": { 
    id: "building_2nd", 
    name: "第二教學大樓", 
    x: 456.7, 
    y: 426.1, 
    type: "building",
    photo: "photos/台北科技大學/第二教學大樓.jpg",
    desc: "第二教學大樓臨近第一教學大樓，內設有多間一般教室、專業電腦教室與教師研究室，為學生每日學習之重要場所。"
  },
  "building_1st": { 
    id: "building_1st", 
    name: "第一教學大樓", 
    x: 386.1, 
    y: 424.6, 
    type: "building",
    photo: "photos/台北科技大學/第一教學大樓.jpg",
    desc: "第一教學大樓為靠近校門口之重要教學大樓，設有大量多媒體教室與學生自習空間，是北科大各系所必修課程的核心授課地點。"
  },
  "building_comprehensive": { 
    id: "building_comprehensive", 
    name: "綜合大樓", 
    x: 608.2, 
    y: 472.9, 
    type: "building",
    photo: "photos/台北科技大學/綜合大樓.jpg",
    desc: "綜合大樓為多功能大樓，內設有行政單位辦公室、公共教室、社團活動空間，為學生校園生活與行政服務的交會點。"
  },
  "building_common": { 
    id: "building_common", 
    name: "共同科館", 
    x: 457.9, 
    y: 544.9, 
    type: "building",
    photo: "photos/台北科技大學/共同科館.jpg",
    desc: "共同科館主要負責通識教育及共同學科之教學，大樓內設有通識教育中心與多間大型演講廳，是各系學子跨領域學習的場所。"
  },
  "building_yiguang": { 
    id: "building_yiguang", 
    name: "億光大樓", 
    x: 920.0, 
    y: 601.3, 
    type: "building",
    photo: "photos/台北科技大學/億光大樓.jpg",
    desc: "億光大樓位於校園東側，由校友企業捐資興建。大樓擁有現代化玻璃幕牆，內部設有光電工程系所研發基地及多個創新實驗室。"
  },
  "building_pioneer": { 
    id: "building_pioneer", 
    name: "先鋒大樓", 
    x: 513.6, 
    y: 654.2, 
    type: "building",
    photo: "photos/台北科技大學/先鋒大樓.jfif",
    desc: "先鋒大樓是北科大最新的現代化大樓之一，設有多功能展演廳、創客空間與國際會議中心，為推動跨領域創新與國際合作之先鋒基地。"
  },
  "building_zhongzheng": { 
    id: "building_zhongzheng", 
    name: "中正館", 
    x: 636.8, 
    y: 404.4, 
    type: "building",
    photo: "photos/台北科技大學/中正館.jpg",
    desc: "中正館為校園內的大型集會與室內運動場館，是校慶典禮、大型演講、體育賽事以及學生集會的主要舉辦場所。"
  },
  "building_red": { 
    id: "building_red", 
    name: "紅樓", 
    x: 474.8, 
    y: 452.1, 
    type: "building",
    photo: "photos/台北科技大學/紅樓.JPG",
    desc: "北科大紅樓建於1918年（大正7年），為校園內唯一的古蹟建築。紅磚結構搭配綠蔭環繞，極具歷史人文氣息，是北科大精神與歷史傳承的象徵。"
  },
  "building_admin": { 
    id: "building_admin", 
    name: "行政大樓", 
    x: 531.7, 
    y: 528.8, 
    type: "building",
    photo: "photos/台北科技大學/行政大樓.jpg",
    desc: "行政大樓為學校的行政中樞，包含校長室、教務處、學務處、總務處等各核心行政單位，提供師生全方位的行政支援服務。"
  },
  "library": { 
    id: "library", 
    name: "圖書館", 
    x: 514.4, 
    y: 467.5, 
    type: "building",
    photo: "photos/台北科技大學/圖書館.jpg",
    desc: "北科大圖書館為師生提供豐富的圖書藏書、學術期刊電子資源以及安靜的自習閱讀空間，是校園內探索學問、汲取知識的寶庫。"
  },

  // 宿舍 (dorm)
  "dorm_ntut": { 
    id: "dorm_ntut", 
    name: "北科宿舍", 
    x: 853.7, 
    y: 415.0, 
    type: "dorm",
    photo: "photos/台北科技大學/北科宿舍.jpg",
    desc: "北科大宿舍為在校學子提供舒適安全的住宿環境，配有聯誼廳、自習室與便利生活設施，是培養自主生活與同儕情誼的溫馨家園。"
  },

  // 周邊地標 (transit / landmark)
  "guanghua_market": { 
    id: "guanghua_market", 
    name: "光華商場", 
    x: 167.4, 
    y: 177.1, 
    type: "transit",
    photo: "photos/周邊/光華商場.jpg",
    desc: "光華商場（光華數位新天地）是臺北市最著名的電子與3C資訊產品商場，擁有豐富的電腦配件、周邊設備與電子零件，為科技愛好者與師生的採購聖地。"
  },
  "syntrend": { 
    id: "syntrend", 
    name: "三創生活園區", 
    x: 80.0, 
    y: 145.8, 
    type: "transit",
    photo: "photos/周邊/三創生活園區.jpg",
    desc: "三創生活園區緊鄰光華商場，是融合科技、藝術、動漫與創意的現代化科技生活百貨，提供多樣化的品牌體驗與互動科技展示。"
  },
  "green_garden": { 
    id: "green_garden", 
    name: "綠光庭園", 
    x: 322.7, 
    y: 339.2, 
    type: "transit",
    photo: "photos/周邊/綠光庭園.jpg",
    desc: "綠光庭園為校園內的生態綠化庭園，環境清幽、草木茂盛，設有木棧道與休閒座椅，是師生課餘放鬆、漫步與享受自然綠意的絕佳場所。"
  },

  // YouBike 站點 (youbike)
  "youbike_guanghua": { 
    id: "youbike_guanghua", 
    name: "youbike光華商場站", 
    x: 252.8, 
    y: 246.1, 
    type: "youbike", 
    isYouBike: true,
    desc: "位於光華商場周邊的 YouBike 站點，提供市民與師生往返光華商場及北科大校園的綠色便利通勤租借點。"
  },
  "youbike_ee": { 
    id: "youbike_ee", 
    name: "youbike北科大(電機工程系)", 
    x: 707.6, 
    y: 621.9, 
    type: "youbike", 
    isYouBike: true,
    desc: "緊鄰北科大電機工程系大樓與學生宿舍的 YouBike 站點，是宿舍學生通勤上課與聯外交通的極佳借還車點。"
  },
  "youbike_xinsheng_4": { 
    id: "youbike_xinsheng_4", 
    name: "youbike忠孝新生站(4號出口)", 
    x: 311.9, 
    y: 560.7, 
    type: "youbike", 
    isYouBike: true,
    desc: "位於捷運忠孝新生站4號出口旁的 YouBike 站點，是本系統預設的最佳起點，為捷運族提供無縫接軌的單車轉乘方案。"
  },
  "youbike_xinsheng_3": { 
    id: "youbike_xinsheng_3", 
    name: "youbike忠孝新生站(3號出口)", 
    x: 374.4, 
    y: 630.0, 
    type: "youbike", 
    isYouBike: true,
    desc: "鄰近捷運忠孝新生站3號出口的 YouBike 站點，服務往返板南線/中和新蘆線的通勤人潮與校園西側師生。"
  },
  "youbike_xinsheng_1": { 
    id: "youbike_xinsheng_1", 
    name: "youbike忠孝新生站(1號出口)", 
    x: 170.0, 
    y: 520.7, 
    type: "youbike", 
    isYouBike: true,
    desc: "位於忠孝新生站1號出口旁的 YouBike 站點，靠近臨近商圈，為校園西側邊界與周邊居民提供便利的自行車租借服務。"
  },
  "youbike_bade": { 
    id: "youbike_bade", 
    name: "youbike八德市場", 
    x: 722.6, 
    y: 265.1, 
    type: "youbike", 
    isYouBike: true,
    desc: "鄰近八德路市場的 YouBike 站點，方便師生往返校園北側八德商圈與生活住宅區。"
  }
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
