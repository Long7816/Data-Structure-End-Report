/**
 * 幸福通勤導航系統 - 核心邏輯與演算法實作
 */

// ==========================================
// 1. 全域狀態管理 (State)
// ==========================================
let currentScenarioId = "normal"; // 預設晴朗
let currentModeId = "fastest";     // 預設最快
let startNodeId = "youbike_xinsheng_4"; // 預設起點 (忠孝新生4號出口)
let endNodeId = "building_science";     // 預設終點 (科研大樓)

// 地圖縮放與平移拖曳狀態 (Zoom & Pan State)
let zoomScale = 1.0;
let panX = 0;
let panY = 0;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;

// 大眾運輸到站等待時間的 Hash Map (模擬即時轉乘等待分鐘數，用於 Dijkstra 動態處罰)
let transitArrivalHashMap = {
  "bus_station_main_gate": { bus_green11: 1, bus_236: 4 },
  "mrt_gongguan_exit3": { next_train: 2 }
};

// 動態資料結構：使用 JavaScript Object 作為 Hash Map，提供 O(1) 的查詢與更新
let youbikeHashMap = {};    // 儲存 YouBike 站點車位狀態
let edgeWeightHashMap = {}; // 儲存邊的動態加權 (Penalty) 乘數

// 演算法演示模擬狀態
let simState = {
  active: false,
  timer: null,
  distances: {},
  previous: {},
  visited: new Set(),
  queue: [],
  start: "",
  target: "",
  isBiking: false,
  finishing: false
};

// ==========================================
// 2. 初始化與動態 Hash Map 更新
// ==========================================
function initSystem() {
  // 防呆機制：確保 campusGraph.js 資料已載入
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return;
  }

  // 初始化下拉選單
  populateSelectors();
  
  // 根據起點更新大眾運輸 wait times
  updateTransitArrivalTimes(startNodeId);
  
  // 載入預設情境
  switchScenario(currentScenarioId);
  
  // 綁定 UI 事件
  setupEventListeners();
  
  // 繪製地圖與路網
  renderMap();
  
  // 執行首次導航計算
  calculateAndRenderRoutes();
}

/**
 * 根據起點位置與各轉乘站點的直線距離，動態模擬到站時間 (Wait Times)
 */
function updateTransitArrivalTimes(startNode) {
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return;
  }
  const startCoord = CAMPUS_NODES[startNode];
  if (!startCoord) return;
  
  // 模擬 mrt_gongguan_exit3 捷運等待時間 (3~12分)
  const seedMrt = startCoord.x + startCoord.y;
  if (transitArrivalHashMap["mrt_gongguan_exit3"]) {
    transitArrivalHashMap["mrt_gongguan_exit3"].next_train = Math.max(1, Math.floor((seedMrt / 80) % 10) + 2);
  }
  
  // 模擬 bus_station_main_gate 班次等待時間
  if (transitArrivalHashMap["bus_station_main_gate"]) {
    transitArrivalHashMap["bus_station_main_gate"].bus_green11 = Math.max(1, Math.floor((seedMrt / 60) % 8) + 1);
    transitArrivalHashMap["bus_station_main_gate"].bus_236 = Math.max(1, Math.floor((seedMrt / 40) % 12) + 3);
  }
}

/**
 * 更新環境變數與 YouBike 狀態的 Hash Map (時間複雜度：O(E) 預先計算，Dijkstra 查詢時為 O(1))
 */
function updateDynamicHashMap() {
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return;
  }
  if (typeof ENVIRONMENTAL_SCENARIOS === 'undefined') {
      console.error("錯誤：未成功載入 disasterScenario.js 的情境資料！");
      return;
  }
  
  const scenario = ENVIRONMENTAL_SCENARIOS[currentScenarioId];
  
  // 更新 YouBike 站點 Hash Map，複製模擬狀態
  youbikeHashMap = {};
  for (const stationId in scenario.youbike) {
    youbikeHashMap[stationId] = {
      bikes: scenario.youbike[stationId].bikes,
      docks: scenario.youbike[stationId].docks
    };
  }
  
  // 更新邊權重處罰的 Hash Map
  edgeWeightHashMap = {};
  CAMPUS_EDGES.forEach(edge => {
    let penaltyMultiplier = 1.0;
    
    // 根據當前「情境天氣變數」施加基本路況罰值
    if (scenario.weather.condition === "heavy_rain") {
      // 雨天無遮頂蓋罰值
      if (!edge.hasRoof) {
        penaltyMultiplier += scenario.penalties.noRoof;
      }
      // 雨天易打滑路面罰值
      if (edge.surface === "marble") {
        penaltyMultiplier += scenario.penalties.slippery;
      }
    } else if (scenario.weather.condition === "heat") {
      // 高溫無遮蔭罰值
      if (!edge.hasShade) {
        penaltyMultiplier += scenario.penalties.noShade;
      }
      // 高溫爬坡罰值 (乘上坡度等級)
      if (edge.slope > 1) {
        penaltyMultiplier += (edge.slope - 1) * scenario.penalties.slope;
      }
    }
    
    // 根據目前選定的「導航偏好模式」施加額外的路權罰值
    if (currentModeId === "coolest" && !edge.hasShade) {
      penaltyMultiplier += 2.0; // 「最涼模式」對無樹蔭路段施加重罰
    }
    if (currentModeId === "dry" && !edge.hasRoof) {
      penaltyMultiplier += 2.5; // 「少淋雨模式」對露天路段施加重罰
    }
    if (currentModeId === "accessible" && edge.slope > 1) {
      penaltyMultiplier += edge.slope * 4.0; // 「無障礙模式」對陡坡/樓梯施加極重罰值
    }
    
    // 騎車轉乘模式 (bike)：如果邊的任一端點是轉乘站，則加上該站的大眾運輸到站等待時間懲罰 (Wait Penalty)
    if (currentModeId === "bike") {
      let waitTime = 0;
      
      const checkTransitNode = (nodeId) => {
        if (nodeId === "youbike_xinsheng_4" || nodeId === "youbike_xinsheng_3" || nodeId === "youbike_xinsheng_1") {
          // 忠孝新生站對應 mrt_gongguan_exit3 的模擬值
          const data = transitArrivalHashMap["mrt_gongguan_exit3"] || { next_train: 2 };
          return data.next_train;
        }
        if (nodeId === "youbike_guanghua" || nodeId === "youbike_bade") {
          // 光華商場/八德市場對應 bus_station_main_gate 的模擬值
          const data = transitArrivalHashMap["bus_station_main_gate"] || { bus_green11: 1, bus_236: 4 };
          return Math.min(data.bus_green11, data.bus_236);
        }
        return 0;
      };
      
      const w1 = checkTransitNode(edge.source);
      const w2 = checkTransitNode(edge.target);
      waitTime = Math.max(w1, w2);
      
      // 每等待一分鐘，增加 10% (0.1) 的權重處罰
      penaltyMultiplier += waitTime * 0.1;
    }
    
    // 存入 Hash Map 以供 Dijkstra 以 O(1) 時間查詢
    edgeWeightHashMap[edge.id] = penaltyMultiplier;
  });
  
  // 更新演算法解說面板中的狀態顯示
  updateAlgorithmExplanation(scenario);
}

// ==========================================
// 3. Dijkstra 最佳路徑演算法實作
// ==========================================
/**
 * 核心 Dijkstra 演算法計算單源最短路徑
 * @param {string} start 起點節點ID
 * @param {string} target 終點節點ID
 * @param {boolean} isBiking 是否為騎車模式 (騎車速度為步行的 3 倍，且只能在有路面(非樓梯)上騎)
 * @returns {object} 包含路徑節點陣列、物理長度與優化後成本
 */
function dijkstra(start, target, isBiking = false) {
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return { path: [], cost: Infinity, distance: 0 };
  }
  if (!CAMPUS_NODES[start] || !CAMPUS_NODES[target]) {
      return { path: [], cost: Infinity, distance: 0 };
  }
  const distances = {};
  const previous = {};
  const nodes = []; // 模擬優先佇列 (Priority Queue)
  
  // 初始化
  for (const nodeId in CAMPUS_NODES) {
    if (nodeId === start) {
      distances[nodeId] = 0;
    } else {
      distances[nodeId] = Infinity;
    }
    previous[nodeId] = null;
    nodes.push(nodeId);
  }
  
  while (nodes.length > 0) {
    // 找出目前未走過中距離最小的節點
    nodes.sort((a, b) => distances[a] - distances[b]);
    const smallest = nodes.shift();
    
    if (smallest === target) {
      break;
    }
    
    if (distances[smallest] === Infinity) {
      break;
    }
    
    // 尋找相鄰節點
    const neighbors = getNeighbors(smallest);
    for (const neighborId in neighbors) {
      const edge = neighbors[neighborId];
      
      // O(1) 從 Hash Map 取得動態處罰加權乘數
      const penaltyMultiplier = edgeWeightHashMap[edge.id] || 1.0;
      
      // 權重計算方式： 物理長度 * 動態處罰乘數
      let weight = edge.distance * penaltyMultiplier;
      
      // 騎車模式設定
      if (isBiking) {
        // 樓梯/陡坡 (slope=3) 禁止騎車，給予無限大權重處罰
        if (edge.slope >= 3) {
          weight = Infinity;
        } else {
          // 騎車速度為步行的 3 倍，因此等效時間成本/權重除以 3
          weight = weight / 3.0;
        }
      }
      
      const alt = distances[smallest] + weight;
      if (alt < distances[neighborId]) {
        distances[neighborId] = alt;
        previous[neighborId] = smallest;
      }
    }
  }
  
  // 回溯路徑
  const path = [];
  let curr = target;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }
  
  // 計算實際總物理距離
  let totalPhysicalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = getEdgeBetween(path[i], path[i+1]);
    if (edge) totalPhysicalDistance += edge.distance;
  }
  
  return {
    path: path[0] === start ? path : [],
    cost: distances[target],
    distance: totalPhysicalDistance
  };
}

/**
 * 獲取節點的鄰接邊與目標節點
 */
function getNeighbors(nodeId) {
  if (typeof CAMPUS_EDGES === 'undefined') return {};
  const neighbors = {};
  CAMPUS_EDGES.forEach(edge => {
    if (edge.source === nodeId) {
      neighbors[edge.target] = edge;
    } else if (edge.target === nodeId) {
      // 無向圖處理
      neighbors[edge.source] = {
        id: edge.id,
        source: edge.target,
        target: edge.source,
        distance: edge.distance,
        hasRoof: edge.hasRoof,
        hasShade: edge.hasShade,
        slope: edge.slope,
        surface: edge.surface
      };
    }
  });
  return neighbors;
}

/**
 * 獲取兩點之間的邊物件
 */
function getEdgeBetween(n1, n2) {
  if (typeof CAMPUS_EDGES === 'undefined') return null;
  return CAMPUS_EDGES.find(e => 
    (e.source === n1 && e.target === n2) || 
    (e.source === n2 && e.target === n1)
  );
}

// ==========================================
// 4. 複合路徑規劃：YouBike 臨界警告與動態繞道
// ==========================================
/**
 * YouBike 轉乘/騎車幸福導航規劃 (包含無車可借、滿位無法還之繞道決策)
 */
function planYouBikeRoute(start, target) {
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return { path: [], distance: 0, cost: Infinity };
  }
  if (!CAMPUS_NODES[start] || !CAMPUS_NODES[target]) {
      return { path: [], distance: 0, cost: Infinity };
  }
  // 1. 尋找靠近起點的 YouBike 站點，且「必須可用車輛 >= 3」(避開無車警告站點)
  let startStations = Object.keys(CAMPUS_NODES)
    .filter(id => CAMPUS_NODES[id].isYouBike)
    .map(id => ({
      id: id,
      distance: getStraightLineDistance(CAMPUS_NODES[start], CAMPUS_NODES[id]),
      bikes: youbikeHashMap[id] ? youbikeHashMap[id].bikes : 0
    }))
    .sort((a, b) => a.distance - b.distance);

  // 選出最近且有車(可用數 >= 3)的站點；若全部都缺車，則退而求其次選有車的
  let startStation = startStations.find(s => s.bikes >= 3);
  if (!startStation && startStations.length > 0) {
    startStation = startStations.find(s => s.bikes > 0) || startStations[0];
  }

  // 2. 尋找靠近終點的 YouBike 站點，且「必須空車位 >= 3」(避開滿位警告站點)
  let destStations = Object.keys(CAMPUS_NODES)
    .filter(id => CAMPUS_NODES[id].isYouBike)
    .map(id => ({
      id: id,
      distance: getStraightLineDistance(CAMPUS_NODES[target], CAMPUS_NODES[id]),
      docks: youbikeHashMap[id] ? youbikeHashMap[id].docks : 0
    }))
    .sort((a, b) => a.distance - b.distance);

  // 選出最近且有空位(可用空位 >= 3)的還車站點；若全滿，則退而求其次選有空位的
  let destStation = destStations.find(d => d.docks >= 3);
  if (!destStation && destStations.length > 0) {
    destStation = destStations.find(d => d.docks > 0) || destStations[0];
  }

  if (!startStation || !destStation) {
    return dijkstra(start, target, false);
  }

  // 3. 分段計算導航路徑
  // 第一段：起點步行到借車站
  const seg1 = dijkstra(start, startStation.id, false);
  // 第二段：借車站騎車到還車站 (騎車模式，避開樓梯、速度3倍)
  const seg2 = dijkstra(startStation.id, destStation.id, true);
  // 第三段：還車站步行到終點
  const seg3 = dijkstra(destStation.id, target, false);

  // 合併路徑
  let combinedPath = [];
  if (seg1.path.length > 0 && seg2.path.length > 0 && seg3.path.length > 0) {
    combinedPath = [...seg1.path];
    combinedPath.pop(); // 移除重複的交界節點
    combinedPath.push(...seg2.path);
    combinedPath.pop(); // 移除重複的交界節點
    combinedPath.push(...seg3.path);
  }

  const totalDistance = seg1.distance + seg2.distance + seg3.distance;
  const totalCost = seg1.cost + seg2.cost + seg3.cost;

  return {
    path: combinedPath,
    distance: totalDistance,
    cost: totalCost,
    startStationId: startStation.id,
    destStationId: destStation.id
  };
}

/**
 * 簡易兩點直線距離 (歐氏距離，僅用於尋找最近站點)
 */
function getStraightLineDistance(n1, n2) {
  if (typeof CAMPUS_NODES === 'undefined') return Infinity;
  if (!n1 || !n2) return Infinity;
  return Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
}

// ==========================================
// 5. 路線分析與數據統計計算
// ==========================================
/**
 * 分析規劃出的路線，計算其總步行時間、烈日曝曬率、大雨淋雨率
 */
function analyzeRoute(path, isBikeMode = false) {
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      return { time: 0, distance: 0, exposure: 0, rain: 0 };
  }
  if (typeof ENVIRONMENTAL_SCENARIOS === 'undefined') {
      return { time: 0, distance: 0, exposure: 0, rain: 0 };
  }
  if (!path || path.length < 2) {
    return { time: 0, distance: 0, exposure: 0, rain: 0 };
  }

  let totalDistance = 0;
  let exposedDistance = 0;
  let rainDistance = 0;
  let totalTime = 0; // 分鐘

  const scenario = ENVIRONMENTAL_SCENARIOS[currentScenarioId];

  // 逐段分析邊的屬性
  for (let i = 0; i < path.length - 1; i++) {
    const n1 = path[i];
    const n2 = path[i+1];
    const edge = getEdgeBetween(n1, n2);
    if (!edge) continue;

    totalDistance += edge.distance;
    
    // 是否騎車路段
    const isSegmentBiking = isBikeMode && 
                            CAMPUS_NODES[n1] && CAMPUS_NODES[n1].isYouBike && 
                            CAMPUS_NODES[n2] && CAMPUS_NODES[n2].isYouBike;

    // 速度換算 (步行 1.3 m/s = 80 m/min; 騎車 4.0 m/s = 240 m/min)
    const speed = isSegmentBiking ? 240 : 80;
    totalTime += edge.distance / speed;

    // 統計曝曬 (無蔭路段)
    if (!edge.hasShade) {
      exposedDistance += edge.distance;
    }
    // 統計淋雨 (無雨遮路段)
    if (!edge.hasRoof) {
      rainDistance += edge.distance;
    }
  }

  const exposureRate = totalDistance > 0 ? Math.round((exposedDistance / totalDistance) * 100) : 0;
  const rainRate = totalDistance > 0 ? Math.round((rainDistance / totalDistance) * 100) : 0;

  // 雨天或高溫情境微調統計回饋
  let displayExposure = scenario.weather.condition === "heat" ? exposureRate : 0;
  let displayRain = scenario.weather.condition === "heavy_rain" ? rainRate : 0;

  return {
    time: Math.max(1, Math.round(totalTime)),
    distance: totalDistance,
    exposure: displayExposure,
    rain: displayRain
  };
}

// ==========================================
// 6. UI 事件與模擬控制
// ==========================================
function populateSelectors() {
  if (typeof CAMPUS_NODES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return;
  }
  const startSelect = document.getElementById("start-select");
  const endSelect = document.getElementById("end-select");
  
  if (!startSelect || !endSelect) return;

  startSelect.innerHTML = "";
  endSelect.innerHTML = "";

  // 創建起點的 optgroup
  const startYoubikeGroup = document.createElement("optgroup");
  startYoubikeGroup.label = "🚲 YouBike 站點";
  
  const startLandmarkGroup = document.createElement("optgroup");
  startLandmarkGroup.label = "📍 重要地標";

  for (const nodeId in CAMPUS_NODES) {
    const node = CAMPUS_NODES[nodeId];
    if (node.isYouBike) {
      const opt = document.createElement("option");
      opt.value = node.id;
      opt.textContent = node.name;
      startYoubikeGroup.appendChild(opt);
    } else if (node.type === "transit" || node.type === "dorm") {
      const opt = document.createElement("option");
      opt.value = node.id;
      opt.textContent = node.name;
      startLandmarkGroup.appendChild(opt);
    }
  }
  startSelect.appendChild(startYoubikeGroup);
  startSelect.appendChild(startLandmarkGroup);

  // 創建終點的 optgroup
  const endBuildingGroup = document.createElement("optgroup");
  endBuildingGroup.label = "🏫 教學大樓";

  for (const nodeId in CAMPUS_NODES) {
    const node = CAMPUS_NODES[nodeId];
    if (node.type === "building") {
      const opt = document.createElement("option");
      opt.value = node.id;
      opt.textContent = node.name;
      endBuildingGroup.appendChild(opt);
    }
  }
  endSelect.appendChild(endBuildingGroup);

  // 設定預設選取
  startSelect.value = startNodeId;
  endSelect.value = endNodeId;
}

function setupEventListeners() {
  // 1. 起終點選擇改變
  document.getElementById("start-select").addEventListener("change", (e) => {
    startNodeId = e.target.value;
    stopAlgoDemo();
    updateTransitArrivalTimes(startNodeId); // 更新大眾運輸 wait times
    updateDynamicHashMap();                 // 重新計算處罰權重
    calculateAndRenderRoutes();
  });

  document.getElementById("end-select").addEventListener("change", (e) => {
    endNodeId = e.target.value;
    stopAlgoDemo();
    calculateAndRenderRoutes();
  });

  // 2. 交換起訖點按鈕
  document.getElementById("swap-btn").addEventListener("click", () => {
    // 由於起點跟終點的節點分類有些微不同，如果交叉了就先直接對調，防呆容錯
    const temp = startNodeId;
    startNodeId = endNodeId;
    endNodeId = temp;
    
    stopAlgoDemo();
    
    // 重建選單選項，使下拉選單能接受混雜狀態
    ensureHybridOptions();
    
    document.getElementById("start-select").value = startNodeId;
    document.getElementById("end-select").value = endNodeId;
    
    updateTransitArrivalTimes(startNodeId); // 更新大眾運輸 wait times
    updateDynamicHashMap();                 // 重新計算處罰權重
    calculateAndRenderRoutes();
  });

  // 3. 情境模擬按鈕點擊 (頂部浮動 pills)
  document.querySelectorAll(".weather-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const scenarioId = pill.getAttribute("data-scenario");
      stopAlgoDemo();
      switchScenario(scenarioId);
    });
  });

  // 4. 偏好模式分頁點擊
  document.querySelectorAll(".mode-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentModeId = tab.getAttribute("data-mode");
      
      stopAlgoDemo();
      updateDynamicHashMap();
      calculateAndRenderRoutes();
    });
  });

  // 5. 開始導航按鈕 (防呆機制)
  document.getElementById("navigate-btn").addEventListener("click", () => {
    const startVal = document.getElementById("start-select").value;
    const endVal = document.getElementById("end-select").value;
    
    stopAlgoDemo();
    
    if (!startVal || !endVal || startVal === endVal) {
      showToast("⚠️ 請選擇相異的起點與目的地！");
      return;
    }

    showToast("🚀 動態路徑規劃成功！導航開始...");
    calculateAndRenderRoutes();
  });

  // 6. 演算法演示按鈕
  const demoBtn = document.getElementById("algo-demo-btn");
  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      if (simState.active) {
        stopAlgoDemo();
        calculateAndRenderRoutes();
      } else {
        startAlgoDemo();
      }
    });
  }

  // 7. 多分頁導覽按鈕點擊 (以 CSS 切換隱藏，保留 DOM)
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const targetPageId = tab.getAttribute("data-page");
      document.querySelectorAll(".page-container").forEach(page => {
        page.classList.remove("active-page");
        page.style.display = "none";
      });
      
      const activePage = document.getElementById(targetPageId);
      if (activePage) {
        activePage.classList.add("active-page");
        activePage.style.display = "flex";
      }
    });
  });

  // 8. 雙路徑指標對比最小化/展開事件
  const compCard = document.getElementById("comparison-card");
  const minimizeBtn = document.getElementById("minimize-comparison-btn");
  if (compCard && minimizeBtn) {
    minimizeBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 阻止事件冒泡，防止觸發卡片點擊展開
      compCard.classList.add("minimized");
    });
    
    compCard.addEventListener("click", () => {
      if (compCard.classList.contains("minimized")) {
        compCard.classList.remove("minimized");
      }
    });
  }

  // 9. 地圖縮放與平移拖曳初始化
  setupMapZoomAndPan();
}

function ensureHybridOptions() {
  if (typeof CAMPUS_NODES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return;
  }
  const startSelect = document.getElementById("start-select");
  const endSelect = document.getElementById("end-select");

  // 暫時將所有節點分組塞入兩個選單，以支援雙向交換與漂亮的分類結構
  [startSelect, endSelect].forEach(select => {
    select.innerHTML = "";
    
    const youbikeGroup = document.createElement("optgroup");
    youbikeGroup.label = "🚲 YouBike 站點";
    
    const buildingGroup = document.createElement("optgroup");
    buildingGroup.label = "🏫 教學大樓";
    
    const landmarkGroup = document.createElement("optgroup");
    landmarkGroup.label = "📍 重要地標";
    
    for (const id in CAMPUS_NODES) {
      const node = CAMPUS_NODES[id];
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = node.name;
      
      if (node.isYouBike) {
        youbikeGroup.appendChild(opt);
      } else if (node.type === "building") {
        buildingGroup.appendChild(opt);
      } else {
        landmarkGroup.appendChild(opt);
      }
    }
    
    select.appendChild(youbikeGroup);
    select.appendChild(buildingGroup);
    select.appendChild(landmarkGroup);
  });
}

/**
 * 切換情境，更新地圖與路權
 */
function switchScenario(scenarioId) {
  currentScenarioId = scenarioId;
  
  // 更新浮動天氣藥丸選取狀態
  document.querySelectorAll(".weather-pill").forEach(pill => {
    if (pill.getAttribute("data-scenario") === scenarioId) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }
  });

  // 更新地圖 canvas 容器的背景 Class (天氣深淺連動)
  const mapCanvas = document.querySelector(".map-canvas");
  if (mapCanvas) {
    mapCanvas.className = "map-canvas " + scenarioId;
  }

  // 更新動態 Hash Map
  updateDynamicHashMap();

  // 更新地圖上的環境區域覆蓋層
  const rainOverlay = document.getElementById("rain-overlay");
  const heatOverlay = document.getElementById("heat-overlay");
  const rainLabel = document.getElementById("rain-label");
  const heatLabel = document.getElementById("heat-label");

  if (rainOverlay && heatOverlay) {
    if (scenarioId === "rain") {
      rainOverlay.classList.add("active");
      if (rainLabel) rainLabel.classList.add("active");
      heatOverlay.classList.remove("active");
      if (heatLabel) heatLabel.classList.remove("active");
    } else if (scenarioId === "heat") {
      heatOverlay.classList.add("active");
      if (heatLabel) heatLabel.classList.add("active");
      rainOverlay.classList.remove("active");
      if (rainLabel) rainLabel.classList.remove("active");
    } else {
      rainOverlay.classList.remove("active");
      heatOverlay.classList.remove("active");
      if (rainLabel) rainLabel.classList.remove("active");
      if (heatLabel) heatLabel.classList.remove("active");
    }
  }

  // 重新計算路線與渲染
  calculateAndRenderRoutes();
}

/**
 * 顯示防呆提示框
 */
function showToast(message) {
  const toast = document.getElementById("alert-toast");
  if (!toast) return;
  
  toast.querySelector(".toast-text").textContent = message;
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// ==========================================
// 7. 地圖渲染與雙路線繪製 (SVG)
// ==========================================
function renderMap() {
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return;
  }
  const svg = document.getElementById("map-svg");
  if (!svg) return;

  // 1. 繪製基本路網背景 (Edges)
  const edgesGroup = document.getElementById("edges-group");
  if (edgesGroup) {
    edgesGroup.innerHTML = "";
    CAMPUS_EDGES.forEach(edge => {
      const n1 = CAMPUS_NODES[edge.source];
      const n2 = CAMPUS_NODES[edge.target];
      if (!n1 || !n2) return;

      // 繪製路網細實線
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("id", `svg-edge-${edge.id}`);
      line.setAttribute("class", "edge-line");
      line.setAttribute("x1", n1.x);
      line.setAttribute("y1", n1.y);
      line.setAttribute("x2", n2.x);
      line.setAttribute("y2", n2.y);
      line.addEventListener("mouseenter", () => showEdgeInspector(edge.id));
      line.addEventListener("mouseleave", () => resetInspector());
      edgesGroup.appendChild(line);

      // 如果有雨遮，在上面繪製細虛線表示
      if (edge.hasRoof) {
        const roofLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        roofLine.setAttribute("class", "edge-roof-indicator");
        roofLine.setAttribute("x1", n1.x);
        roofLine.setAttribute("y1", n1.y);
        roofLine.setAttribute("x2", n2.x);
        roofLine.setAttribute("y2", n2.y);
        edgesGroup.appendChild(roofLine);
      }

      // 如果有樹蔭，在側邊加點綴線表示
      if (edge.hasShade) {
        const shadeLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        shadeLine.setAttribute("class", "edge-shade-indicator");
        shadeLine.setAttribute("x1", n1.x);
        shadeLine.setAttribute("y1", n1.y);
        shadeLine.setAttribute("x2", n2.x);
        shadeLine.setAttribute("y2", n2.y);
        edgesGroup.appendChild(shadeLine);
      }
    });
  }

  // 2. 繪製路口與大樓標記 (Nodes)
  const nodesGroup = document.getElementById("nodes-group");
  if (nodesGroup) {
    nodesGroup.innerHTML = "";
    for (const nodeId in CAMPUS_NODES) {
      const node = CAMPUS_NODES[nodeId];
      
      // 跳過 YouBike 站點，由專屬標記圖層處理
      if (node.isYouBike) continue;

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", `node-group node-${node.type}`);
      group.setAttribute("data-id", node.id);
      group.addEventListener("click", () => handleNodeClick(node.id));
      group.addEventListener("mouseenter", () => showNodeInspector(node.id));
      group.addEventListener("mouseleave", () => resetInspector());

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("class", "node-circle");
      circle.setAttribute("cx", node.x);
      circle.setAttribute("cy", node.y);
      // 根據類型微調大小
      const r = node.type === "building" || node.type === "transit" ? 10 : 6;
      circle.setAttribute("r", r);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", "node-label");
      text.setAttribute("x", node.x);
      text.setAttribute("y", node.y - r - 4);
      text.textContent = node.name;

      group.appendChild(circle);
      group.appendChild(text);
      nodesGroup.appendChild(group);
    }
  }

  // 3. 繪製 YouBike 站點專用圖層
  renderYouBikeMarkers();
}

function renderYouBikeMarkers() {
  if (typeof CAMPUS_NODES === 'undefined') {
      return;
  }
  const youbikeGroup = document.getElementById("youbike-group");
  if (!youbikeGroup) return;
  youbikeGroup.innerHTML = "";

  for (const nodeId in CAMPUS_NODES) {
    const node = CAMPUS_NODES[nodeId];
    if (!node.isYouBike) continue;

    const state = youbikeHashMap[node.id] || { bikes: 10, docks: 15 };
    // 預警判定臨界值：若可用車輛或空位數低於 3，則判定為吃緊/高風險節點
    const isWarning = state.bikes < 3 || state.docks < 3;

    const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
    marker.setAttribute("class", `youbike-marker ${isWarning ? 'warning' : ''}`);
    marker.setAttribute("data-id", node.id);
    marker.addEventListener("click", () => handleNodeClick(node.id));
    marker.addEventListener("mouseenter", () => showNodeInspector(node.id));
    marker.addEventListener("mouseleave", () => resetInspector());

    // 背景圈
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bg.setAttribute("class", "youbike-bg");
    bg.setAttribute("cx", node.x);
    bg.setAttribute("cy", node.y);
    bg.setAttribute("r", 14);

    // 單車符號 (Material Icons Unicode)
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
    icon.setAttribute("class", "youbike-icon");
    icon.setAttribute("x", node.x);
    icon.setAttribute("y", node.y);
    icon.textContent = "pedal_bike";

    // 庫存悬浮標示文字
    const statusText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    statusText.setAttribute("class", "node-label");
    statusText.setAttribute("x", node.x);
    statusText.setAttribute("y", node.y - 18);
    statusText.setAttribute("fill", isWarning ? "var(--error-color)" : "var(--primary-color)");
    statusText.textContent = `🚲:${state.bikes} | 🅿️:${state.docks}`;

    marker.appendChild(bg);
    marker.appendChild(icon);
    marker.appendChild(statusText);
    youbikeGroup.appendChild(marker);
  }
}

/**
 * 點擊地圖節點可快速設定起終點 (極佳互動性)
 */
/**
 * 點擊地圖節點：設定導航起終點，並彈出大樓詳細資訊視窗
 */
function handleNodeClick(nodeId) {
  const node = CAMPUS_NODES[nodeId];
  if (!node) return;

  // 1. 原有的導航起終點規劃邏輯
  if (startNodeId === nodeId) {
    showToast(`📍 節點「${node.name}」已為起點。`);
  } else {
    endNodeId = nodeId;
    ensureHybridOptions();
    if(document.getElementById("start-select")) document.getElementById("start-select").value = startNodeId;
    if(document.getElementById("end-select")) document.getElementById("end-select").value = endNodeId;
    calculateAndRenderRoutes();
  }

  // 2. 新增功能：只有當點擊的節點類型是 "building"（大樓）或具備有名稱的地標時，才顯示詳細資訊
  if (node.type === "building" || node.name) {
    openLandmarkModal(nodeId);
  }
}

/**
 * 動態開啟彈出視窗並加載對應的北科大圖片與大樓描述 (全地標支援版)
 */
function openLandmarkModal(nodeId) {
  const node = CAMPUS_NODES[nodeId];
  if (!node) return;

  const modal = document.getElementById("landmark-modal");
  const titleEl = document.getElementById("modal-title");
  const imageEl = document.getElementById("modal-image");
  const descEl = document.getElementById("modal-desc");

  if (!modal || !titleEl) return;

  // 1. 設定標題
  titleEl.innerText = node.name;

  // 2. 設定圖片
  if (imageEl) {
    if (node.photo) {
      imageEl.src = node.photo;
      imageEl.style.display = "block";
      // 圖片加載失敗時隱藏
      imageEl.onerror = function() {
        this.style.display = "none";
      };
    } else {
      imageEl.style.display = "none";
    }
  }

  // 3. 設定簡介與動態詳細狀態 (比如 YouBike 的可用車位或大眾運輸資訊)
  if (descEl) {
    let descHtml = `<div class="modal-description-text">${node.desc || "此地標暫無詳細介紹。"}</div>`;
    
    // 如果是 YouBike 站點，顯示即時車位與臨界值預警
    if (node.isYouBike) {
      const ybStatus = youbikeHashMap[nodeId] || { bikes: 0, docks: 0 };
      const isWarning = ybStatus.bikes < 3 || ybStatus.docks < 3;
      descHtml += `
        <div class="modal-extra-info youbike-status-info ${isWarning ? 'warning-status' : ''}">
          <div class="info-title">
            <span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 4px; font-size: 18px;">pedal_bike</span>
            YouBike 站點即時狀態
          </div>
          <div class="info-grid" style="display: flex; justify-content: space-between; margin-top: 8px; margin-bottom: 8px;">
            <div class="info-item" style="flex: 1; text-align: center; border-right: 1px solid rgba(0,0,0,0.05);">
              <span class="info-label" style="display: block; font-size: 11px; color: var(--text-muted);">🚲 可借車輛</span>
              <span class="info-value" style="font-size: 16px; font-weight: 700; color: ${ybStatus.bikes < 3 ? 'var(--error-color)' : 'var(--primary-color)'};">${ybStatus.bikes} 輛</span>
            </div>
            <div class="info-item" style="flex: 1; text-align: center;">
              <span class="info-label" style="display: block; font-size: 11px; color: var(--text-muted);">🅿️ 可用空位</span>
              <span class="info-value" style="font-size: 16px; font-weight: 700; color: ${ybStatus.docks < 3 ? 'var(--error-color)' : 'var(--primary-color)'};">${ybStatus.docks} 個</span>
            </div>
          </div>
          ${isWarning ? `
            <div class="info-warning" style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--error-color); background: rgba(231, 76, 60, 0.05); padding: 6px; border-radius: 4px; margin-top: 6px;">
              <span class="material-symbols-outlined" style="font-size: 14px;">warning</span>
              <span>站點車位吃緊！可用數少於 3，有無法借還車風險，已啟動自動繞道避險。</span>
            </div>
          ` : `
            <div class="info-success" style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--primary-color); background: rgba(46, 204, 113, 0.05); padding: 6px; border-radius: 4px; margin-top: 6px;">
              <span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span>
              <span>車源與車位充足，可放心前往借還。</span>
            </div>
          `}
        </div>
      `;
    } else if (node.type === "transit") {
      descHtml += `
        <div class="modal-extra-info transit-status-info" style="background: rgba(52, 152, 219, 0.05); padding: var(--spacing-sm); border-radius: var(--radius-sm); border-left: 3px solid var(--secondary-color); margin-top: var(--spacing-sm);">
          <div class="info-title" style="display: flex; align-items: center; font-size: 12px; font-weight: 700; color: var(--secondary-color); margin-bottom: 4px;">
            <span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">directions_subway</span>
            聯外轉乘樞紐
          </div>
          <p class="transit-desc" style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin: 0;">此節點提供聯外大眾運輸服務。於偏好設定中選擇<b>「騎車轉乘」</b>時，系統將結合 YouBike 進行最佳複合路徑規劃，並以 O(1) 雜湊表動態載入轉乘等待時間進行避堵規劃。</p>
        </div>
      `;
    } else if (node.type === "building") {
      descHtml += `
        <div class="modal-extra-info building-status-info" style="background: rgba(241, 196, 15, 0.05); padding: var(--spacing-sm); border-radius: var(--radius-sm); border-left: 3px solid var(--accent-color); margin-top: var(--spacing-sm);">
          <div class="info-title" style="display: flex; align-items: center; font-size: 12px; font-weight: 700; color: #d4ac0d; margin-bottom: 4px;">
            <span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">domain</span>
            校園主要建築
          </div>
          <p class="building-desc" style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin: 0;">在下雨或高溫情境下，此建築周邊路段將根據是否有<b>雨遮長廊</b>或<b>樹蔭覆蓋</b>而動態調配路權加權，導航系統會自動優先引導通行或避開曝曬/淋雨段。</p>
        </div>
      `;
    }

    descEl.innerHTML = descHtml;
  }

  modal.classList.add("show");
} 

function calculateAndRenderRoutes() {
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return;
  }
  if (!startNodeId || !endNodeId || startNodeId === endNodeId) return;

  // 如果演算法演示模擬正在執行中，且不是由模擬結束或正在渲染觸發的，則重置它
  if (simState.active && !simState.finishing) {
    stopAlgoDemo();
  }

  // 1. 高亮起點與終點節點
  document.querySelectorAll(".node-group, .youbike-marker").forEach(g => {
    const id = g.getAttribute("data-id");
    g.classList.remove("node-origin", "node-destination", "visiting", "visited");
    if (id === startNodeId) {
      g.classList.add("node-origin");
    } else if (id === endNodeId) {
      g.classList.add("node-destination");
    }
  });

  // 2. 規劃路線 A：原始最快路線 (無環境權重處罰的最短 Dijkstra)
  // 備註：在一般正常情境下的無處罰物理最短路徑，提供對比呈現
  let originalResult;
  if (currentModeId === "bike") {
    // 騎車模式下正常情況的 YouBike 連接
    // 暫時備份當前 Hash Map 以便用正常狀態計算
    const backupScenario = currentScenarioId;
    currentScenarioId = "normal";
    updateDynamicHashMap();
    originalResult = planYouBikeRoute(startNodeId, endNodeId);
    // 還原
    currentScenarioId = backupScenario;
    updateDynamicHashMap();
  } else {
    // 步行模式正常情況下 Dijkstra
    const tempBackup = { ...edgeWeightHashMap };
    // 暫時將所有邊罰值設為 1.0 (無處罰)
    for (const key in edgeWeightHashMap) edgeWeightHashMap[key] = 1.0;
    originalResult = dijkstra(startNodeId, endNodeId, false);
    // 還原
    edgeWeightHashMap = tempBackup;
  }

  // 3. 規劃路線 B：優化後的幸福路線 (包含天氣、路面、YouBike吃緊狀況的 Dijkstra 運算)
  let happyResult;
  if (currentModeId === "bike") {
    happyResult = planYouBikeRoute(startNodeId, endNodeId);
  } else {
    happyResult = dijkstra(startNodeId, endNodeId, false);
  }

  // 4. 繪製兩條線到 SVG 上
  const pathOriginal = document.getElementById("route-original");
  const pathHappy = document.getElementById("route-happy");
  const pathFlow = document.getElementById("route-flow");

  if (pathOriginal && pathHappy && pathFlow) {
    const originalPointsStr = getSvgPathString(originalResult.path);
    const happyPointsStr = getSvgPathString(happyResult.path);

    // 繪製原始路徑 (紅虛線)
    if (originalPointsStr) {
      pathOriginal.setAttribute("d", originalPointsStr);
      pathOriginal.setAttribute("opacity", "0.75");
    } else {
      pathOriginal.setAttribute("opacity", "0");
    }

    // 繪製幸福路徑 (螢光綠粗發光線)
    if (happyPointsStr) {
      pathHappy.setAttribute("d", happyPointsStr);
      pathHappy.setAttribute("opacity", "1");
      pathFlow.setAttribute("d", happyPointsStr);
      pathFlow.setAttribute("opacity", "0.9");
    } else {
      pathHappy.setAttribute("opacity", "0");
      pathFlow.setAttribute("opacity", "0");
      showToast("⚠️ 警告：當前偏好模式下無可行之無障礙路徑！");
    }
  }

  // 5. 更新地圖道路的基礎高亮與動態邊權重 (邊寬度/顏色隨罰值變化)
  updateMapEdgesVisuals();
  
  CAMPUS_EDGES.forEach(edge => {
    const line = document.getElementById(`svg-edge-${edge.id}`);
    if (line) {
      line.classList.remove("exploring");
      if (isEdgeInPath(edge, happyResult.path)) {
        line.classList.add("active-segment");
      } else {
        line.classList.remove("active-segment");
      }
    }
  });

  // 6. 統計數據更新 (雙路徑指標對比)
  const isBikingActive = (currentModeId === "bike");
  const statsHappy = analyzeRoute(happyResult.path, isBikingActive);
  const statsOrig = analyzeRoute(originalResult.path, isBikingActive);
  
  // 更新時間
  document.getElementById("comp-orig-time").textContent = `${statsOrig.time} 分鐘 (${statsOrig.distance}m)`;
  document.getElementById("comp-happy-time").textContent = `${statsHappy.time} 分鐘 (${statsHappy.distance}m)`;
  
  // 樹蔭避曬 %
  document.getElementById("comp-orig-sun").textContent = `${100 - statsOrig.exposure}% 遮蔭`;
  document.getElementById("comp-happy-sun").textContent = `${100 - statsHappy.exposure}% 遮蔭`;
  
  // 走廊雨遮 %
  document.getElementById("comp-orig-rain").textContent = `${100 - statsOrig.rain}% 雨遮`;
  document.getElementById("comp-happy-rain").textContent = `${100 - statsHappy.rain}% 雨遮`;

  // YouBike 風險
  let origRisk = "無風險";
  let happyRisk = "無風險";
  
  if (currentModeId === "bike") {
    const origStart = originalResult.startStationId;
    const origDest = originalResult.destStationId;
    const origStartState = youbikeHashMap[origStart] || { bikes: 10, docks: 15 };
    const origDestState = youbikeHashMap[origDest] || { bikes: 10, docks: 15 };
    
    if (origStartState.bikes < 3 || origDestState.docks < 3) {
      origRisk = "⚠️ 高風險 (車位吃緊)";
    } else {
      origRisk = "低風險";
    }
    
    const happyStart = happyResult.startStationId;
    const happyDest = happyResult.destStationId;
    if (happyStart !== origStart || happyDest !== origDest) {
      happyRisk = "✓ 已自動繞道避險";
    } else {
      happyRisk = "低風險";
    }
  } else {
    origRisk = "--";
    happyRisk = "無風險 (步行)";
  }
  
  document.getElementById("comp-orig-bike").textContent = origRisk;
  document.getElementById("comp-happy-bike").textContent = happyRisk;
}

/**
 * 輔助函數：將路徑節點 ID 陣列轉換成 SVG 的 d 屬性線段格式
 */
function getSvgPathString(path) {
  if (!path || path.length < 2) return "";
  
  return path.map((nodeId, idx) => {
    const node = CAMPUS_NODES[nodeId];
    if (!node) return "";
    return `${idx === 0 ? 'M' : 'L'} ${node.x} ${node.y}`;
  }).join(" ");
}

/**
 * 檢查某條邊是否在規劃出的路徑中
 */
function isEdgeInPath(edge, path) {
  if (!path || path.length < 2) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if (
      (path[i] === edge.source && path[i+1] === edge.target) ||
      (path[i] === edge.target && path[i+1] === edge.source)
    ) {
      return true;
    }
  }
  return false;
}

// ==========================================
// 8. 演算法解說面板資訊渲染
// ==========================================
function updateAlgorithmExplanation(scenario) {
  if (typeof CAMPUS_NODES === 'undefined' || !scenario) {
      return;
  }
  const textContainer = document.getElementById("algorithm-desc-container");
  if (!textContainer) return;

  let detailsHtml = "";

  // 依據當前模式動態組裝解說內容
  if (currentModeId === "fastest") {
    detailsHtml = `
      <div style="margin-bottom: 8px;"><strong>⚡ 最快路線模式：</strong></div>
      <div>使用標準 Dijkstra 計算邊物理距離最短路徑。不額外施加天氣或路面處罰權重。</div>
    `;
  } else if (currentModeId === "coolest") {
    detailsHtml = `
      <div style="margin-bottom: 8px;"><strong>🍃 最涼避曝曬模式：</strong></div>
      <div>Dijkstra 演算法讀取 Hash Map。由於處於高溫情境，無樹蔭遮蔽的露天道路之權重被<strong>調高 250% (處罰罰值 +2.5)</strong>，導航演算法在尋路時會強制改道至大樓長廊與綠蔭處。</div>
    `;
  } else if (currentModeId === "dry") {
    detailsHtml = `
      <div style="margin-bottom: 8px;"><strong>☔ 少淋雨走廊模式：</strong></div>
      <div>下雨情境下，無雨遮頂蓋的露天路段之權重被<strong>調高 300% (罰值 +3.0)</strong>。此外，斑馬線與大理石路面雨天易打滑，權重被額外<strong>加重 200% (罰值 +2.0)</strong>。Dijkstra 演算法自動規劃高密度的室內連通道與騎樓。</div>
    `;
  } else if (currentModeId === "accessible") {
    detailsHtml = `
      <div style="margin-bottom: 8px;"><strong>♿ 無障礙避陡坡模式：</strong></div>
      <div>演算法評估邊的 slope 屬性。當坡度等級為 2 時權重加重，當坡度等級為 3 (如共同教室旁樓梯) 時，權重被<strong>處罰放大 12 倍</strong>，引導腳部受傷或推重物成員尋找平緩坡道。</div>
    `;
  } else if (currentModeId === "bike") {
    // 騎車轉乘模式
    const mrtBikes = youbikeHashMap["youbike_xinsheng_4"] ? youbikeHashMap["youbike_xinsheng_4"].bikes : 0;
    const scienceDocks = youbikeHashMap["youbike_ee"] ? youbikeHashMap["youbike_ee"].docks : 0;
    
    detailsHtml = `
      <div style="margin-bottom: 8px;"><strong>🚲 騎車轉乘模式：</strong></div>
      <div style="margin-bottom: 4px;">結合步行與騎乘。騎車段速度提升 3 倍，斜坡 slope &ge; 3 (樓梯/陡坡) 禁止騎車。</div>
      <div style="margin-bottom: 4px; color: var(--secondary-color);">* 整合轉乘站即時到站等待時間 Wait Penalty（每等待 1 分鐘，權重處罰 +0.1）。</div>
      ${scenario.name.includes("YouBike") || scenario.name.includes("供需") || currentScenarioId === "youbike_clog" ? `
        <div style="color: var(--error-color); margin-top: 6px; border-top: 1px dashed rgba(255,180,171,0.2); padding-top: 4px;">
          <strong>⚠️ YouBike 臨界繞道警告：</strong><br>
          偵測到起點忠孝新生站(4號出口)可用車為 <strong>${mrtBikes} 輛</strong>，目的地電機工程系站可用空車位為 <strong>${scienceDocks} 個</strong> (皆 &lt; 3，高風險臨界)。<br>
          演算法自動避險，引導至車源充足之站點。
        </div>
      ` : `
        <div style="color: var(--primary-color); margin-top: 6px;">
          ✓ 系統以 O(1) 動態查詢轉乘等待時間與車位，規避高延遲站點。
        </div>
      `}
    `;
  }

  textContainer.innerHTML = detailsHtml;

  // 每次情境切換重新渲染 YouBike 圖層 (以套用吃緊狀態下的呼吸警告)
  renderYouBikeMarkers();
}

// ==========================================
// 9. Hover Inspectors & Pathfinding Step-Run
// ==========================================

function showNodeInspector(nodeId) {
  if (typeof CAMPUS_NODES === 'undefined') return;
  const node = CAMPUS_NODES[nodeId];
  if (!node) return;
  
  const state = {
    id: node.id,
    name: node.name,
    type: node.type,
    coordinates: { x: node.x, y: node.y }
  };
  
  if (node.isYouBike) {
    const youbikeStatus = youbikeHashMap[nodeId] || { bikes: 0, docks: 0 };
    state.youbike_status = {
      availableBikes: youbikeStatus.bikes,
      availableDocks: youbikeStatus.docks,
      warningActive: (youbikeStatus.bikes < 3 || youbikeStatus.docks < 3) ? "⚠️ High Risk (< 3)" : "Low Risk"
    };
  }
  
  const inspector = document.getElementById("hash-map-inspector");
  if (inspector) {
    inspector.textContent = JSON.stringify(state, null, 2);
  }
}

function showEdgeInspector(edgeId) {
  if (typeof CAMPUS_EDGES === 'undefined' || typeof CAMPUS_NODES === 'undefined') return;
  const edge = CAMPUS_EDGES.find(e => e.id === edgeId);
  if (!edge) return;
  
  const state = {
    id: edge.id,
    source: CAMPUS_NODES[edge.source]?.name || edge.source,
    target: CAMPUS_NODES[edge.target]?.name || edge.target,
    physicalDistance_m: edge.distance,
    attributes: {
      hasRoof: edge.hasRoof,
      hasShade: edge.hasShade,
      slopeGrade: edge.slope === 1 ? "Flat" : edge.slope === 2 ? "Moderate" : "Steep/Stairs",
      roadSurface: edge.surface
    },
    currentPenaltyFactor: edgeWeightHashMap[edge.id] || 1.0,
    weightedCost: edge.distance * (edgeWeightHashMap[edge.id] || 1.0)
  };
  
  document.getElementById("hash-map-inspector").textContent = JSON.stringify(state, null, 2);
}

function resetInspector() {
  document.getElementById("hash-map-inspector").textContent = "Hover over node/edge to inspect...";
}

function updateMapEdgesVisuals() {
  CAMPUS_EDGES.forEach(edge => {
    const line = document.getElementById(`svg-edge-${edge.id}`);
    if (!line) return;
    
    const penalty = edgeWeightHashMap[edge.id] || 1.0;
    
    if (penalty > 3.0) {
      // 暴雨無雨遮 or 大理石打滑 -> 變粗變紅
      line.style.stroke = "var(--error-color)";
      line.style.strokeWidth = "6px";
    } else if (penalty > 1.5) {
      // 高溫或中度罰值 -> 變橘黃色
      line.style.stroke = "var(--accent-color)";
      line.style.strokeWidth = "5px";
    } else {
      // 正常路段
      line.style.stroke = "";
      line.style.strokeWidth = "";
    }
  });
}

function startAlgoDemo() {
  if (typeof CAMPUS_NODES === 'undefined' || typeof CAMPUS_EDGES === 'undefined') {
      console.error("錯誤：未成功載入 campusGraph.js 的路網資料！");
      return;
  }
  stopAlgoDemo();
  
  simState.active = true;
  simState.start = startNodeId;
  simState.target = endNodeId;
  simState.isBiking = (currentModeId === "bike");
  simState.visited.clear();
  
  const demoBtn = document.getElementById("algo-demo-btn");
  if (demoBtn) {
    demoBtn.innerHTML = `<span class="material-symbols-outlined">pause</span> 暫停演示`;
    demoBtn.style.borderColor = "var(--error-color)";
    demoBtn.style.color = "var(--error-color)";
  }
  
  simState.distances = {};
  simState.previous = {};
  simState.queue = [];
  
  for (const nodeId in CAMPUS_NODES) {
    if (nodeId === simState.start) {
      simState.distances[nodeId] = 0;
    } else {
      simState.distances[nodeId] = Infinity;
    }
    simState.previous[nodeId] = null;
    simState.queue.push(nodeId);
  }
  
  document.querySelectorAll(".node-group, .youbike-marker").forEach(g => {
    g.classList.remove("visiting", "visited", "node-origin", "node-destination");
    const id = g.getAttribute("data-id");
    if (id === simState.start) g.classList.add("node-origin");
    else if (id === simState.target) g.classList.add("node-destination");
  });
  
  document.querySelectorAll(".edge-line").forEach(line => {
    line.classList.remove("active-segment", "exploring");
  });
  
  document.getElementById("route-happy").setAttribute("opacity", "0");
  document.getElementById("route-flow").setAttribute("opacity", "0");
  
  simState.timer = setInterval(stepAlgoDemo, 400);
}

function stopAlgoDemo() {
  if (simState.timer) {
    clearInterval(simState.timer);
    simState.timer = null;
  }
  simState.active = false;
  
  const demoBtn = document.getElementById("algo-demo-btn");
  if (demoBtn) {
    demoBtn.innerHTML = `<span class="material-symbols-outlined">play_arrow</span> 演算法演示`;
    demoBtn.style.borderColor = "var(--secondary-color)";
    demoBtn.style.color = "var(--secondary-color)";
  }
}

function stepAlgoDemo() {
  if (simState.queue.length === 0) {
    finishAlgoDemo(false);
    return;
  }
  
  simState.queue.sort((a, b) => simState.distances[a] - simState.distances[b]);
  const currNodeId = simState.queue.shift();
  
  if (simState.distances[currNodeId] === Infinity) {
    finishAlgoDemo(false);
    return;
  }
  
  document.querySelectorAll(".node-group, .youbike-marker").forEach(g => {
    g.classList.remove("visiting");
    if (g.getAttribute("data-id") === currNodeId) {
      g.classList.add("visiting");
    }
  });
  
  if (typeof CAMPUS_NODES === 'undefined') {
    finishAlgoDemo(false);
    return;
  }
  const activeNode = CAMPUS_NODES[currNodeId];
  if (!activeNode) {
    finishAlgoDemo(false);
    return;
  }
  
  const inspector = document.getElementById("hash-map-inspector");
  if (inspector) {
    inspector.textContent = JSON.stringify({
      phase: "Algorithm Step-Run Search",
      currentNode: activeNode.name,
      minDistance: simState.distances[currNodeId] === Infinity ? "Infinity" : `${simState.distances[currNodeId].toFixed(1)} m`,
      parentLink: (simState.previous[currNodeId] && CAMPUS_NODES[simState.previous[currNodeId]]) ? CAMPUS_NODES[simState.previous[currNodeId]].name : "None",
      visitedCount: simState.visited.size
    }, null, 2);
  }
  
  if (currNodeId === simState.target) {
    finishAlgoDemo(true);
    return;
  }
  
  const neighbors = getNeighbors(currNodeId);
  for (const neighborId in neighbors) {
    const edge = neighbors[neighborId];
    if (simState.visited.has(neighborId)) continue;
    
    const edgeLine = document.getElementById(`svg-edge-${edge.id}`);
    if (edgeLine) {
      edgeLine.classList.add("exploring");
    }
    
    const penaltyMultiplier = edgeWeightHashMap[edge.id] || 1.0;
    let weight = edge.distance * penaltyMultiplier;
    
    if (simState.isBiking) {
      if (edge.slope >= 3) {
        weight = Infinity;
      } else {
        weight = weight / 3.0;
      }
    }
    
    const alt = simState.distances[currNodeId] + weight;
    if (alt < simState.distances[neighborId]) {
      simState.distances[neighborId] = alt;
      simState.previous[neighborId] = currNodeId;
    }
  }
  
  simState.visited.add(currNodeId);
  
  document.querySelectorAll(".node-group, .youbike-marker").forEach(g => {
    const id = g.getAttribute("data-id");
    if (simState.visited.has(id) && id !== simState.start && id !== simState.target) {
      g.classList.add("visited");
    }
  });
  
  updateMinHeapPanel();
}

function updateMinHeapPanel() {
  const panel = document.getElementById("min-heap-inspector");
  if (!panel) return;
  
  if (typeof CAMPUS_NODES === 'undefined') {
    panel.innerHTML = "Queue = [] (Empty)";
    return;
  }
  
  const activeQueue = simState.queue
    .filter(id => simState.distances[id] < Infinity && CAMPUS_NODES[id])
    .map(id => ({
      name: CAMPUS_NODES[id].name,
      dist: simState.distances[id]
    }))
    .sort((a, b) => a.dist - b.dist);
    
  if (activeQueue.length === 0) {
    panel.innerHTML = "Queue = [] (Empty)";
    return;
  }
  
  const listHtml = activeQueue.map((item, idx) => {
    return `<div style="margin-bottom: 2px;">[${idx}] ${item.name} (${item.dist.toFixed(1)}m)</div>`;
  }).join("");
  
  panel.innerHTML = listHtml;
}

function finishAlgoDemo(success) {
  simState.finishing = true;
  stopAlgoDemo();
  
  if (success) {
    showToast("🎉 演算法演練成功！已抵達目的地。");
    calculateAndRenderRoutes();
  } else {
    showToast("⚠️ 演算法演示結束，無法找到可行路徑。");
  }
  simState.finishing = false;
}

// ==========================================
// 修正：地標彈出視窗 (Modal) 關閉事件綁定
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("landmark-modal");
  const closeBtn = document.getElementById("close-modal-btn");

  if (closeBtn && modal) {
    // 1. 點擊右上角叉叉 (×) 時關閉視窗
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 防止事件向上冒泡觸發到地圖點擊
      modal.classList.remove("show");
    });

    // 2. 點擊彈出視窗以外的半透明黑色背景區時，也能自動關閉
    modal.addEventListener("click", (e) => {
      // 確保點擊到的是最外層黑底 (landmark-modal) 本身，而不是裡面的文字內容區
      if (e.target === modal) {
        modal.classList.remove("remove"); // 保險起見
        modal.classList.remove("show");
      }
    });
  } else {
    console.error("找不到 Modal 或關閉按鈕元件，請確認 HTML 中的 ID 是否正確。");
  }
});

// ==========================================
// 這是您原本的函式（名稱可能叫 showDetail 或 openModal）
// ==========================================
function showDetail(nodeId) {
    const node = CAMPUS_NODES[nodeId];
    if (!node) return;

    // -------------------------------------------------------------
    // 【這裡請完整保留您原本所有的程式碼】
    // 包含：您原本的 textContent 修改、innerHTML 設定、YouBike 動態數據載入等
    // -------------------------------------------------------------
    
    
    // 🔥【以下是新增的程式碼：只負責安全地將圖片「塞入」最上方，不影響原有內容】🔥
    
    // 1. 先把可能殘留的舊地標圖片移除，避免連續點擊時圖片重複堆疊
    const oldPhoto = document.querySelector('.modal-photo-container');
    if (oldPhoto) {
        oldPhoto.remove();
    }

    // 2. 檢查該節點在 campusGraph.js 中是否有設定 photo 欄位
    if (node.photo) {
        // 建立圖片的容器與 img 標籤
        const photoContainer = document.createElement('div');
        photoContainer.className = 'modal-photo-container';
        
        // 使用 onerror 防呆：如果照片不存在，就自動隱藏，不留破圖
        photoContainer.innerHTML = `
            <img src="${node.photo}" alt="${node.name}" class="modal-landmark-photo" onerror="this.parentNode.style.display='none';">
        `;

        // 3. 找到您的資訊欄內容容器（請確認您的 ID 是否為 'modal-content' 或 'detail-info'）
        const contentEl = document.getElementById('modal-content') || document.getElementById('detail-info');
        
        if (contentEl) {
            // 💡 關鍵安全做法：使用 insertBefore 把圖片插到內容的最前面
            // 這樣您原本寫進 contentEl 的所有文字、即時數據和功能都不會被刪除
            contentEl.insertBefore(photoContainer, contentEl.firstChild);
        }
    }

    // -------------------------------------------------------------
    // 【這裡請完整保留您原本最後的顯示邏輯】
    // 例如：modal.classList.add('active') 或 show() 等
    // -------------------------------------------------------------
}

// ==========================================
// 10. 地圖縮放與拖曳平移功能實作 (Map Zoom & Pan)
// ==========================================
function setupMapZoomAndPan() {
  const mapSvg = document.getElementById("map-svg");
  const mapViewport = document.getElementById("map-viewport");
  const zoomInBtn = document.getElementById("zoom-in-btn");
  const zoomOutBtn = document.getElementById("zoom-out-btn");
  const zoomResetBtn = document.getElementById("zoom-reset-btn");

  if (!mapSvg || !mapViewport) return;

  // 1. 更新 Viewport 渲染 transform
  function updateViewportTransform() {
    mapViewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
  }

  // 2. 縮放微調函式
  function adjustZoom(amount) {
    zoomScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, zoomScale + amount));
    updateViewportTransform();
  }

  // 3. 綁定按鈕點擊事件
  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => adjustZoom(0.25));
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => adjustZoom(-0.25));
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => {
      zoomScale = 1.0;
      panX = 0;
      panY = 0;
      updateViewportTransform();
    });
  }

  // 4. 滾輪縮放 (向上放大，向下縮小)
  mapSvg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomIn = e.deltaY < 0;
    // 每次微調 0.1
    adjustZoom(zoomIn ? 0.1 : -0.1);
  }, { passive: false });

  // 5. 鍵盤快速鍵 (+ 鍵或 = 鍵放大，- 鍵或 _ 鍵縮小)
  window.addEventListener("keydown", (e) => {
    // 避開在選單或輸入框輸入時觸發
    if (document.activeElement.tagName === "SELECT" || document.activeElement.tagName === "INPUT") {
      return;
    }
    if (e.key === "+" || e.key === "=") {
      adjustZoom(0.1);
    } else if (e.key === "-" || e.key === "_") {
      adjustZoom(-0.1);
    }
  });

  // 6. 拖曳平移 (Pan) 實作
  let isPanning = false;
  let startX = 0;
  let startY = 0;

  mapSvg.addEventListener("mousedown", (e) => {
    // 僅支援左鍵拖曳
    if (e.button !== 0) return;
    
    // 如果點擊到節點、YouBike標記或控制按鈕，則不啟動拖曳
    if (e.target.closest(".node-group") || e.target.closest(".youbike-marker") || e.target.closest("button") || e.target.closest("select")) {
      return;
    }
    
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    mapSvg.style.cursor = "grabbing";
    // 暫停 transition，使拖曳平移無延遲，感覺更即時
    mapViewport.style.transition = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateViewportTransform();
  });

  window.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      mapSvg.style.cursor = "default";
      // 恢復 transition
      mapViewport.style.transition = "transform 0.1s ease-out";
    }
  });
}

// ==========================================
// 11. 頁面載入完成啟動
// ==========================================
window.addEventListener("DOMContentLoaded", initSystem);
