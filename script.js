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

// 動態資料結構：使用 JavaScript Object 作為 Hash Map，提供 O(1) 的查詢與更新
let youbikeHashMap = {};    // 儲存 YouBike 站點車位狀態
let edgeWeightHashMap = {}; // 儲存邊的動態加權 (Penalty) 乘數

// ==========================================
// 2. 初始化與動態 Hash Map 更新
// ==========================================
function initSystem() {
  // 初始化下拉選單
  populateSelectors();
  
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
 * 更新環境變數與 YouBike 狀態的 Hash Map (時間複雜度：O(E) 預先計算，Dijkstra 查詢時為 O(1))
 */
function updateDynamicHashMap() {
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
    } else if (scenario.weather.condition === "polluted") {
      // 空污區域處罰
      if (scenario.pollutedEdges && scenario.pollutedEdges.includes(edge.id)) {
        penaltyMultiplier += scenario.penalties.pollution;
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
    if (currentModeId === "pollution" && scenario.pollutedEdges && scenario.pollutedEdges.includes(edge.id)) {
      penaltyMultiplier += 3.0; // 「避開空污模式」對受污染主要幹道施加重罰
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
  return Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
}

// ==========================================
// 5. 路線分析與數據統計計算
// ==========================================
/**
 * 分析規劃出的路線，計算其總步行時間、烈日曝曬率、大雨淋雨率
 */
function analyzeRoute(path, isBikeMode = false) {
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
                            CAMPUS_NODES[n1].isYouBike && 
                            CAMPUS_NODES[n2].isYouBike;

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
  const startSelect = document.getElementById("start-select");
  const endSelect = document.getElementById("end-select");
  
  if (!startSelect || !endSelect) return;

  startSelect.innerHTML = "";
  endSelect.innerHTML = "";

  // 篩選起點 (有 type === 'transit' 或 'dorm' 或 YouBike 站點)
  for (const nodeId in CAMPUS_NODES) {
    const node = CAMPUS_NODES[nodeId];
    if (node.type === "transit" || node.type === "dorm" || node.isYouBike) {
      const opt = document.createElement("option");
      opt.value = node.id;
      opt.textContent = node.name;
      startSelect.appendChild(opt);
    }
  }

  // 篩選終點 (大樓、圖書館或特定教室)
  for (const nodeId in CAMPUS_NODES) {
    const node = CAMPUS_NODES[nodeId];
    if (node.type === "building") {
      const opt = document.createElement("option");
      opt.value = node.id;
      opt.textContent = node.name;
      endSelect.appendChild(opt);
    }
  }

  // 設定預設選取
  startSelect.value = startNodeId;
  endSelect.value = endNodeId;
}

function setupEventListeners() {
  // 1. 起終點選擇改變
  document.getElementById("start-select").addEventListener("change", (e) => {
    startNodeId = e.target.value;
    calculateAndRenderRoutes();
  });

  document.getElementById("end-select").addEventListener("change", (e) => {
    endNodeId = e.target.value;
    calculateAndRenderRoutes();
  });

  // 2. 交換起訖點按鈕
  document.getElementById("swap-btn").addEventListener("click", () => {
    // 由於起點跟終點的節點分類有些微不同，如果交叉了就先直接對調，防呆容錯
    const temp = startNodeId;
    startNodeId = endNodeId;
    endNodeId = temp;
    
    // 重建選單選項，使下拉選單能接受混雜狀態
    ensureHybridOptions();
    
    document.getElementById("start-select").value = startNodeId;
    document.getElementById("end-select").value = endNodeId;
    
    calculateAndRenderRoutes();
  });

  // 3. 情境模擬卡片點擊
  document.querySelectorAll(".scenario-card").forEach(card => {
    card.addEventListener("click", () => {
      const scenarioId = card.getAttribute("data-scenario");
      switchScenario(scenarioId);
    });
  });

  // 4. 偏好模式分頁點擊
  document.querySelectorAll(".mode-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentModeId = tab.getAttribute("data-mode");
      
      updateDynamicHashMap();
      calculateAndRenderRoutes();
    });
  });

  // 5. 開始導航按鈕 (防呆機制)
  document.getElementById("navigate-btn").addEventListener("click", () => {
    const startVal = document.getElementById("start-select").value;
    const endVal = document.getElementById("end-select").value;
    
    if (!startVal || !endVal || startVal === endVal) {
      showToast("⚠️ 請選擇相異的起點與目的地！");
      return;
    }

    showToast("🚀 動態路徑規劃成功！導航開始...");
  });
}

function ensureHybridOptions() {
  const startSelect = document.getElementById("start-select");
  const endSelect = document.getElementById("end-select");

  // 暫時將所有節點塞入兩個選單，以支援雙向交換的靈活性
  [startSelect, endSelect].forEach(select => {
    select.innerHTML = "";
    for (const id in CAMPUS_NODES) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = CAMPUS_NODES[id].name;
      select.appendChild(opt);
    }
  });
}

/**
 * 切換情境，更新地圖與路權
 */
function switchScenario(scenarioId) {
  currentScenarioId = scenarioId;
  
  // 更新情境卡片選取狀態
  document.querySelectorAll(".scenario-card").forEach(card => {
    if (card.getAttribute("data-scenario") === scenarioId) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

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

/**
 * 渲染 YouBike 圖標，並根據庫存狀態套用呼吸警告效果
 */
function renderYouBikeMarkers() {
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
function handleNodeClick(nodeId) {
  const node = CAMPUS_NODES[nodeId];
  if (!node) return;

  // 如果目前終點未設定或跟起點重複，先將點選的設為起點
  if (startNodeId === nodeId) {
    showToast(`📍 節點「${node.name}」已為起點。`);
    return;
  }
  
  // 否則，將點選的設為終點
  endNodeId = nodeId;
  ensureHybridOptions();
  
  document.getElementById("start-select").value = startNodeId;
  document.getElementById("end-select").value = endNodeId;
  
  calculateAndRenderRoutes();
}

/**
 * 核心：重新計算並繪製兩條路線對比（原始最快 vs 幸福優化）
 */
function calculateAndRenderRoutes() {
  if (!startNodeId || !endNodeId || startNodeId === endNodeId) return;

  // 1. 高亮起點與終點節點
  document.querySelectorAll(".node-group, .youbike-marker").forEach(g => {
    const id = g.getAttribute("data-id");
    g.classList.remove("node-origin", "node-destination");
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

  // 5. 更新地圖道路的基礎高亮 (屬於幸福路線的道路稍微增亮)
  CAMPUS_EDGES.forEach(edge => {
    const line = document.getElementById(`svg-edge-${edge.id}`);
    if (line) {
      if (isEdgeInPath(edge, happyResult.path)) {
        line.classList.add("active-segment");
      } else {
        line.classList.remove("active-segment");
      }
    }
  });

  // 6. 統計數據更新 (右下角浮動統計卡)
  const isBikingActive = (currentModeId === "bike");
  const stats = analyzeRoute(happyResult.path, isBikingActive);
  
  document.getElementById("stat-time").textContent = `${stats.time} 分鐘`;
  
  const statSun = document.getElementById("stat-item-sun");
  const statRain = document.getElementById("stat-item-rain");

  if (statSun && statRain) {
    const scenario = ENVIRONMENTAL_SCENARIOS[currentScenarioId];
    
    // 高溫情境下顯示曝曬度
    if (scenario.weather.condition === "heat") {
      statSun.classList.add("active");
      statSun.querySelector(".icon-stat-text").textContent = `${stats.exposure}%`;
      statRain.classList.remove("active");
      statRain.querySelector(".icon-stat-text").textContent = "0%";
    } 
    // 雨天情境下顯示淋雨率
    else if (scenario.weather.condition === "heavy_rain") {
      statRain.classList.add("active");
      statRain.querySelector(".icon-stat-text").textContent = `${stats.rain}%`;
      statSun.classList.remove("active");
      statSun.querySelector(".icon-stat-text").textContent = "0%";
    } 
    // 其他正常/空污情境下
    else {
      statSun.classList.remove("active");
      statRain.classList.remove("active");
      statSun.querySelector(".icon-stat-text").textContent = "0%";
      statRain.querySelector(".icon-stat-text").textContent = "0%";
    }
  }
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
  } else if (currentModeId === "pollution") {
    detailsHtml = `
      <div style="margin-bottom: 8px;"><strong>😷 避開空污模式：</strong></div>
      <div>AQI 超標 165，系統更新主幹道 (新生南路、三創、八德路) 之處罰權重<strong>增加 200%</strong>。導航自動規劃繞行至校園內側林蔭深處之少廢氣路段。</div>
    `;
  } else if (currentModeId === "bike") {
    // 騎車轉乘模式
    const mrtBikes = youbikeHashMap["youbike_xinsheng_4"] ? youbikeHashMap["youbike_xinsheng_4"].bikes : 0;
    const scienceDocks = youbikeHashMap["youbike_ee"] ? youbikeHashMap["youbike_ee"].docks : 0;
    
    detailsHtml = `
      <div style="margin-bottom: 8px;"><strong>🚲 騎車轉乘模式：</strong></div>
      <div style="margin-bottom: 4px;">結合步行與騎乘。騎車段時間權重除以 3 (速度提升 3 倍)，但限制 slope &ge; 3 (樓梯) 禁止騎車。</div>
      ${scenario.name === "YouBike 供需失衡" ? `
        <div style="color: var(--error-color); margin-top: 6px; border-top: 1px dashed rgba(255,180,171,0.2); padding-top: 4px;">
          <strong>⚠️ YouBike 臨界繞道警告：</strong><br>
          偵測到起點忠孝新生站(4號出口)可用車為 <strong>${mrtBikes} 輛</strong>，目的地電機工程系站可用空車位為 <strong>${scienceDocks} 個</strong> (皆 &lt; 3，高風險臨界)。<br>
          演算法自動修改中繼導航點，引導騎士步行前往最近且車源充沛的<strong>「youbike忠孝新生站(3號出口)」</strong>借車，並改騎至車位充裕的<strong>「youbike八德市場」</strong>還車後步行抵達。
        </div>
      ` : `
        <div style="color: var(--primary-color); margin-top: 6px;">
          ✓ YouBike 站點車位皆充足，導航優先選取直線最近站點轉乘。
        </div>
      `}
    `;
  }

  textContainer.innerHTML = detailsHtml;

  // 每次情境切換重新渲染 YouBike 圖層 (以套用吃緊狀態下的呼吸警告)
  renderYouBikeMarkers();
}

// ==========================================
// 9. 頁面載入完成啟動
// ==========================================
window.addEventListener("DOMContentLoaded", initSystem);
