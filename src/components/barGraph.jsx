import React from 'react';
import ReactApexChart from 'react-apexcharts';

export default function BarGraph({ items = [], totals = [] }) {

  const setFontSize = () => {
    if (items.length < 7) {
      return 24
    }
    return 12
  }

  const setGraphHeight = () => {
    if (items.length < 7) {
      return 250
    }
    if (items.length > 15) {
      return items.length * 30
    }
    return 350
  }

  const graph = {

    series: [{
      data: totals
    }],
    options: {
      chart: {
        type: 'bar',
        height: setGraphHeight(),
        toolbar: {
          show: false
        }
      },
      tooltip: {
        enabled: false
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          borderRadiusApplication: 'end',
          horizontal: true,
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          fontSize: setFontSize()
        }
      },
      xaxis: {
        categories: items,
        labels: {
          show: false
        }
      },
      yaxis: {
        labels: {
          show: true,
          style: {
            fontSize: setFontSize()
          }
        }
      }
    },

  }


  return (<div>
    <ReactApexChart options={graph.options} series={graph.series} type='bar' height={graph.options.chart.height} />
  </div>
  )
}
