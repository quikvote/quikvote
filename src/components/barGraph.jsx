import React from 'react';
import ReactApexChart from 'react-apexcharts';

export default function BarGraph({ items = [], totals = [], users = [], usersVotes = [] }) {
  const graph = {

    series: [{
      data: totals
    }],
    options: {
      chart: {
        type: 'bar',
        height: 100,
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
          fontSize: '24px'
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
            fontSize: '24px'
          }
        }
      }
    },

  }


  return (<div>
    <ReactApexChart options={graph.options} series={graph.series} type='bar' height={250} />
  </div>
  )
}
