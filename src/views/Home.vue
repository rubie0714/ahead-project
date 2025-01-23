<template>
  <div class="container mx-auto my-10 space-y-8">

    <!-- 操作按鈕區 -->
    <div class="flex items-center space-x-4">
      <!-- 切換繪圖模式 -->
      <button @click="toggleDrawing" class="btn-primary">
        <i class="fas fa-pencil-alt mr-2"></i>{{ drawing ? '繪製中...' : '繪製多邊形' }}
      </button>

      <!-- 匯出所有多邊形 -->
      <button @click="exportPolygons" class="btn-success">
        <i class="fas fa-file-export mr-2"></i>匯出多邊形
      </button>

      <!-- 匯入多邊形 -->
      <label class="btn-secondary cursor-pointer">
        <i class="fas fa-file-import mr-2"></i>匯入多邊形
        <input type="file" @change="importPolygons" accept=".json" class="hidden" />
      </label>

      <!-- 回覆上一步 -->
      <button @click="undoDrawing" class="btn-warning">
        <i class="fas fa-undo mr-2"></i>上一步
      </button>
    </div>

    <!-- Plotly 圖表 -->
    <div ref="scatterPlot" class="w-full h-[600px] border rounded-lg shadow-lg"></div>

    <!-- 多邊形列表 -->
    <div>
      <h3 class="text-xl font-bold mb-4">多邊形列表</h3>
      <ul class="grid grid-cols-2 gap-4">
        <li v-for="(polygon, index) in polygons" :key="polygon.id">
          <div class="border rounded-lg p-4 shadow hover:shadow-md transition">
            <p class="font-semibold text-lg">{{ polygon.label }}</p>
            <p>資料總數：{{ polygon.data.count }}</p>
            <p>百分比：{{ polygon.data.percentage }} %</p>

            <div class="flex space-x-2 mt-2">
              <input type="color" v-model="polygon.color" @input="updatePolygonColor(index)" class="color-input" />
              <button @click="togglePolygonVisibility(index)"
                :class="polygon.visible ? 'btn-primary' : 'btn-secondary'">
                {{ polygon.visible ? '隱藏' : '顯示' }}
              </button>
              <!-- 編輯標籤 -->
              <button @click="editPolygonLabel(index)" class="btn-primary">編輯標籤</button>

              <!-- 切換線條樣式 -->
              <select v-model="polygon.lineStyle" @change="updatePolygonLineStyle(index)" class="select-input">
                <option value="solid">實線</option>
                <option value="dash">虛線</option>
                <option value="dot">點線</option>
              </select>
              <button @click="deletePolygon(index)" class="btn-danger">刪除</button>
              <button @click="exportSinglePolygon(index)" class="btn-warning">匯出</button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- 布林運算區 -->
    <div class="p-6 bg-gray-100 border rounded-lg shadow">
      <h3 class="text-xl font-bold mb-4">多邊形布林運算</h3>
      <div class="flex items-center space-x-4">
        <select v-model="selectedPolygon1" class="select-input">
          <option disabled value="">選擇多邊形 1</option>
          <option v-for="(polygon, index) in polygons" :key="polygon.id" :value="index">
            {{ polygon.label }}
          </option>
        </select>

        <select v-model="selectedPolygon2" class="select-input">
          <option disabled value="">選擇多邊形 2</option>
          <option v-for="(polygon, index) in polygons" :key="polygon.id" :value="index">
            {{ polygon.label }}
          </option>
        </select>

        <button @click="performBooleanOperation('AND')" class="btn-primary">AND</button>
        <button @click="performBooleanOperation('OR')" class="btn-success">OR</button>
        <button @click="performBooleanOperation('NOT')" class="btn-danger">NOT</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import Plotly from 'plotly.js-dist';
import axios from 'axios';
import Papa from 'papaparse';
import PolygonBooleanOperator from '@/utils/PolygonBooleanOperator';


const scatterPlot = ref(null);
const drawing = ref(false);
let polygonPoints = [];
let shapes = [];
let annotations = [];
const polygons = reactive([]);
let dataPoints = [];

// 初始化圖表
const initPlot = async () => {
  try {
    const response = await axios.get('/dataset/CD45_pos.csv');
    const parsedData = Papa.parse(response.data, { header: true }).data;

    // 過濾無效或缺失的數據
    const filteredData = parsedData.filter(item =>
      !isNaN(parseFloat(item['CD45-KrO'])) &&
      !isNaN(parseFloat(item['SS INT LIN']))
    );

    const xData = filteredData.map(item => parseFloat(item['CD45-KrO']));
    const yData = filteredData.map(item => parseFloat(item['SS INT LIN']));

    dataPoints = xData.map((x, i) => [x, yData[i]]);

    const trace = {
      x: xData,
      y: yData,
      mode: 'markers',
      marker: { color: 'gray', size: 4, opacity: 0.8 },  // 增加透明度與調整點的大小
      type: 'scattergl',
    };

    const layout = {
      title: 'Cell Distribution (CD45+)',
      xaxis: { title: 'CD45-KrO', range: [200, 1000] },
      yaxis: { title: 'SS INT LIN', range: [0, 1000] },
      shapes: [],//空白圖表(沒有任何多邊形)
      annotations: [],//label
      dragmode: 'pan',  // 預設為平移模式，避免誤點擊
    };

    await Plotly.newPlot(scatterPlot.value, [trace], layout);

    scatterPlot.value.on('plotly_click', (event) => {
      if (drawing.value) {
        const { x, y } = event.points[0];
        handlePointClick(x, y);
      }
    });

  } catch (error) {
    console.error('Failed to load or parse CSV data:', error);
  }
};

// 切換繪圖模式
const toggleDrawing = () => {
  drawing.value = !drawing.value;
  polygonPoints = [];

  // 根據繪圖模式切換 dragmode 與游標
  Plotly.relayout(scatterPlot.value, {
    dragmode: drawing.value ? 'lasso' : 'pan'  // 繪圖模式用 'lasso'，平移模式用 'pan'
  });

  // 切換游標樣式
  scatterPlot.value.style.cursor = drawing.value ? 'crosshair' : 'grab';
};

// 處理點擊繪圖
const handlePointClick = (x, y) => {
  if (polygonPoints.length > 2) {
    const [firstX, firstY] = polygonPoints[0];
    const distance = Math.hypot(x - firstX, y - firstY);
    if (distance < 20) {
      drawPolygon();
      return;
    }
  }
  polygonPoints.push([x, y]);
  updateTemporaryShape();
};

// 繪製多邊形(移除最後一個點）
const undoDrawing = () => {
  if (polygonPoints.length === 0) {
    alert('目前沒有可以回復的上一步');
    return;
  }

  // 移除最後一個點
  polygonPoints.pop();

  // 更新暫時形狀
  updateTemporaryShape();
};

// 更新多邊形繪製狀態
const updateTemporaryShape = () => {
  const tempPath = polygonPoints.map(point => `${point[0]},${point[1]}`).join('L');
  const tempShape = {
    type: 'path',
    path: `M${tempPath}`,
    line: { color: 'blue', width: 2, dash: 'dot' },
    fillcolor: 'rgba(0,0,255,0.1)',
  };
  Plotly.relayout(scatterPlot.value, { shapes: [...shapes, tempShape] });
};

// 計算多邊形內細胞數量與百分比
const isPointInPolygon = (point, polygon) => {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }
  return inside;
};

// 計算多邊形中心點
const calculateCentroid = (points) => {
  const n = points.length;
  let xSum = 0, ySum = 0;

  points.forEach(([x, y]) => {
    xSum += x;
    ySum += y;
  });

  return [xSum / n, ySum / n];
};

// 繪製多邊形並新增至列表
const drawPolygon = () => {
  const closedPolygon = [...polygonPoints, polygonPoints[0]];
  const polygonPath = 'M' + closedPolygon.map(point => `${point[0]},${point[1]}`).join('L') + 'Z';

  const label = prompt('請輸入 polygon 標籤', `Polygon ${polygons.length + 1}`);
  const color = '#ff0000'; //預設紅色

  const insidePoints = dataPoints.filter(point => isPointInPolygon(point, closedPolygon));
  const percentage = ((insidePoints.length / dataPoints.length) * 100).toFixed(2);

  const [centroidX, centroidY] = calculateCentroid(closedPolygon);

  shapes.push({
    type: 'path',
    path: polygonPath,
    line: { color: color, width: 2 },
    fillcolor: 'rgba(0,0,255,0.1)',
  });

  annotations.push({
    x: centroidX,
    y: centroidY,
    text: `${label}\n${percentage}%`,
    showarrow: false,
    font: { color: 'black', size: 12 },
    bgcolor: 'rgba(255,255,255,0.7)',
  });




  // 將資料存入 polygons
  polygons.push({
    id: Date.now(),
    label,
    color,
    visible: true,
    points: closedPolygon,
    data: {
      count: insidePoints.length,    // 細胞數量
      percentage: percentage         // 百分比
    },

  });

  Plotly.relayout(scatterPlot.value, { shapes, annotations });

  drawing.value = false;
  polygonPoints = [];
};

// 更新多邊形顏色
const updatePolygonColor = (index) => {
  shapes[index].line.color = polygons[index].color;
  Plotly.relayout(scatterPlot.value, { shapes });
};
// 編輯多邊形標籤
const editPolygonLabel = (index) => {
  const newLabel = prompt('請輸入新的標籤名稱：', polygons[index].label);
  if (newLabel) {
    polygons[index].label = newLabel;
    annotations[index].text = `${newLabel}\n${polygons[index].data.percentage}%`;
    Plotly.relayout(scatterPlot.value, { annotations });
  }
};
// 更新多邊形線條樣式
const updatePolygonLineStyle = (index) => {
  const lineStyleMap = {
    solid: 'solid',
    dash: 'dash',
    dot: 'dot'
  };
  shapes[index].line.dash = lineStyleMap[polygons[index].lineStyle];
  Plotly.relayout(scatterPlot.value, { shapes });
};

// 刪除多邊形
const deletePolygon = (index) => {
  shapes.splice(index, 1);
  polygons.splice(index, 1);
  annotations.splice(index, 1);
  Plotly.relayout(scatterPlot.value, { shapes, annotations });
};

// 顯示/隱藏多邊形
const togglePolygonVisibility = (index) => {
  polygons[index].visible = !polygons[index].visible;
  shapes[index].opacity = polygons[index].visible ? 1 : 0;
  annotations[index].opacity = polygons[index].visible ? 1 : 0;
  Plotly.relayout(scatterPlot.value, { shapes, annotations });
};

// 匯出多邊形資料
const exportPolygons = () => {
  const exportData = polygons.map(polygon => ({
    label: polygon.label,
    color: polygon.color,
    visible: polygon.visible,
    points: polygon.points,
    data: polygon.data,
  }));

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'polygons.json';
  link.click();

  URL.revokeObjectURL(url);
};

// 匯入多邊形資料
const importPolygons = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      importedData.forEach(polygon => {
        // 將多邊形恢復到圖表上
        const polygonPath = 'M' + polygon.points.map(point => `${point[0]},${point[1]}`).join('L') + 'Z';
        const [centroidX, centroidY] = calculateCentroid(polygon.points);

        shapes.push({
          type: 'path',
          path: polygonPath,
          line: { color: polygon.color, width: 2 },
          fillcolor: 'rgba(0,0,255,0.1)',
        });

        annotations.push({
          x: centroidX,
          y: centroidY,
          text: `${polygon.label}\n${polygon.data.percentage}%`,
          showarrow: false,
          font: { color: 'black', size: 12 },
          bgcolor: 'rgba(255,255,255,0.7)',
        });

        polygons.push({
          id: Date.now() + Math.random(), // 避免 ID 重複
          ...polygon,
        });

        Plotly.relayout(scatterPlot.value, { shapes, annotations });
      });
    } catch (error) {
      alert('Invalid file format. Please upload a valid JSON file.');
    }
  };
  reader.readAsText(file);
};

// 匯出單個多邊形
const exportSinglePolygon = (index) => {
  const polygon = polygons[index];

  const exportData = {
    id: polygon.id,
    label: polygon.label,
    color: polygon.color,
    visible: polygon.visible,
    points: polygon.points,
    data: polygon.data,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${polygon.label.replace(/\s+/g, '_')}_polygon.json`;
  link.click();

  URL.revokeObjectURL(url);
};


// 布林運算選擇的多邊形
const selectedPolygon1 = ref('');
const selectedPolygon2 = ref('');


// 執行布林運算
const performBooleanOperation = (operation) => {
  if (selectedPolygon1.value === '' || selectedPolygon2.value === '') {
    alert('請選擇兩個多邊形進行運算');
    return;
  }

  const poly1 = polygons[selectedPolygon1.value];
  const poly2 = polygons[selectedPolygon2.value];

  let resultPolygon;

  switch (operation) {
    case 'AND':
      resultPolygon = PolygonBooleanOperator.intersect(poly1.points, poly2.points);
      break;
    case 'OR':
      resultPolygon = PolygonBooleanOperator.union(poly1.points, poly2.points);
      break;
    case 'NOT':
      resultPolygon = PolygonBooleanOperator.difference(poly1.points, poly2.points);
      break;
  }

  if (!resultPolygon || resultPolygon.length === 0) {
    alert('運算結果為空');
    return;
  }

  // 計算多邊形內資料點數量與百分比
  const { count, percentage } = PolygonBooleanOperator.calculateDataInPolygon(resultPolygon, dataPoints);

  const [centroidX, centroidY] = calculateCentroid(resultPolygon);
  const label = `${poly1.label} ${operation} ${poly2.label}`;
  const color = '#ff9900';

  const polygonPath = 'M' + resultPolygon.map(point => `${point[0]},${point[1]}`).join('L') + 'Z';

  shapes.push({
    type: 'path',
    path: polygonPath,
    line: { color, width: 2, dash: 'dot' },
    fillcolor: 'rgba(255,165,0,0.2)',
  });

  annotations.push({
    x: centroidX,
    y: centroidY,
    text: `${label}\n${percentage}%`,
    showarrow: false,
    font: { color: 'black', size: 12 },
    bgcolor: 'rgba(255,255,255,0.7)',
  });

  polygons.push({
    id: Date.now() + Math.random(),
    label,
    color,
    visible: true,
    points: resultPolygon,
    data: { count, percentage },
    undoStack: []
  });

  Plotly.relayout(scatterPlot.value, { shapes, annotations });
  alert(`${operation} 運算完成，資料點：${count}，佔比：${percentage}%`);
};



onMounted(() => {
  initPlot();
});
</script>

<style scoped>
/* 基本按鈕樣式 */
.btn-primary {
  @apply bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow transition transform hover:scale-105;
}

.btn-success {
  @apply bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow transition transform hover:scale-105;
}

.btn-warning {
  @apply bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg shadow transition transform hover:scale-105;
}

.btn-danger {
  @apply bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow transition transform hover:scale-105;
}

.btn-secondary {
  @apply bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg shadow transition transform hover:scale-105;
}

.btn-outline {
  @apply border border-gray-400 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition;
}

/* 下拉選單樣式 */
.select-input {
  @apply border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500;
}

/* 顏色選擇器 */
.color-input {
  @apply w-10 h-10 rounded-full cursor-pointer;
}
</style>