<template>
  <div class="stats-charts">
    <div class="chart-panel full">
      <div class="chart-head">
        <div>
          <h4>{{ $t('admin.charts7d') }}</h4>
          <p>{{ $t('admin.chartsClickTip') }}</p>
        </div>
      </div>
      <div ref="barRef" class="chart-canvas bar"></div>
    </div>

    <div class="chart-panel">
      <div class="chart-head">
        <div>
          <h4>{{ $t('admin.chartsHourly') }}</h4>
          <p>{{ selectedDate || '—' }}</p>
        </div>
      </div>
      <div ref="lineRef" class="chart-canvas line"></div>
    </div>

    <div class="chart-panel">
      <div class="chart-head">
        <div>
          <h4>{{ $t('admin.chartsCategory') }}</h4>
          <p>{{ $t('admin.chartsTotal', { amount: totalText }) }}</p>
        </div>
      </div>
      <div ref="pieRef" class="chart-canvas pie"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { TRADE_CATEGORIES } from '@/constants/categories'

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Object, default: () => ({ days: [], hourly: {}, category: [], totalAmount: 0 }) }
})

const { t } = useI18n()

const barRef = ref(null)
const lineRef = ref(null)
const pieRef = ref(null)
let barChart = null
let lineChart = null
let pieChart = null
let resizeObserver = null

const days = computed(() => props.data?.days || [])
const hourly = computed(() => props.data?.hourly || {})
const category = computed(() => props.data?.category || [])
const selectedDate = ref('')
const totalText = computed(() => `¥${Number(props.data?.totalAmount || 0).toFixed(2)}`)

function catLabel(value) {
  const found = TRADE_CATEGORIES.find((c) => c.value === value)
  return found ? t('tradeCat.' + found.key) : value
}

function renderBar() {
  if (!barChart) return
  const list = days.value
  barChart.setOption({
    grid: { left: 6, right: 10, top: 28, bottom: 6, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = params[0]
        return `${list[p.dataIndex]?.date || ''}<br/>${t('admin.chartsCount')}：${p.value}`
      }
    },
    xAxis: {
      type: 'category',
      data: list.map((d) => d.date.slice(5)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dbe9ec' } },
      axisLabel: { color: '#7b95a0', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#eef5f6' } },
      axisLabel: { color: '#9db2ba', fontSize: 11 }
    },
    series: [{
      type: 'bar',
      barMaxWidth: 36,
      data: list.map((d) => ({
        value: d.count,
        itemStyle: {
          color: d.date === selectedDate.value ? '#10667a' : '#7ad9c4',
          borderRadius: [6, 6, 0, 0]
        }
      })),
      label: { show: true, position: 'top', color: '#5d7b87', fontSize: 11 }
    }]
  }, true)
}

function renderLine() {
  if (!lineChart) return
  const values = hourly.value[selectedDate.value] || Array.from({ length: 24 }, () => 0)
  lineChart.setOption({
    grid: { left: 6, right: 12, top: 28, bottom: 6, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => `${params[0].axisValue}<br/>${t('admin.chartsCount')}：${params[0].value}`
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: values.map((_, i) => `${i}:00`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dbe9ec' } },
      axisLabel: { color: '#7b95a0', fontSize: 10, interval: 2 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#eef5f6' } },
      axisLabel: { color: '#9db2ba', fontSize: 11 }
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: values,
      itemStyle: { color: '#1a90a0' },
      lineStyle: { width: 2.4, color: '#1a90a0' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(26,144,160,0.28)' },
          { offset: 1, color: 'rgba(26,144,160,0.02)' }
        ])
      }
    }]
  }, true)
}

function renderPie() {
  if (!pieChart) return
  const list = category.value
  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}<br/>¥${Number(p.value).toFixed(2)}（${p.percent}%）`
    },
    series: [{
      type: 'pie',
      radius: ['46%', '72%'],
      center: ['50%', '52%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{d}%', color: '#5d7b87', fontSize: 11, lineHeight: 16 },
      labelLine: { length: 8, length2: 8 },
      data: list.map((i) => ({ name: catLabel(i.category), value: i.amount }))
    }]
  }, true)
}

function selectDate(date) {
  if (!date) return
  selectedDate.value = date
  renderBar()
  renderLine()
}

function updateAll() {
  if (!selectedDate.value) {
    selectedDate.value = days.value[days.value.length - 1]?.date || ''
  }
  renderBar()
  renderLine()
  renderPie()
}

onMounted(async () => {
  await nextTick()
  if (barRef.value) barChart = echarts.init(barRef.value)
  if (lineRef.value) lineChart = echarts.init(lineRef.value)
  if (pieRef.value) pieChart = echarts.init(pieRef.value)

  barChart?.on('click', (params) => {
    const item = days.value[params.dataIndex]
    if (item) selectDate(item.date)
  })

  updateAll()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      barChart?.resize()
      lineChart?.resize()
      pieChart?.resize()
    })
    ;[barRef.value, lineRef.value, pieRef.value].forEach((el) => el && resizeObserver.observe(el))
  }
})

watch(() => props.data, () => updateAll(), { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  barChart?.dispose()
  lineChart?.dispose()
  pieChart?.dispose()
})
</script>

<style scoped>
.stats-charts {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}
.chart-panel {
  background: #fff;
  border: 1px solid rgba(16, 102, 122, 0.08);
  border-radius: 14px;
  padding: 14px 16px 8px;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.05);
  min-width: 0;
}
.chart-panel.full {
  grid-column: 1 / -1;
}
.chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.chart-head h4 {
  font-size: 14px;
  font-weight: 700;
  color: #0b2f3f;
}
.chart-head p {
  margin-top: 3px;
  font-size: 11.5px;
  color: #8ba3ac;
}
.chart-canvas {
  width: 100%;
}
.chart-canvas.bar {
  height: 240px;
}
.chart-canvas.line {
  height: 230px;
}
.chart-canvas.pie {
  height: 230px;
}

@media (max-width: 1100px) {
  .stats-charts {
    grid-template-columns: 1fr;
  }
  .chart-panel.full {
    grid-column: auto;
  }
}
@media (max-width: 768px) {
  .chart-canvas.bar {
    height: 200px;
  }
  .chart-canvas.line,
  .chart-canvas.pie {
    height: 210px;
  }
}
</style>
