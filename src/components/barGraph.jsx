import React from 'react';
import ReactApexChart from 'react-apexcharts';

export default function BarGraph({ items = [], totals = [], users = [], usersVotes = [] }) {

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
        enabled: true,
        custom: function({ seriesIndex, dataPointIndex }) {
          let content = '<div class="tooltip-box">';
          
          // Add title of the option
          content += `<div class="tooltip-title">${items[dataPointIndex]}</div>`;
          
          // Show voters if available
          if (users.length > 0 && users[dataPointIndex]) {
            content += '<div class="tooltip-voters">';
            content += '<span class="tooltip-subtitle">Voters:</span>';
            
            users[dataPointIndex].forEach((user, idx) => {
              let voteValue = '';
              if (usersVotes.length > 0 && usersVotes[dataPointIndex] && usersVotes[dataPointIndex][idx] !== undefined) {
                voteValue = ` (${usersVotes[dataPointIndex][idx]})`;
              }
              content += `<div class="tooltip-user">${user}${voteValue}</div>`;
            });
            
            content += '</div>';
          } else {
            content += '<div class="tooltip-no-data">No voter data available</div>';
          }
          
          content += '</div>';
          return content;
        }
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
